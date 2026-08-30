const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRuntime, validatePayload } = require('../server.js');

test('legacy-compatible payloads validate and malformed payloads fail', () => {
    const legacy = [{
        id: 1720000000000,
        name: 'Alice <Admin>',
        favorite: false,
        wins: 1,
        games: 2,
        points: -10
    }];
    assert.doesNotThrow(() => validatePayload('players', legacy));
    assert.throws(() => validatePayload('players', { bad: true }), /Array/);
    assert.throws(() => validatePayload('players', [{ id: -1, name: 'x' }]), /ID/);
    assert.throws(() => validatePayload('players', [{ id: 1, name: 'x'.repeat(81) }]), /lang/);
});

test('API migrates schema, persists state, validates and hides private files', async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scorebuddy-'));
    const dbPath = path.join(directory, 'scoreboard.db');
    const runtime = await createRuntime({ dbPath });
    const server = runtime.app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await runtime.close();
        await fs.rm(directory, { recursive: true, force: true });
    });

    const health = await fetch(`${base}/api/health`).then(response => response.json());
    assert.deepEqual(health, { status: 'ok', schemaVersion: 1 });

    const payload = [{ id: 123, name: '<img src=x onerror=alert(1)>', favorite: false }];
    let response = await fetch(`${base}/api/players`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await fetch(`${base}/api/players`).then(value => value.json()), payload);

    response = await fetch(`${base}/api/players`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nope: true })
    });
    assert.equal(response.status, 400);

    for (const privatePath of ['/server.js', '/package.json', '/scoreboard.db', '/Dockerfile']) {
        assert.equal((await fetch(`${base}${privatePath}`)).status, 404, privatePath);
    }
});
