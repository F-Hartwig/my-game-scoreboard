import assert from 'node:assert/strict';

const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

async function request(path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { response, body };
}

const health = await request('/api/health');
assert.equal(health.response.status, 200);
assert.equal(health.body.status, 'ok');
assert.equal(health.body.schemaVersion, 5);

for (const endpoint of ['players', 'games', 'activeGames', 'currentGame', 'gameNights']) {
    const privateResult = await request(`/api/${endpoint}`);
    assert.equal(privateResult.response.status, 401, `${endpoint} anonymous GET must be private`);
    const previewResult = await request(`/api/${endpoint}?preview=1`);
    assert.equal(previewResult.response.status, 200, `${endpoint} preview GET failed`);
}

const anonymousWrite = await request('/api/players', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([])
});
assert.equal(anonymousWrite.response.status, 401);

assert.equal((await request('/api/favorites')).response.status, 401);
assert.equal((await request('/api/favorites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([])
})).response.status, 401);

const oversized = await request('/api/players', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ id: 1, name: 'x'.repeat(2_100_000) }])
});
assert.equal(oversized.response.status, 413);

console.log(`smoke ok: ${baseUrl}, schema=5, private=6, preview=5, anonymous-write=blocked, payload-limit=ok`);
