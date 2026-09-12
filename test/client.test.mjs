import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const clientFiles = ['app.js', 'state.js', 'index.html', 'style.css'];

test('client no longer loads, creates or renders game nights', async () => {
  for (const file of clientFiles) {
    const source = await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /gameNights?|game-night|Spieleabend/i, file);
  }
});

test('new and repeated games have no game-night assignment', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /gameNightId/);
  assert.match(source, /function startSetup\(prefillGame = null\)/);
  assert.match(source, /function startRematch\(\)/);
});

test('app and API share one auth module instance for CSRF state', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const apiSource = await fs.readFile(new URL('../api.js', import.meta.url), 'utf8');
  const authImport = /from ['"](\.\/auth-client\.js[^'"]*)['"]/;

  assert.equal(appSource.match(authImport)?.[1], './auth-client.js');
  assert.equal(apiSource.match(authImport)?.[1], './auth-client.js');
});

test('user bindings save directly from the select without a confirmation button', async () => {
  const source = await fs.readFile(new URL('../auth-client.js', import.meta.url), 'utf8');

  assert.match(source, /onchange="saveUserBinding\(\$\{user\.id\}, this\)"/);
  assert.doesNotMatch(source, /class="icon-btn edit-btn"/);
  assert.match(source, /select\.value = previousValue/);
});