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
assert.equal(health.body.schemaVersion, 1);

for (const endpoint of ['players', 'games', 'activeGames', 'currentGame']) {
    const result = await request(`/api/${endpoint}`);
    assert.equal(result.response.status, 200, `${endpoint} GET failed`);
}

const invalid = await request('/api/players', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ not: 'an array' })
});
assert.equal(invalid.response.status, 400);

const oversizedName = await request('/api/players', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([{ id: 1, name: 'x'.repeat(81) }])
});
assert.equal(oversizedName.response.status, 400);

console.log(`smoke ok: ${baseUrl}, schema=1, reads=4, validation=2`);
