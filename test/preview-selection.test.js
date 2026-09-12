const test = require('node:test');
const assert = require('node:assert/strict');

test('preview selection keeps the selected active game and falls back safely', async () => {
    const { findPreviewGame } = await import('../preview-selection.mjs');
    const games = [{ id: 'one', name: 'Spiel 1' }, { id: 2, name: 'Spiel 2' }];

    assert.equal(findPreviewGame(games, 2), games[1]);
    assert.equal(findPreviewGame(games, 'missing'), games[0]);
    assert.equal(findPreviewGame([], 'one'), null);
    assert.equal(findPreviewGame(null, 'one'), null);
});