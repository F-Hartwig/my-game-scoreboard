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