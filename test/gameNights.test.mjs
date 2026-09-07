import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompletedGameNightStats, mergeGameNightParticipantIds, rankGameNight } from '../gameNightRanking.mjs';

test('game-night ranking uses wins and shared positions only', () => {
  const result = rankGameNight({ participantIds: [1, 2, 3] }, [
    { gameNightId: 'n', rated: true, winnerPartyIds: [10], players: [
      { id: 10, playerIds: [1] }, { id: 11, playerIds: [2] }, { id: 12, playerIds: [3] }
    ] },
    { gameNightId: 'n', rated: true, winnerPartyIds: [11], players: [
      { id: 10, playerIds: [1] }, { id: 11, playerIds: [2] }, { id: 12, playerIds: [3] }
    ] }
  ], [{ id: 1, name: 'Berta' }, { id: 2, name: 'Anton' }, { id: 3, name: 'Clara' }], 'n');
  assert.deepEqual(result.map(row => [row.name, row.wins, row.ratedGames, row.position]), [
    ['Anton', 1, 2, 1], ['Berta', 1, 2, 1], ['Clara', 0, 2, 3]
  ]);
});

test('ranking supports teams, unrated games and legacy winners', () => {
  const result = rankGameNight({ participantIds: [1, 2, 3, 4] }, [
    { gameNightId: 'n', rated: true, winner: 'Team A', players: [
      { id: 10, name: 'Team A', isTeam: true, playerIds: [1, 2] }, { id: 11, name: 'C', playerIds: [3] }, { id: 12, name: 'D', playerIds: [4] }
    ] },
    { gameNightId: 'n', rated: true, winner: 'Unentschieden', players: [
      { id: 10, name: 'Team A', isTeam: true, playerIds: [1, 2] }, { id: 11, name: 'C', playerIds: [3] }, { id: 12, name: 'D', playerIds: [4] }
    ] },
    { gameNightId: 'n', rated: false, winnerPartyIds: [11], players: [{ id: 11, playerIds: [3] }] }
  ], [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }, { id: 4, name: 'D' }], 'n');
  assert.deepEqual(result.map(row => [row.name, row.wins, row.ratedGames, row.activityGames, row.position]), [
    ['A', 1, 2, 2, 1], ['B', 1, 2, 2, 1], ['C', 0, 2, 3, 3], ['D', 0, 2, 2, 3]
  ]);
});

test('ranking treats persisted numeric and string game-night IDs as identical', () => {
  const night = { id: 7, participantIds: [1, 2] };
  const games = [{ gameNightId: '7', rated: true, winnerPartyIds: [1], players: [
    { id: 1, playerIds: [1] }, { id: 2, playerIds: [2] }
  ] }];
  const rows = rankGameNight(night, games, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
  assert.equal(rows[0].wins, 1);
  assert.equal(rows[0].ratedGames, 1);
  assert.equal(rows[0].position, 1);
});

test('completed game-night stats award every shared first place via the existing ranking', () => {
  const players = [{ id: 1, name: 'Anna' }, { id: 2, name: 'Berta' }, { id: 3, name: 'Clara' }];
  const nights = [
    { id: 'a', status: 'completed', participantIds: [1, 2, 3] },
    { id: 'b', status: 'completed', participantIds: [1, 2] },
    { id: 'active', status: 'active', participantIds: [3] }
  ];
  const games = [
    { gameNightId: 'a', rated: true, winnerPartyIds: [10], players: [{ id: 10, playerIds: [1] }, { id: 11, playerIds: [2] }, { id: 12, playerIds: [3] }] },
    { gameNightId: 'a', rated: true, winnerPartyIds: [11], players: [{ id: 10, playerIds: [1] }, { id: 11, playerIds: [2] }, { id: 12, playerIds: [3] }] },
    { gameNightId: 'b', rated: true, winnerPartyIds: [20], players: [{ id: 20, playerIds: [1] }, { id: 21, playerIds: [2] }] }
  ];
  const stats = getCompletedGameNightStats(nights, games, players);
  assert.deepEqual(stats.map(player => [player.name, player.wins, player.games]), [
    ['Anna', 2, 2], ['Berta', 1, 2], ['Clara', 0, 1]
  ]);
});

test('adding game-night participants preserves existing IDs and appends selections once', () => {
  assert.deepEqual(mergeGameNightParticipantIds([1, '2'], [2, 3, '3']), [1, 2, 3]);
  assert.deepEqual(mergeGameNightParticipantIds([1, 2], []), [1, 2]);
});
