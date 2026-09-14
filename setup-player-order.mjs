export function sortSetupPlayersByLastParticipation(players, games) {
    const lastParticipationByPlayerId = new Map();

    (Array.isArray(games) ? games : []).forEach((game, gameIndex) => {
        (game.players || []).forEach(party => {
            (party.playerIds || [party.id]).forEach(playerId => {
                lastParticipationByPlayerId.set(String(playerId), gameIndex);
            });
        });
    });

    return (Array.isArray(players) ? players : [])
        .map((player, originalIndex) => ({
            player,
            originalIndex,
            lastParticipation: lastParticipationByPlayerId.get(String(player.id)) ?? -1
        }))
        .sort((a, b) => b.lastParticipation - a.lastParticipation || a.originalIndex - b.originalIndex)
        .map(({ player }) => player);
}
