const test = require('node:test');
const assert = require('node:assert/strict');

test('personal stats include teams, rated games, streak and recent form', async () => {
    const { buildPersonalStats } = await import('../personal-stats.mjs');
    const players = [
        { id: 1, name: 'Anna', wins: 2, games: 3 },
        { id: 2, name: 'Ben', wins: 1, games: 3 },
        { id: 3, name: 'Cara', wins: 0, games: 1 }
    ];
    const games = [
        { name: 'Cabo', rated: true, winnerPartyIds: [10], players: [{ id: 10, name: 'Team A', playerIds: [1, 2] }, { id: 3, name: 'Cara', playerIds: [3] }] },
        { name: 'Cabo', rated: false, winnerPartyIds: [3], players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 3, name: 'Cara', playerIds: [3] }] },
        { name: 'Wizard', rated: true, winner: 'Ben', players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 2, name: 'Ben', playerIds: [2] }] },
        { name: 'Cabo', rated: true, winnerPartyIds: [1], players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 2, name: 'Ben', playerIds: [2] }] },
        { name: 'Cabo', rated: true, winnerPartyIds: [1], players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 2, name: 'Ben', playerIds: [2] }] }
    ];

    const stats = buildPersonalStats('1', players, games);
    assert.equal(stats.games, 4);
    assert.equal(stats.wins, 3);
    assert.equal(stats.winRate, 75);
    assert.equal(stats.currentWinStreak, 2);
    assert.deepEqual(stats.favoriteGame, { name: 'Cabo', games: 3 });
    assert.deepEqual(stats.recentForm, ['win', 'win', 'loss', 'win']);
    assert.equal(stats.rank, 1);
    assert.equal(stats.rankedPlayers, 3);
});

test('personal stats stay hidden for an unlinked or unknown player', async () => {
    const { buildPersonalStats } = await import('../personal-stats.mjs');
    assert.equal(buildPersonalStats(null, [{ id: 1, name: 'Anna' }], []), null);
    assert.equal(buildPersonalStats(2, [{ id: 1, name: 'Anna' }], []), null);
});

test('dashboard and head-to-head use the linked player across teams', async () => {
    const { buildPersonalDashboard, buildHeadToHeadStats } = await import('../personal-stats.mjs');
    const players = [{ id: 1, name: 'Anna' }, { id: 2, name: 'Ben' }, { id: 3, name: 'Cara' }];
    const active = [{ id: 9, name: 'Offen', players: [{ id: 10, playerIds: [1, 3] }, { id: 2, playerIds: [2] }] }];
    const games = [
        { id: 1, name: 'Cabo', rated: true, winnerPartyIds: [1], players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 2, name: 'Ben', playerIds: [2] }] },
        { id: 2, name: 'Wizard', rated: true, winnerPartyIds: [20], players: [{ id: 20, name: 'Team', playerIds: [1, 2] }, { id: 3, name: 'Cara', playerIds: [3] }] },
        { id: 3, name: 'Cabo', rated: true, winner: 'Unentschieden', players: [{ id: 1, name: 'Anna', playerIds: [1] }, { id: 2, name: 'Ben', playerIds: [2] }] }
    ];
    const dashboard = buildPersonalDashboard(1, players, active, games);
    assert.deepEqual(dashboard.openGames.map(game => game.id), [9]);
    assert.equal(dashboard.completed.length, 3);
    assert.equal(dashboard.frequentPlayers[0].player.name, 'Ben');
    assert.deepEqual(buildHeadToHeadStats(1, 2, games), { games: 2, wins: 1, losses: 0, draws: 1 });
});
