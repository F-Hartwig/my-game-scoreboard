import test from 'node:test';
import assert from 'node:assert/strict';
import { sortSetupPlayersByLastParticipation } from '../setup-player-order.mjs';

test('setup players are ordered by their most recent completed participation and keep never-played order', () => {
    const players = [
        { id: 1, name: 'Anna' },
        { id: 2, name: 'Ben' },
        { id: 3, name: 'Cara' },
        { id: 4, name: 'Dora' },
        { id: 5, name: 'Emil' }
    ];
    const games = [
        { players: [{ playerIds: [1, 2] }] },
        { players: [{ playerIds: [3] }, { playerIds: [1, 4] }] },
        { players: [{ playerIds: [2] }] }
    ];

    assert.deepEqual(
        sortSetupPlayersByLastParticipation(players, games).map(player => player.name),
        ['Ben', 'Anna', 'Cara', 'Dora', 'Emil']
    );
});
