export function findPreviewGame(activeGames, selectedGameId) {
    if (!Array.isArray(activeGames) || activeGames.length === 0) return null;

    if (selectedGameId !== undefined && selectedGameId !== null) {
        const selectedGame = activeGames.find(game => String(game?.id) === String(selectedGameId));
        if (selectedGame) return selectedGame;
    }

    return activeGames[0] || null;
}
