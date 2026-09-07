function partyIds(party) {
  return Array.isArray(party?.playerIds)
    ? party.playerIds.map(Number).filter(Number.isFinite)
    : [Number(party?.id)].filter(Number.isFinite);
}

export function getWinnerPartyIds(game) {
  if (Array.isArray(game?.winnerPartyIds)) return game.winnerPartyIds.map(Number).filter(Number.isFinite);
  if (!game || game.winner === 'Unentschieden' || !Array.isArray(game.players)) return [];
  const names = String(game.winner || '').split(' + ').map(name => name.trim()).filter(Boolean);
  return game.players.filter(party => names.includes(party.name)).map(party => Number(party.id)).filter(Number.isFinite);
}

export function rankGameNight(night, games, players, nightId = night?.id) {
  const participants = new Set((night?.participantIds || []).map(Number).filter(Number.isFinite));
  const rows = (players || [])
    .filter(player => participants.has(Number(player.id)))
    .map(player => ({
      id: Number(player.id),
      name: String(player.name || ''),
      wins: 0,
      ratedGames: 0,
      activityGames: 0,
      position: 1
    }));
  const byId = new Map(rows.map(row => [row.id, row]));

  for (const game of games || []) {
    if (String(game?.gameNightId) !== String(nightId) || !Array.isArray(game.players)) continue;
    const winners = new Set(getWinnerPartyIds(game));
    for (const party of game.players) {
      for (const id of partyIds(party)) {
        const row = byId.get(id);
        if (!row) continue;
        row.activityGames++;
        if (game.rated === false) continue;
        row.ratedGames++;
        if (winners.has(Number(party.id))) row.wins++;
      }
    }
  }

  rows.sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'de'));
  rows.forEach((row, index) => {
    row.position = index > 0 && row.wins === rows[index - 1].wins
      ? rows[index - 1].position
      : index + 1;
  });
  return rows;
}

export function getCompletedGameNightStats(gameNights, games, players) {
  const statsById = new Map((players || []).map(player => [Number(player.id), {
    ...player,
    wins: 0,
    games: 0,
    points: 0
  }]));

  for (const night of gameNights || []) {
    if (night?.status !== 'completed') continue;
    for (const row of rankGameNight(night, games, players, night.id)) {
      const stats = statsById.get(Number(row.id));
      if (!stats) continue;
      stats.games++;
      if (row.position === 1) stats.wins++;
    }
  }

  return [...statsById.values()].filter(player => player.games > 0);
}

export function mergeGameNightParticipantIds(currentIds, addedIds) {
  const merged = [];
  const seen = new Set();
  for (const id of [...(currentIds || []), ...(addedIds || [])]) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || seen.has(numericId)) continue;
    seen.add(numericId);
    merged.push(numericId);
  }
  return merged;
}
