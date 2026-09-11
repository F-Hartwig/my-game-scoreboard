'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE = 'scorebuddy_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;
const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;
const DUMMY_SALT = Buffer.from('scorebuddy-login-dummy-salt');

function normalizeUsername(value) {
    return String(value ?? '').trim();
}

function validateUsername(value) {
    const username = normalizeUsername(value);
    if (username.length < 3 || username.length > 40 || !/^[\p{L}\p{N}_.-]+$/u.test(username)) {
        throw new Error('Benutzername muss 3–40 Zeichen lang sein und darf Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten.');
    }
    return username;
}

function validatePassword(value) {
    const password = String(value ?? '');
    if (password.length < 8 || password.length > 128) throw new Error('Passwort muss 8–128 Zeichen enthalten.');
    return password;
}

async function hashPassword(password) {
    validatePassword(password);
    const salt = crypto.randomBytes(16);
    const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
    try {
        const [algorithm, n, r, p, saltText, hashText] = String(encoded).split('$');
        if (algorithm !== 'scrypt') return false;
        const expected = Buffer.from(hashText, 'base64url');
        const actual = await scrypt(String(password), Buffer.from(saltText, 'base64url'), expected.length, {
            N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
        });
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
        return false;
    }
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function parseCookies(header = '') {
    const cookies = {};
    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator < 0) continue;
        const key = part.slice(0, separator).trim();
        try { cookies[key] = decodeURIComponent(part.slice(separator + 1).trim()); } catch { /* ignore */ }
    }
    return cookies;
}

function isLoopback(address) {
    const normalized = String(address || '').replace(/^::ffff:/, '');
    return normalized === '127.0.0.1' || normalized === '::1';
}

function isPrivateAddress(address) {
    const normalized = String(address || '').replace(/^::ffff:/, '').toLowerCase();
    if (isLoopback(normalized)) return true;
    const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (match) {
        const octets = match.slice(1).map(Number);
        if (octets.some(value => value > 255)) return false;
        return octets[0] === 10 ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168);
    }
    return normalized.startsWith('fc') || normalized.startsWith('fd');
}

function createAuth(db, options = {}) {
    const now = options.now || (() => Date.now());
    const setupToken = options.setupToken ?? process.env.SCOREBUDDY_SETUP_TOKEN ?? '';
    const allowLocalSetup = options.allowLocalSetup ?? process.env.ALLOW_LOCAL_SETUP === '1';
    const allowPrivateSetup = options.allowPrivateSetup ?? process.env.ALLOW_PRIVATE_SETUP === '1';
    const secureCookies = options.secureCookies ?? process.env.COOKIE_SECURE === '1';
    const attempts = new Map();
    const findUserByName = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
    const findUserById = db.prepare('SELECT * FROM users WHERE id = ?');
    const publicUser = row => ({ id: row.id, username: row.username, role: row.role, playerId: row.player_id });

    function setSessionCookie(req, res, token, maxAge = SESSION_TTL_MS) {
        const secure = secureCookies || req.secure;
        res.cookie(SESSION_COOKIE, token, {
            httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge
        });
    }

    function clearSessionCookie(req, res) {
        res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: secureCookies || req.secure, path: '/' });
    }

    function createSession(req, res, userId) {
        const token = crypto.randomBytes(32).toString('base64url');
        const csrfToken = crypto.randomBytes(32).toString('base64url');
        const createdAt = now();
        db.prepare('INSERT INTO sessions (token_hash, user_id, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
            .run(tokenHash(token), userId, csrfToken, createdAt, createdAt + SESSION_TTL_MS);
        setSessionCookie(req, res, token);
        return csrfToken;
    }

    function sessionMiddleware(req, res, next) {
        req.auth = null;
        const token = parseCookies(req.get('cookie'))[SESSION_COOKIE];
        if (!token) return next();
        const row = db.prepare(`SELECT s.token_hash, s.csrf_token, s.expires_at, u.id, u.username, u.role, u.player_id
            FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(tokenHash(token));
        if (!row || row.expires_at <= now()) {
            if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
            clearSessionCookie(req, res);
            return next();
        }
        req.auth = { user: publicUser(row), csrfToken: row.csrf_token, sessionHash: row.token_hash };
        next();
    }

    function requireAuth(req, res, next) {
        if (!req.auth) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
        next();
    }

    function requireAdmin(req, res, next) {
        if (!req.auth) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
        if (req.auth.user.role !== 'admin') return res.status(403).json({ error: 'Nur der Master darf diese Aktion ausführen.' });
        next();
    }

    function requireCsrf(req, res, next) {
        if (!req.auth) return res.status(401).json({ error: 'Anmeldung erforderlich.' });
        const supplied = req.get('x-csrf-token') || '';
        const expected = req.auth.csrfToken;
        const valid = supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
        if (!valid) return res.status(403).json({ error: 'Ungültiger CSRF-Schutz.' });
        next();
    }

    function setupAllowed(req) {
        if (setupToken) {
            const supplied = req.get('x-setup-token') || '';
            if (supplied.length === setupToken.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(setupToken))) return true;
        }
        return (allowLocalSetup && isLoopback(req.socket.remoteAddress)) ||
            (allowPrivateSetup && isPrivateAddress(req.socket.remoteAddress));
    }

    function rateKey(req, username) {
        return `${req.ip}|${normalizeUsername(username).toLocaleLowerCase('de-DE')}`;
    }

    function rateLimited(key) {
        const cutoff = now() - LOGIN_WINDOW_MS;
        const fresh = (attempts.get(key) || []).filter(timestamp => timestamp > cutoff);
        attempts.set(key, fresh);
        return fresh.length >= LOGIN_MAX_ATTEMPTS;
    }

    function failedAttempt(key) {
        if (!attempts.has(key) && attempts.size >= 5000) {
            const cutoff = now() - LOGIN_WINDOW_MS;
            for (const [storedKey, timestamps] of attempts) {
                const fresh = timestamps.filter(timestamp => timestamp > cutoff);
                if (fresh.length) attempts.set(storedKey, fresh);
                else attempts.delete(storedKey);
            }
            while (attempts.size >= 5000) attempts.delete(attempts.keys().next().value);
        }
        const values = attempts.get(key) || [];
        values.push(now());
        attempts.set(key, values);
    }

    function installRoutes(app, helpers) {
        app.get('/api/auth/status', (req, res) => {
            const setupRequired = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get() === undefined;
            const setupMode = allowPrivateSetup ? 'private' : (setupToken ? 'token' : (allowLocalSetup ? 'local' : 'disabled'));
            res.set('Cache-Control', 'no-store').json({ setupRequired, setupMode });
        });

        app.post('/api/auth/setup', async (req, res, next) => {
            try {
                if (db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get()) return res.status(409).json({ error: 'Master wurde bereits eingerichtet.' });
                if (!setupAllowed(req)) return res.status(403).json({ error: 'Master-Einrichtung ist nur lokal oder mit Setup-Token erlaubt.' });
                const username = validateUsername(req.body?.username);
                const passwordHash = await hashPassword(req.body?.password);
                const result = db.prepare("INSERT INTO users (username, password_hash, role, player_id, created_at) VALUES (?, ?, 'admin', NULL, ?)")
                    .run(username, passwordHash, now());
                const csrfToken = createSession(req, res, result.lastInsertRowid);
                return res.status(201).json({ user: publicUser(findUserById.get(result.lastInsertRowid)), csrfToken });
            } catch (error) {
                if (/UNIQUE/.test(error.message)) return res.status(409).json({ error: 'Benutzername ist bereits vergeben.' });
                if (error.message?.includes('Passwort') || error.message?.includes('Benutzername')) return res.status(400).json({ error: error.message });
                return next(error);
            }
        });

        app.post('/api/auth/login', async (req, res, next) => {
            try {
                const key = rateKey(req, req.body?.username);
                if (rateLimited(key)) return res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte später erneut versuchen.' });
                const user = findUserByName.get(normalizeUsername(req.body?.username));
                const valid = user ? await verifyPassword(req.body?.password, user.password_hash) : await scrypt(String(req.body?.password || ''), DUMMY_SALT, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).then(() => false);
                if (!valid) {
                    failedAttempt(key);
                    return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
                }
                attempts.delete(key);
                db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
                const csrfToken = createSession(req, res, user.id);
                return res.json({ user: publicUser(user), csrfToken });
            } catch (error) { return next(error); }
        });

        app.get('/api/auth/me', requireAuth, (req, res) => res.set('Cache-Control', 'no-store').json({ user: req.auth.user, csrfToken: req.auth.csrfToken }));

        app.post('/api/auth/logout', requireAuth, requireCsrf, (req, res) => {
            db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(req.auth.sessionHash);
            clearSessionCookie(req, res);
            res.json({ success: true });
        });

        app.post('/api/auth/password', requireAuth, requireCsrf, async (req, res, next) => {
            try {
                const user = findUserById.get(req.auth.user.id);
                if (!await verifyPassword(req.body?.currentPassword, user.password_hash)) return res.status(400).json({ error: 'Aktuelles Passwort ist falsch.' });
                const passwordHash = await hashPassword(req.body?.newPassword);
                const transaction = db.transaction(() => {
                    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
                    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(user.id, req.auth.sessionHash);
                });
                transaction();
                res.json({ success: true });
            } catch (error) {
                if (error.message?.includes('Passwort')) return res.status(400).json({ error: error.message });
                return next(error);
            }
        });

        app.get('/api/users', requireAdmin, (req, res) => {
            const rows = db.prepare('SELECT id, username, role, player_id FROM users ORDER BY username COLLATE NOCASE').all();
            res.json(rows.map(publicUser));
        });

        app.post('/api/users', requireAdmin, requireCsrf, async (req, res, next) => {
            try {
                const username = validateUsername(req.body?.username);
                const passwordHash = await hashPassword(req.body?.password);
                const playerId = helpers.validatePlayerBinding(req.body?.playerId);
                if (playerId === null) throw new Error('Für ein neues Konto muss ein Spieler ausgewählt werden.');
                const create = db.transaction(() => {
                    const result = db.prepare("INSERT INTO users (username, password_hash, role, player_id, created_at) VALUES (?, ?, 'user', ?, ?)")
                        .run(username, passwordHash, playerId, now());
                    db.prepare('UPDATE invitations SET revoked_at = ? WHERE player_id = ? AND used_at IS NULL AND revoked_at IS NULL').run(now(), playerId);
                    return result.lastInsertRowid;
                });
                const userId = create.immediate();
                res.status(201).json(publicUser(findUserById.get(userId)));
            } catch (error) { helpers.handleUserError(error, res, next); }
        });

        app.patch('/api/users/:id', requireAdmin, requireCsrf, async (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const user = findUserById.get(id);
                if (!user) return res.status(404).json({ error: 'Benutzer wurde nicht gefunden.' });
                const username = Object.hasOwn(req.body || {}, 'username') ? validateUsername(req.body.username) : user.username;
                const playerId = Object.hasOwn(req.body || {}, 'playerId') ? helpers.validatePlayerBinding(req.body.playerId) : user.player_id;
                const passwordHash = Object.hasOwn(req.body || {}, 'password') ? await hashPassword(req.body.password) : user.password_hash;
                db.prepare('UPDATE users SET username = ?, player_id = ?, password_hash = ? WHERE id = ?').run(username, playerId, passwordHash, id);
                if (passwordHash !== user.password_hash) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
                if (playerId !== null) db.prepare('UPDATE invitations SET revoked_at = ? WHERE player_id = ? AND used_at IS NULL AND revoked_at IS NULL').run(now(), playerId);
                res.json(publicUser(findUserById.get(id)));
            } catch (error) { helpers.handleUserError(error, res, next); }
        });

        app.delete('/api/users/:id', requireAdmin, requireCsrf, (req, res, next) => {
            try {
                const id = Number(req.params.id);
                const user = findUserById.get(id);
                if (!user) return res.status(404).json({ error: 'Benutzer wurde nicht gefunden.' });
                if (user.role === 'admin') return res.status(400).json({ error: 'Der Master kann nicht gelöscht werden.' });
                db.prepare('DELETE FROM users WHERE id = ?').run(id);
                res.json({ success: true });
            } catch (error) { next(error); }
        });

        app.post('/api/players/:playerId/invitations', requireAdmin, requireCsrf, async (req, res, next) => {
            try {
                const playerId = helpers.validatePlayerBinding(req.params.playerId);
                if (db.prepare('SELECT 1 FROM users WHERE player_id = ?').get(playerId)) return res.status(409).json({ error: 'Dieser Spieler hat bereits ein Konto.' });
                const token = crypto.randomBytes(32).toString('base64url');
                const createdAt = now();
                const replace = db.transaction(() => {
                    db.prepare('UPDATE invitations SET revoked_at = ? WHERE player_id = ? AND used_at IS NULL AND revoked_at IS NULL').run(createdAt, playerId);
                    return db.prepare('INSERT INTO invitations (token_hash, player_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
                        .run(tokenHash(token), playerId, createdAt, createdAt + INVITATION_TTL_MS).lastInsertRowid;
                });
                const invitationId = replace.immediate();
                const configuredBase = String(helpers.publicBaseUrl || '').replace(/\/$/, '');
                const host = req.get('host');
                if (!configuredBase && (!host || !/^[A-Za-z0-9.:[\]-]+$/.test(host))) return res.status(400).json({ error: 'Ungültiger Host.' });
                const base = configuredBase || `${req.secure ? 'https' : 'http'}://${host}`;
                const inviteUrl = `${base}/?invite=${encodeURIComponent(token)}`;
                const qrSvg = await helpers.qrCode.toString(inviteUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#172033', light: '#ffffff' } });
                res.status(201).set('Cache-Control', 'no-store').json({ id: invitationId, playerId, expiresAt: createdAt + INVITATION_TTL_MS, inviteUrl, qrSvg });
            } catch (error) { helpers.handleUserError(error, res, next); }
        });

        app.delete('/api/invitations/:id', requireAdmin, requireCsrf, (req, res) => {
            const result = db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL').run(now(), Number(req.params.id));
            if (!result.changes) return res.status(404).json({ error: 'Aktive Einladung wurde nicht gefunden.' });
            res.json({ success: true });
        });

        app.get('/api/invitations', requireAdmin, (req, res) => {
            const players = new Map(helpers.readPlayers().map(player => [String(player.id), player.name]));
            const rows = db.prepare('SELECT id, player_id, created_at, expires_at FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC').all(now());
            res.json(rows.map(row => ({ id: row.id, playerId: row.player_id, playerName: players.get(row.player_id) || 'Gelöschter Spieler', createdAt: row.created_at, expiresAt: row.expires_at })));
        });

        app.get('/api/invitations/:token', (req, res) => {
            const invitation = db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(tokenHash(req.params.token));
            if (!invitation || invitation.used_at !== null || invitation.revoked_at !== null || invitation.expires_at <= now()) return res.status(410).json({ error: 'Einladung ist ungültig oder abgelaufen.' });
            const player = helpers.readPlayers().find(item => String(item?.id) === invitation.player_id);
            if (!player || db.prepare('SELECT 1 FROM users WHERE player_id = ?').get(invitation.player_id)) return res.status(410).json({ error: 'Einladung ist ungültig oder abgelaufen.' });
            res.set('Cache-Control', 'no-store').json({ playerName: player.name, expiresAt: invitation.expires_at });
        });

        app.post('/api/invitations/:token/register', async (req, res, next) => {
            try {
                const username = validateUsername(req.body?.username);
                const passwordHash = await hashPassword(req.body?.password);
                const register = db.transaction(() => {
                    const invitation = db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(tokenHash(req.params.token));
                    if (!invitation || invitation.used_at !== null || invitation.revoked_at !== null || invitation.expires_at <= now()) throw Object.assign(new Error('Einladung ist ungültig oder abgelaufen.'), { status: 410 });
                    if (!helpers.readPlayers().some(item => String(item?.id) === invitation.player_id)) throw Object.assign(new Error('Einladung ist ungültig oder abgelaufen.'), { status: 410 });
                    const result = db.prepare("INSERT INTO users (username, password_hash, role, player_id, created_at) VALUES (?, ?, 'user', ?, ?)")
                        .run(username, passwordHash, invitation.player_id, now());
                    db.prepare('UPDATE invitations SET used_at = ? WHERE id = ?').run(now(), invitation.id);
                    db.prepare('UPDATE invitations SET revoked_at = ? WHERE player_id = ? AND id <> ? AND used_at IS NULL AND revoked_at IS NULL').run(now(), invitation.player_id, invitation.id);
                    return result.lastInsertRowid;
                });
                const userId = register.immediate();
                const csrfToken = createSession(req, res, userId);
                res.status(201).json({ user: publicUser(findUserById.get(userId)), csrfToken });
            } catch (error) {
                if (error.status) return res.status(error.status).json({ error: error.message });
                helpers.handleUserError(error, res, next);
            }
        });
    }

    return { sessionMiddleware, requireAuth, requireAdmin, requireCsrf, installRoutes };
}

module.exports = { createAuth, hashPassword, verifyPassword, validatePassword, validateUsername, isPrivateAddress, SESSION_COOKIE };
