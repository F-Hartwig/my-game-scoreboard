// Globaler State der Anwendung
let players = [];
let games = [];
let activeGames = [];
let currentGame = null;
let activeEditPlayerId = null;
let showAllHistory = false;
let autoRefreshInterval = null;
let isSettingUpGame = false;
let lastRenderedGameId = null; 
let ratedMode = true;

// Vorgefertigte Spiele mit festen Regeln
const PREDEFINED_GAMES = {
    cabo: {
        name: "Cabo",
        mode: "round",
        winCondition: "low", // Wenigste Punkte gewinnen
        hasLimit: true,
        limitValue: 101,    // Ab 101 Punkten ist Schluss
        hasResetRule: true,
        resetTrigger: 100,  // Exakt 100 Punkte
        resetTarget: 50     // Fällt auf 50 zurück
    }
};