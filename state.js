import { apiFetch, getApiSaveVersion, hasActiveApiSaves } from './api.js';
import { findPreviewGame } from './preview-selection.mjs';

export const state = {
    players: [],
    games: [],
    activeGames: [],
    favoritePlayerIds: [],
    currentGame: null,
    activeEditPlayerId: null,
    showAllHistory: false,
    autoRefreshInterval: null,
    isSettingUpGame: false,
    lastRenderedGameId: null, 
    ratedMode: true
};

let latestLoadRequestId = 0;

function stateSnapshot(value) {
    try {
        return JSON.stringify(value);
    } catch (error) {
        console.error("State konnte nicht verglichen werden:", error);
        return null;
    }
}

function currentGameViewSnapshot(game) {
    if (!game || Array.isArray(game) || typeof game !== "object") return stateSnapshot(game);
    const { wizardDraft, ...visibleGameState } = game;
    return stateSnapshot(visibleGameState);
}

export function applyFavoriteSelection(players) {
    const favoriteIds = new Set(state.favoritePlayerIds);
    return players.map(player => ({ ...player, favorite: favoriteIds.has(String(player.id)) }));
}

export async function loadAllFromDb(shouldAbort = null) {
    const unchangedResult = {
        loaded: false,
        playersChanged: false,
        gamesChanged: false,
        activeGamesChanged: false,
        favoritesChanged: false,
        currentGameChanged: false
    };

    if (state.isSettingUpGame || hasActiveApiSaves()) return unchangedResult;

    const requestId = ++latestLoadRequestId;
    const saveVersionAtStart = getApiSaveVersion();
    const previousState = {
        players: stateSnapshot(state.players),
        games: stateSnapshot(state.games),
        activeGames: stateSnapshot(state.activeGames),
        favorites: stateSnapshot(state.favoritePlayerIds),
        currentGame: currentGameViewSnapshot(state.currentGame)
    };

    const selectedGameId = state.currentGame?.id;
    const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
    const [players, games, activeGames, favorites] = await Promise.all([
        apiFetch('players'),
        apiFetch('games'),
        apiFetch('activeGames'),
        isPreview ? Promise.resolve([]) : apiFetch('favorites')
    ]);

    const loadBecameStale = (
        requestId !== latestLoadRequestId ||
        state.isSettingUpGame ||
        hasActiveApiSaves() ||
        getApiSaveVersion() !== saveVersionAtStart ||
        shouldAbort?.()
    );
    if (loadBecameStale) return unchangedResult;

    if (Array.isArray(favorites)) state.favoritePlayerIds = favorites.map(String);
    if (Array.isArray(players)) state.players = applyFavoriteSelection(players);
    if (Array.isArray(games)) state.games = games;
    if (Array.isArray(activeGames)) {
        state.activeGames = activeGames;
        if (new URLSearchParams(window.location.search).get('preview') === '1') {
            state.currentGame = findPreviewGame(activeGames, selectedGameId);
        } else if (selectedGameId !== undefined) {
            state.currentGame = activeGames.find(game => String(game.id) === String(selectedGameId)) || null;
        }
    }
    if (Array.isArray(state.currentGame) && state.currentGame.length === 0) state.currentGame = null;
    if (state.currentGame && Object.keys(state.currentGame).length === 0) state.currentGame = null;

    return {
        loaded: true,
        playersChanged: previousState.players !== stateSnapshot(state.players),
        gamesChanged: previousState.games !== stateSnapshot(state.games),
        activeGamesChanged: previousState.activeGames !== stateSnapshot(state.activeGames),
        favoritesChanged: previousState.favorites !== stateSnapshot(state.favoritePlayerIds),
        currentGameChanged: previousState.currentGame !== currentGameViewSnapshot(state.currentGame)
    };
}
