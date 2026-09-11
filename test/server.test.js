const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createRuntime, validatePayload, SCHEMA_VERSION } = require('../server.js');
const { verifyPassword, validatePassword, isPrivateAddress } = require('../auth.js');

const ADMIN_PASSWORD = 'Admin-Password!42';
const USER_PASSWORD = 'Player-Password!42';

async function fixture(t, options = {}) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scorebuddy-'));
    const dbPath = path.join(directory, 'scoreboard.db');
    const setupToken = crypto.randomBytes(24).toString('hex');
    const runtime = await createRuntime({ dbPath, setupToken, ...options });
    const server = runtime.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await runtime.close();
        await fs.rm(directory, { recursive: true, force: true });
    });
    return { runtime, base, setupToken, dbPath };
}

class Client {
    constructor(base) { this.base = base; this.cookie = ''; this.csrf = ''; }
    async request(url, options = {}) {
        const headers = { ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...(options.csrf === false || !this.csrf ? {} : { 'x-csrf-token': this.csrf }), ...(options.headers || {}) };
        const response = await fetch(`${this.base}${url}`, { ...options, headers });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) this.cookie = setCookie.split(';', 1)[0];
        const text = await response.text();
        let data = text;
        try { data = JSON.parse(text); } catch { /* SVG/text */ }
        if (data?.csrfToken) this.csrf = data.csrfToken;
        return { response, data, text };
    }
    post(url, body = {}, options = {}) { return this.request(url, { method: 'POST', body: JSON.stringify(body), ...options }); }
    put(url, body = {}, options = {}) { return this.request(url, { method: 'PUT', body: JSON.stringify(body), ...options }); }
    patch(url, body = {}, options = {}) { return this.request(url, { method: 'PATCH', body: JSON.stringify(body), ...options }); }
    delete(url, options = {}) { return this.request(url, { method: 'DELETE', body: '{}', ...options }); }
}

async function setupAdmin(f, username = 'master') {
    const client = new Client(f.base);
    const result = await client.post('/api/auth/setup', { username, password: ADMIN_PASSWORD }, { headers: { 'x-setup-token': f.setupToken } });
    assert.equal(result.response.status, 201, result.text);
    return client;
}

async function savePlayers(admin, players = [{ id: 101, name: 'Alice', favorite: false }, { id: 102, name: 'Bob', favorite: false }, { id: 103, name: 'Cara', favorite: false }]) {
    const result = await admin.post('/api/players', players);
    assert.equal(result.response.status, 200, result.text);
    return players;
}

async function login(base, username, password = USER_PASSWORD) {
    const client = new Client(base);
    const result = await client.post('/api/auth/login', { username, password });
    assert.equal(result.response.status, 200, result.text);
    return client;
}

test('legacy-compatible payloads validate and malformed payloads fail', () => {
    const legacy = [{ id: 1720000000000, name: 'Alice <Admin>', favorite: false, wins: 1, games: 2, points: -10 }];
    assert.doesNotThrow(() => validatePayload('players', legacy));
    assert.doesNotThrow(() => validatePayload('gameNights', [{ id: '123e4567-e89b-12d3-a456-426614174000', name: 'Freitagabend', participantIds: [1, 2], status: 'active', startedAt: '2026-01-01T12:00:00.000Z', endedAt: null }]));
    assert.throws(() => validatePayload('players', { bad: true }), /Array/);
    assert.throws(() => validatePayload('players', [{ id: -1, name: 'x' }]), /ID/);
});

test('password policy accepts eight characters without requiring a special character', () => {
    assert.equal(validatePassword('Abcdefg1'), 'Abcdefg1');
    assert.equal(validatePassword('abcdefgh'), 'abcdefgh');
    assert.equal(validatePassword('ABCDEFG1'), 'ABCDEFG1');
    assert.equal(validatePassword('Abcdefgh'), 'Abcdefgh');
    assert.throws(() => validatePassword('Abcdef1'), /8–128/);
});

test('migration preserves legacy data and moves the singleton game into active games', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scorebuddy-legacy-'));
    const dbPath = path.join(directory, 'scoreboard.db');
    const db = new Database(dbPath);
    db.exec('CREATE TABLE state (id TEXT PRIMARY KEY, json_data TEXT NOT NULL); PRAGMA user_version = 2;');
    const values = { players: '[{"id":1,"name":"Alt"}]', games: '[{"id":2}]', activeGames: '[{"id":3}]', currentGame: '{"id":4}', gameNights: '[{"id":5}]' };
    const insert = db.prepare('INSERT INTO state VALUES (?, ?)');
    for (const entry of Object.entries(values)) insert.run(...entry);
    db.close();
    const runtime = await createRuntime({ dbPath, setupToken: crypto.randomBytes(16).toString('hex') });
    t.after(async () => { await runtime.close(); await fs.rm(directory, { recursive: true, force: true }); });
    assert.equal(runtime.db.pragma('user_version', { simple: true }), SCHEMA_VERSION);
    for (const id of ['players', 'games', 'gameNights']) assert.equal(runtime.db.prepare('SELECT json_data FROM state WHERE id = ?').get(id).json_data, values[id]);
    assert.equal(runtime.db.prepare('SELECT json_data FROM state WHERE id = ?').get('activeGames').json_data, '[{"id":3},{"id":4}]');
    assert.equal(runtime.db.prepare('SELECT json_data FROM state WHERE id = ?').get('currentGame').json_data, 'null');
    for (const table of ['users', 'sessions', 'invitations']) assert.ok(runtime.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
});

test('first-run setup, password hashing, secure session cookie and CSRF', async t => {
    const f = await fixture(t);
    const anonymous = new Client(f.base);
    assert.deepEqual((await anonymous.request('/api/auth/status')).data, { setupRequired: true, setupMode: 'token' });
    assert.equal((await anonymous.post('/api/auth/setup', { username: 'master', password: ADMIN_PASSWORD })).response.status, 403);
    const admin = await setupAdmin(f);
    const userRow = f.runtime.db.prepare('SELECT * FROM users WHERE username = ?').get('master');
    assert.notEqual(userRow.password_hash, ADMIN_PASSWORD);
    assert.match(userRow.password_hash, /^scrypt\$/);
    assert.equal(await verifyPassword(ADMIN_PASSWORD, userRow.password_hash), true);
    const cookieResponse = await new Client(f.base).post('/api/auth/login', { username: 'master', password: ADMIN_PASSWORD });
    const cookie = cookieResponse.response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Max-Age=/i);
    assert.doesNotMatch(cookie, /Secure/i, 'plain local HTTP cookie is intentionally not Secure');
    assert.equal((await admin.post('/api/players', [], { csrf: false })).response.status, 403);
    assert.equal((await admin.post('/api/players', [])).response.status, 200);
    assert.equal((await anonymous.request('/api/users')).response.status, 401);
    assert.equal((await admin.request('/api/users')).response.status, 200);
});

test('temporary private-network setup needs no token and rejects public address ranges', async t => {
    assert.equal(isPrivateAddress('127.0.0.1'), true);
    assert.equal(isPrivateAddress('::ffff:172.18.0.1'), true);
    assert.equal(isPrivateAddress('192.168.178.50'), true);
    assert.equal(isPrivateAddress('fd7a:115c:a1e0::1'), true);
    assert.equal(isPrivateAddress('8.8.8.8'), false);
    assert.equal(isPrivateAddress('2001:4860:4860::8888'), false);
    const f = await fixture(t, { setupToken: '', allowPrivateSetup: true });
    const client = new Client(f.base);
    assert.deepEqual((await client.request('/api/auth/status')).data, { setupRequired: true, setupMode: 'private' });
    assert.equal((await client.post('/api/auth/setup', { username: 'master', password: ADMIN_PASSWORD })).response.status, 201);
    assert.equal((await new Client(f.base).post('/api/auth/setup', { username: 'other', password: ADMIN_PASSWORD })).response.status, 409);
});

test('public access is limited to explicit read-only preview', async t => {
    const f = await fixture(t);
    const anonymous = new Client(f.base);
    for (const endpoint of ['players', 'games', 'activeGames', 'currentGame', 'gameNights']) {
        assert.equal((await anonymous.request(`/api/${endpoint}`)).response.status, 401, endpoint);
        assert.equal((await anonymous.request(`/api/${endpoint}?preview=1`)).response.status, 200, endpoint);
        assert.equal((await anonymous.post(`/api/${endpoint}?preview=1`, endpoint === 'currentGame' ? {} : [])).response.status, 401, endpoint);
    }
    assert.equal((await anonymous.request('/api/preview-qr')).response.status, 401);
    for (const privatePath of ['/server.js', '/auth.js', '/package.json', '/scoreboard.db', '/Dockerfile']) assert.equal((await anonymous.request(privatePath)).response.status, 404, privatePath);
});

test('rights matrix: user creates and completes games while player administration stays master-only', async t => {
    const f = await fixture(t);
    const admin = await setupAdmin(f);
    await savePlayers(admin);
    assert.equal((await admin.post('/api/users', { username: 'alice', password: USER_PASSWORD, playerId: 101 })).response.status, 201);
    const user = await login(f.base, 'alice');
    const endpoints = ['players', 'games', 'activeGames', 'currentGame', 'gameNights'];
    for (const endpoint of endpoints) assert.equal((await user.request(`/api/${endpoint}`)).response.status, 200, endpoint);
    assert.equal((await user.post('/api/players', [])).response.status, 400, 'cannot remove players');
    const renamedPlayers = [{ id: 101, name: 'Mallory', favorite: false }, { id: 102, name: 'Bob', favorite: false }, { id: 103, name: 'Cara', favorite: false }];
    assert.equal((await user.post('/api/players', renamedPlayers)).response.status, 400, 'cannot rename players');
    assert.equal((await user.post('/api/gameNights', [])).response.status, 200, 'can manage game nights');
    assert.equal((await user.request('/api/users')).response.status, 403);
    assert.equal((await user.delete('/api/users/1')).response.status, 403);
    assert.equal((await user.post('/api/currentGame', { id: 700, name: 'Laufend', players: [] })).response.status, 200, 'can create game');
    assert.equal((await user.post('/api/currentGame', { id: 700, name: 'Laufend', players: [], round: 2 })).response.status, 200, 'can score existing game');
    assert.equal((await user.post('/api/activeGames', [{ id: 700, name: 'Laufend', players: [] }])).response.status, 200, 'can pause game');
    const statsPlayers = [{ id: 101, name: 'Alice', favorite: false, wins: 1, games: 1, points: 12 }, { id: 102, name: 'Bob', favorite: false, wins: 0, games: 1, points: -3 }, { id: 103, name: 'Cara', favorite: false, wins: 0, games: 0, points: 0 }];
    assert.equal((await user.post('/api/players', statsPlayers)).response.status, 200, 'can update game statistics');
    assert.equal((await user.post('/api/games', [{ id: 700, name: 'Laufend', players: [], winner: 'Alice' }])).response.status, 200, 'can append completed game');
    assert.equal((await user.post('/api/games', [])).response.status, 400, 'cannot delete game history');
    assert.equal((await user.post('/api/currentGame', {})).response.status, 200, 'can finish game');
    for (const endpoint of endpoints) {
        const body = endpoint === 'currentGame' ? {} : [];
        assert.equal((await admin.post(`/api/${endpoint}`, body)).response.status, 200, endpoint);
    }
});

test('multiple games and game nights run independently for normal users', async t => {
    const f = await fixture(t);
    const admin = await setupAdmin(f);
    await savePlayers(admin);
    assert.equal((await admin.post('/api/users', { username: 'alice', password: USER_PASSWORD, playerId: 101 })).response.status, 201);
    const user = await login(f.base, 'alice');
    const nights = [
        { id: 801, name: 'Tisch 1', participantIds: [101, 102], status: 'active', startedAt: '2026-09-11T20:00:00.000Z', endedAt: null },
        { id: 802, name: 'Tisch 2', participantIds: [102, 103], status: 'active', startedAt: '2026-09-11T20:01:00.000Z', endedAt: null }
    ];
    assert.equal((await user.post('/api/gameNights', nights)).response.status, 200);
    const makeGame = (id, gameNightId, first, second) => ({ id, gameNightId, name: `Spiel ${id}`, mode: 'round', rated: true, players: [
        { id: first, name: first === 101 ? 'Alice' : 'Bob', playerIds: [first], rounds: [], total: 0 },
        { id: second, name: second === 103 ? 'Cara' : 'Bob', playerIds: [second], rounds: [], total: 0 }
    ] });
    const gameA = makeGame(701, 801, 101, 102);
    const gameB = makeGame(702, 802, 102, 103);
    assert.equal((await user.post('/api/active-games', gameA)).response.status, 201);
    assert.equal((await user.post('/api/active-games', gameB)).response.status, 201);
    gameA.players[0].rounds = [9]; gameA.players[0].total = 9;
    assert.equal((await user.put('/api/active-games/701', gameA)).response.status, 200);
    let active = (await user.request('/api/activeGames')).data;
    assert.equal(active.length, 2);
    assert.equal(active.find(game => game.id === 702).players[0].total, 0, 'second game stays unchanged');
    gameA.winner = 'Alice'; gameA.winnerPartyIds = [101];
    const finished = await user.post('/api/active-games/701/finish', gameA);
    assert.equal(finished.response.status, 200, finished.text);
    assert.deepEqual(finished.data.activeGames.map(game => game.id), [702]);
    assert.equal(finished.data.players.find(player => player.id === 101).wins, 1);
    assert.equal(finished.data.players.find(player => player.id === 101).points, 9);
    assert.equal((await user.post('/api/active-games/701/finish', gameA)).response.status, 404, 'cannot finish twice');
});

test('direct accounts support optional binding changes and enforce atomic uniqueness', async t => {
    const f = await fixture(t);
    const admin = await setupAdmin(f);
    await savePlayers(admin);
    const alice = await admin.post('/api/users', { username: 'alice', password: USER_PASSWORD, playerId: 101 });
    assert.equal(alice.response.status, 201);
    assert.equal((await admin.post('/api/users', { username: 'alice', password: USER_PASSWORD, playerId: 102 })).response.status, 409);
    assert.equal((await admin.post('/api/users', { username: 'other', password: USER_PASSWORD, playerId: 101 })).response.status, 409);
    assert.equal((await admin.post('/api/users', { username: 'unbound', password: USER_PASSWORD, playerId: null })).response.status, 400);
    assert.equal((await admin.patch(`/api/users/${alice.data.id}`, { playerId: null })).response.status, 200);
    assert.equal((await admin.patch(`/api/users/${alice.data.id}`, { playerId: 102 })).response.status, 200);
    assert.equal((await admin.patch(`/api/users/${alice.data.id}`, { playerId: 999 })).response.status, 400);
    assert.equal((await admin.patch('/api/users/1', { playerId: 101 })).response.status, 200, 'master can be linked to a player');
    assert.equal((await admin.request('/api/auth/me')).data.user.playerId, '101');
    assert.equal((await admin.patch('/api/users/1', { playerId: null })).response.status, 200, 'master can be unlinked without losing role');
    assert.equal((await admin.delete(`/api/users/${alice.data.id}`)).response.status, 200);
    assert.equal((await admin.delete('/api/users/1')).response.status, 400, 'master cannot be deleted');
});

test('QR invitations are hashed, one-use, 24h, revocable and invalidated by linking', async t => {
    let clock = Date.now();
    const f = await fixture(t, { now: () => clock, publicBaseUrl: 'https://staging.example.test' });
    const admin = await setupAdmin(f);
    await savePlayers(admin);
    const invitation = await admin.post('/api/players/101/invitations');
    assert.equal(invitation.response.status, 201, invitation.text);
    assert.match(invitation.data.inviteUrl, /^https:\/\/staging\.example\.test\/\?invite=/);
    assert.match(invitation.data.qrSvg, /<svg/);
    assert.equal(invitation.data.expiresAt - clock, 24 * 60 * 60 * 1000);
    const token = new URL(invitation.data.inviteUrl).searchParams.get('invite');
    assert.equal((await admin.request('/api/invitations')).data.length, 1);
    const stored = f.runtime.db.prepare('SELECT * FROM invitations WHERE id = ?').get(invitation.data.id);
    assert.notEqual(stored.token_hash, token);
    assert.equal(stored.token_hash, crypto.createHash('sha256').update(token).digest('hex'));
    assert.equal((await new Client(f.base).request(`/api/invitations/${token}`)).response.status, 200);
    const registered = await new Client(f.base).post(`/api/invitations/${token}/register`, { username: 'invited', password: USER_PASSWORD });
    assert.equal(registered.response.status, 201, registered.text);
    assert.equal(registered.data.user.playerId, '101');
    assert.equal((await new Client(f.base).post(`/api/invitations/${token}/register`, { username: 'again', password: USER_PASSWORD })).response.status, 410);

    const revoked = await admin.post('/api/players/102/invitations');
    const revokedToken = new URL(revoked.data.inviteUrl).searchParams.get('invite');
    assert.equal((await admin.delete(`/api/invitations/${revoked.data.id}`)).response.status, 200);
    assert.equal((await new Client(f.base).request(`/api/invitations/${revokedToken}`)).response.status, 410);

    const replaced = await admin.post('/api/players/102/invitations');
    const replacedToken = new URL(replaced.data.inviteUrl).searchParams.get('invite');
    assert.equal((await admin.post('/api/users', { username: 'bob', password: USER_PASSWORD, playerId: 102 })).response.status, 201);
    assert.equal((await new Client(f.base).request(`/api/invitations/${replacedToken}`)).response.status, 410);

    const expiring = await admin.post('/api/players/103/invitations');
    const expiringToken = new URL(expiring.data.inviteUrl).searchParams.get('invite');
    clock += 24 * 60 * 60 * 1000 + 1;
    assert.equal((await new Client(f.base).request(`/api/invitations/${expiringToken}`)).response.status, 410);
});

test('password change keeps current session, invalidates others and rejects old password', async t => {
    const f = await fixture(t);
    const admin = await setupAdmin(f);
    await savePlayers(admin);
    await admin.post('/api/users', { username: 'alice', password: USER_PASSWORD, playerId: 101 });
    const first = await login(f.base, 'alice');
    const second = await login(f.base, 'alice');
    const newPassword = 'New-Player-Password!84';
    assert.equal((await first.post('/api/auth/password', { currentPassword: 'wrong', newPassword })).response.status, 400);
    assert.equal((await first.post('/api/auth/password', { currentPassword: USER_PASSWORD, newPassword })).response.status, 200);
    assert.equal((await first.request('/api/auth/me')).response.status, 200);
    assert.equal((await second.request('/api/auth/me')).response.status, 401);
    assert.equal((await new Client(f.base).post('/api/auth/login', { username: 'alice', password: USER_PASSWORD })).response.status, 401);
    assert.equal((await new Client(f.base).post('/api/auth/login', { username: 'alice', password: newPassword })).response.status, 200);
    assert.equal((await first.post('/api/auth/logout')).response.status, 200);
    assert.equal((await first.request('/api/auth/me')).response.status, 401);
});

test('login is rate limited after repeated failures', async t => {
    const f = await fixture(t);
    await setupAdmin(f);
    const client = new Client(f.base);
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await client.post('/api/auth/login', { username: 'master', password: 'wrong' })).response.status, 401);
    assert.equal((await client.post('/api/auth/login', { username: 'master', password: ADMIN_PASSWORD })).response.status, 429);
});
