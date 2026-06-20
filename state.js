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

    state.players = await apiFetch('players');
    state.games = await apiFetch('games');
    state.activeGames = await apiFetch('activeGames');
    state.currentGame = await apiFetch('currentGame');
    
    if (Array.isArray(state.currentGame) && state.currentGame.length === 0) state.currentGame = null;
    if (state.currentGame && Object.keys(state.currentGame).length === 0) state.currentGame = null;
}