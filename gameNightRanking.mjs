function partyIds(party) {
  return Array.isArray(party?.playerIds) ? party.playerIds.map(Number).filter(Number.isFinite) : [Number(party?.id)].filter(Number.isFinite);
}

export function getWinnerPartyIds(game) {
  if (Array.isArray(game?.winnerPartyIds)) return game.winnerPartyIds.map(Number).filter(Number.isFinite);
  if (!game || game.winner === 'Unentschieden' || !Array.isArray(game.players)) return [];
  const names = String(game.winner || '').split(' + ').map(name => name.trim()).filter(Boolean);
  return game.players.filter(party => names.includes(party.name)).map(party => Number(party.id)).filter(Number.isFinite);
}

function placements(game) {
  const parties = Array.isArray(game?.players) ? [...game.players] : [];
  const lowest = game?.rules?.winCondition === 'lowest' || game?.rules?.winCondition === 'low';
  parties.sort((a, b) => lowest ? Number(a.total || 0) - Number(b.total || 0) : Number(b.total || 0) - Number(a.total || 0));
  let rank = 1;
  return parties.map((party, index) => {
    if (index && Number(party.total || 0) !== Number(parties[index - 1].total || 0)) rank = index + 1;
    return { party, rank };
  });
}

export function rankGameNight(night, games, players, nightId = night?.id) {
  const participants = new Set((night?.participantIds || []).map(Number).filter(Number.isFinite));
  const rows = (players || []).filter(player => participants.has(Number(player.id))).map(player => ({
    id: Number(player.id), name: String(player.name || ''), wins: 0, ratedGames: 0, activityGames: 0, placementTotal: 0, averagePlacement: null
  }));
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const game of games || []) {
    if (String(game?.gameNightId) !== String(nightId) || !Array.isArray(game.players)) continue;
    const inGame = new Set();
    for (const party of game.players) for (const id of partyIds(party)) if (byId.has(id)) inGame.add(id);
    for (const id of inGame) byId.get(id).activityGames++;
    if (game.rated === false) continue;
    const winners = new Set(getWinnerPartyIds(game));
    for (const { party, rank } of placements(game)) {
      for (const id of partyIds(party)) {
        const row = byId.get(id);
        if (!row) continue;
        row.ratedGames++;
        row.placementTotal += rank;
        if (winners.has(Number(party.id))) row.wins++;
      }
    }
  }
  for (const row of rows) row.averagePlacement = row.ratedGames ? row.placementTotal / row.ratedGames : null;
  return rows.sort((a, b) => b.wins - a.wins || (a.averagePlacement ?? Infinity) - (b.averagePlacement ?? Infinity) || b.ratedGames - a.ratedGames || a.name.localeCompare(b.name, 'de'));
}
