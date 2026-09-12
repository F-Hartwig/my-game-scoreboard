function playerParty(game, playerId) {
    return (game?.players || []).find(party => (
        party?.playerIds || [party?.id]
    ).some(id => String(id) === String(playerId)));
}

function partyWon(game, party) {
    if (!party) return false;
    if (Array.isArray(game?.winnerPartyIds)) {
        return game.winnerPartyIds.some(id => String(id) === String(party.id));
    }
    if (game?.winner === 'Unentschieden') return false;
    return String(game?.winner || '')
        .split(' + ')
        .map(name => name.trim())
        .includes(String(party.name || '').trim());
}

function gameResultForPlayer(game, playerId) {
    const party = playerParty(game, playerId);
    if (!party) return null;
    if (game.winner === 'Unentschieden') return 'draw';
    return partyWon(game, party) ? 'win' : 'loss';
}

function sameParty(a, b) {
    return String(a?.id) === String(b?.id);
}

export function buildPersonalStats(playerId, players = [], games = []) {
    const player = players.find(item => String(item?.id) === String(playerId));
    if (!player) return null;

    const personalGames = games
        .filter(game => game?.rated !== false)
        .map(game => ({ game, party: playerParty(game, playerId) }))
        .filter(entry => entry.party);

    const results = personalGames.map(({ game, party }) => (
        game.winner === 'Unentschieden' ? 'draw' : (partyWon(game, party) ? 'win' : 'loss')
    ));
    const wins = results.filter(result => result === 'win').length;
    let currentWinStreak = 0;
    for (const result of [...results].reverse()) {
        if (result !== 'win') break;
        currentWinStreak += 1;
    }

    const frequency = new Map();
    personalGames.forEach(({ game }) => {
        const name = String(game.name || 'Unbekanntes Spiel').trim();
        frequency.set(name, (frequency.get(name) || 0) + 1);
    });
    const favoriteGame = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))[0] || null;

    const ranked = [...players]
        .filter(item => Number(item.games) > 0)
        .sort((a, b) => (
            (Number(b.wins) || 0) - (Number(a.wins) || 0)
            || (Number(b.games) || 0) - (Number(a.games) || 0)
            || String(a.name).localeCompare(String(b.name), 'de')
        ));
    const rankIndex = ranked.findIndex(item => String(item.id) === String(playerId));

    return {
        player,
        games: personalGames.length,
        wins,
        winRate: personalGames.length ? Math.round((wins / personalGames.length) * 100) : 0,
        currentWinStreak,
        favoriteGame: favoriteGame ? { name: favoriteGame[0], games: favoriteGame[1] } : null,
        recentForm: results.slice(-5).reverse(),
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        rankedPlayers: ranked.length
    };
}

export function buildPersonalDashboard(playerId, players = [], activeGames = [], games = []) {
    const player = players.find(item => String(item?.id) === String(playerId));
    if (!player) return null;

    const openGames = activeGames.filter(game => playerParty(game, playerId));
    const completed = games
        .filter(game => playerParty(game, playerId))
        .slice(-3)
        .reverse()
        .map(game => ({
            id: game.id,
            name: game.name || 'Unbekanntes Spiel',
            date: game.date || '',
            result: game.rated === false ? 'friendly' : gameResultForPlayer(game, playerId)
        }));

    const frequency = new Map();
    games.filter(game => playerParty(game, playerId)).forEach(game => {
        const ids = new Set();
        (game.players || []).forEach(party => (party.playerIds || [party.id]).forEach(id => ids.add(String(id))));
        ids.delete(String(playerId));
        ids.forEach(id => frequency.set(id, (frequency.get(id) || 0) + 1));
    });
    const frequentPlayers = [...frequency.entries()]
        .map(([id, count]) => ({ player: players.find(item => String(item.id) === id), count }))
        .filter(entry => entry.player)
        .sort((a, b) => b.count - a.count || String(a.player.name).localeCompare(String(b.player.name), 'de'))
        .slice(0, 3);

    return { player, openGames, completed, frequentPlayers };
}

export function buildHeadToHeadStats(playerId, opponentId, games = []) {
    const duels = games.filter(game => {
        if (game?.rated === false) return false;
        const ownParty = playerParty(game, playerId);
        const opponentParty = playerParty(game, opponentId);
        return ownParty && opponentParty && !sameParty(ownParty, opponentParty);
    });
    let wins = 0;
    let losses = 0;
    let draws = 0;
    duels.forEach(game => {
        if (game.winner === 'Unentschieden') draws += 1;
        else if (gameResultForPlayer(game, playerId) === 'win') wins += 1;
        else losses += 1;
    });
    return { games: duels.length, wins, losses, draws };
}
