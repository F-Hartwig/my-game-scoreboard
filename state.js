import { apiFetch, getApiSaveVersion, hasActiveApiSaves } from './api.js';

export const state = {
    players: [],
    games: [],
    activeGames: [],
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

export async function loadAllFromDb() {
    const unchangedResult = {
        loaded: false,
        playersChanged: false,
        gamesChanged: false,
        activeGamesChanged: false,
        currentGameChanged: false
    };

    if (state.isSettingUpGame || hasActiveApiSaves()) return unchangedResult;

    const requestId = ++latestLoadRequestId;
    const saveVersionAtStart = getApiSaveVersion();
    const previousState = {
        players: stateSnapshot(state.players),
        games: stateSnapshot(state.games),
        activeGames: stateSnapshot(state.activeGames),
        currentGame: currentGameViewSnapshot(state.currentGame)
    };

    const [players, games, activeGames, currentGame] = await Promise.all([
        apiFetch('players'),
        apiFetch('games'),
        apiFetch('activeGames'),
        apiFetch('currentGame')
    ]);

    const loadBecameStale = (
        requestId !== latestLoadRequestId ||
        state.isSettingUpGame ||
        hasActiveApiSaves() ||
        getApiSaveVersion() !== saveVersionAtStart
    );
    if (loadBecameStale) return unchangedResult;

    if (Array.isArray(players)) state.players = players;
    if (Array.isArray(games)) state.games = games;
    if (Array.isArray(activeGames)) state.activeGames = activeGames;
    if (currentGame !== undefined) state.currentGame = currentGame;
    
    if (Array.isArray(state.currentGame) && state.currentGame.length === 0) state.currentGame = null;
    if (state.currentGame && Object.keys(state.currentGame).length === 0) state.currentGame = null;

    return {
        loaded: true,
        playersChanged: previousState.players !== stateSnapshot(state.players),
        gamesChanged: previousState.games !== stateSnapshot(state.games),
        activeGamesChanged: previousState.activeGames !== stateSnapshot(state.activeGames),
        currentGameChanged: previousState.currentGame !== currentGameViewSnapshot(state.currentGame)
    };
}
