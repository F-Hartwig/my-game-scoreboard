import test from 'node:test';
import assert from 'node:assert/strict';
import { rankGameNight } from '../gameNightRanking.mjs';

test('game-night ranking uses wins, average placement, rated count and name', () => {
  const result = rankGameNight({ participantIds: [1, 2, 3] }, [
    { gameNightId: 'n', rated: true, winnerPartyIds: [10], rules: { winCondition: 'highest' }, players: [
      { id: 10, playerIds: [1], total: 9 }, { id: 11, playerIds: [2], total: 7 }, { id: 12, playerIds: [3], total: 1 }
    ] },
    { gameNightId: 'n', rated: true, winnerPartyIds: [11], rules: { winCondition: 'highest' }, players: [
      { id: 10, playerIds: [1], total: 2 }, { id: 11, playerIds: [2], total: 9 }, { id: 12, playerIds: [3], total: 1 }
    ] }
  ], [{ id: 1, name: 'Berta' }, { id: 2, name: 'Anton' }, { id: 3, name: 'Clara' }], 'n');
  assert.deepEqual(result.map(row => [row.name, row.wins, row.averagePlacement, row.ratedGames]), [
    ['Anton', 1, 1.5, 2], ['Berta', 1, 1.5, 2], ['Clara', 0, 3, 2]
  ]);
});

test('ranking supports lowest scores, shared places, teams, unrated and legacy winners', () => {
  const result = rankGameNight({ participantIds: [1, 2, 3, 4] }, [
    { gameNightId: 'n', rated: true, winner: 'Team A', rules: { winCondition: 'lowest' }, players: [
      { id: 10, name: 'Team A', isTeam: true, playerIds: [1, 2], total: 3 }, { id: 11, name: 'C', playerIds: [3], total: 8 }, { id: 12, name: 'D', playerIds: [4], total: 8 }
    ] },
    { gameNightId: 'n', rated: true, winner: 'Unentschieden', rules: { winCondition: 'highest' }, players: [
      { id: 10, name: 'Team A', isTeam: true, playerIds: [1, 2], total: 5 }, { id: 11, name: 'C', playerIds: [3], total: 5 }, { id: 12, name: 'D', playerIds: [4], total: 1 }
    ] },
    { gameNightId: 'n', rated: false, winnerPartyIds: [11], players: [{ id: 11, playerIds: [3], total: 1 }] }
  ], [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }], 'n');
  assert.deepEqual(result.map(row => [row.name, row.wins, row.averagePlacement, row.ratedGames, row.activityGames]), [
    ['A', 1, 1, 2, 2], ['B', 1, 1, 2, 2], ['C', 0, 1.5, 2, 3], ['D', 0, 2.5, 2, 2]
  ]);
});

test('ranking treats persisted numeric and string game-night IDs as identical', () => {
  const night = { id: 7, participantIds: [1, 2] };
  const games = [{ gameNightId: '7', rated: true, rules: { winCondition: 'highest' }, winnerPartyIds: [1], players: [
    { id: 1, playerIds: [1], total: 5 }, { id: 2, playerIds: [2], total: 1 }
  ] }];
  const rows = rankGameNight(night, games, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  assert.equal(rows[0].wins, 1);
  assert.equal(rows[0].ratedGames, 1);
});
