import test from 'node:test';
import assert from 'node:assert/strict';

const { gameHasPlayer, getGameSwitcherItems, playerEntryHasPlayer, renderGameSwitcherItems } = await import('../game-switcher.mjs');

test('game switcher prioritizes own games and marks the current game', () => {
    const games = [
        { id: 'neutral', name: 'Neutral', players: [{ id: 3 }] },
        { id: 'team', name: 'Team', players: [{ playerIds: [7, 9] }] },
        { id: 'own', name: 'Mein Spiel', players: [{ id: 7 }] }
    ];

    const items = getGameSwitcherItems(games, 'team', 7);
    assert.deepEqual(items.map(item => item.game.id), ['team', 'own', 'neutral']);
    assert.equal(items[0].isOwn, true);
    assert.equal(items[0].isCurrent, true);
    assert.equal(items[2].isOwn, false);
    assert.match(renderGameSwitcherItems(items), /game-switcher-item is-current/);
    assert.match(renderGameSwitcherItems(items), /game-switcher-item__self">Du/);
});

test('game switcher safely handles empty input and escapes game names', () => {
    assert.deepEqual(getGameSwitcherItems(null, null, 7), []);
    const html = renderGameSwitcherItems(getGameSwitcherItems([{ id: 1, name: '<Spiel>', players: [] }], null, 7));
    assert.match(html, /&lt;Spiel&gt;/);
});

test('shared player membership handles individuals and teams', () => {
    assert.equal(playerEntryHasPlayer({ id: 7 }, '7'), true);
    assert.equal(playerEntryHasPlayer({ id: 70, playerIds: [7, 9] }, 7), true);
    assert.equal(playerEntryHasPlayer({ id: 70, playerIds: [8, 9] }, 7), false);
    assert.equal(gameHasPlayer({ players: [{ playerIds: [3, 7] }] }, 7), true);
    assert.equal(gameHasPlayer({ players: [{ id: 3 }] }, 7), false);
});
