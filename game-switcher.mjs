function sameId(left, right) {
    return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right);
}

export function playerEntryHasPlayer(player, playerId) {
    if (playerId === undefined || playerId === null) return false;
    return Boolean(player) && (
        sameId(player?.id, playerId) ||
        (Array.isArray(player?.playerIds) && player.playerIds.some(id => sameId(id, playerId)))
    );
}

export function gameHasPlayer(game, playerId) {
    return Array.isArray(game?.players) && game.players.some(player => playerEntryHasPlayer(player, playerId));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

export function getGameSwitcherItems(activeGames, currentGameId, ownPlayerId) {
    if (!Array.isArray(activeGames)) return [];

    return activeGames
        .map((game, index) => ({
            game,
            index,
            isOwn: gameHasPlayer(game, ownPlayerId),
            isCurrent: sameId(game?.id, currentGameId)
        }))
        .sort((left, right) => Number(right.isOwn) - Number(left.isOwn) || left.index - right.index);
}

export function renderGameSwitcherItems(items) {
    return items.map(({ game, isOwn, isCurrent }) => `
        <button type="button" class="game-switcher-item${isCurrent ? ' is-current' : ''}" data-game-switcher-id="${escapeHtml(String(game.id))}" aria-current="${isCurrent ? 'true' : 'false'}">
            <span class="game-switcher-item__name">${escapeHtml(game.name || 'Unbenannte Partie')}</span>
            ${isOwn ? '<span class="game-switcher-item__self">Du</span>' : ''}
        </button>`).join('');
}
