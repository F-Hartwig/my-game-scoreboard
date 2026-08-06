import { apiFetch } from './api.js';

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

export async function loadAllFromDb() {
    if (state.isSettingUpGame) return;

    const [players, games, activeGames, currentGame] = await Promise.all([
        apiFetch('players'),
        apiFetch('games'),
        apiFetch('activeGames'),
        apiFetch('currentGame')
    ]);

    if (Array.isArray(players)) state.players = players;
    if (Array.isArray(games)) state.games = games;
    if (Array.isArray(activeGames)) state.activeGames = activeGames;
    if (currentGame !== undefined) state.currentGame = currentGame;
    
    if (Array.isArray(state.currentGame) && state.currentGame.length === 0) state.currentGame = null;
    if (state.currentGame && Object.keys(state.currentGame).length === 0) state.currentGame = null;
}
