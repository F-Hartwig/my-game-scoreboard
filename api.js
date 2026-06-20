// ==========================================
// API LOGIC (MIT AUTOMATISCHEM OFFLINE-MOCK)
// ==========================================

// Erkennt, ob wir im reinen Frontend-Vorschau-Modus (z.B. Live Server) sind
const IS_PREVIEW_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Hilfsfunktion für den lokalen Speicher (Fallback ohne DB)
function localMockSave(key, data) {
    localStorage.setItem('mock_' + key, JSON.stringify(data));
}
function localMockFetch(key) {
    const data = localStorage.getItem('mock_' + key);
    return data ? JSON.parse(data) : null;
}

// API-Abfragen
async function apiFetch(endpoint) {
    if (IS_PREVIEW_MODE) {
        // Im Vorschau-Modus direkt aus dem Browser-Speicher lesen
        const mockData = localMockFetch(endpoint);
        if (mockData !== null) return mockData;
        if (endpoint === 'currentGame') return null;
        return [];
    }

    try {
        const res = await fetch(`/api/${endpoint}`);
        return await res.json();
    } catch (e) {
        console.warn("Server nicht erreichbar, nutze lokalen Speicher für: " + endpoint);
        return localMockFetch(endpoint) || (endpoint === 'currentGame' ? null : []);
    }
}

// API-Speichern
async function apiSave(endpoint, data) {
    // Immer lokal spiegeln, damit man im Offline-Modus testen kann
    localMockSave(endpoint, data);

    if (IS_PREVIEW_MODE) return { success: true };

    try {
        await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Fehler beim Senden an den Server, lokal gesichert.");
    }
}

// Lädt den gesamten Zustand
async function loadAllFromDb() {
    if (isSettingUpGame) return;

    players = await apiFetch('players');
    games = await apiFetch('games');
    activeGames = await apiFetch('activeGames');
    currentGame = await apiFetch('currentGame');
    
    if (Array.isArray(currentGame) && currentGame.length === 0) currentGame = null;
    if (currentGame && Object.keys(currentGame).length === 0) currentGame = null;
}

// Hintergrund-Sync im 2-Sekunden-Takt
function startLiveSync() {
    if(autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        if (isSettingUpGame) return;

        await loadAllFromDb();
        const activePage = document.querySelector(".page.active").id;
        if (activePage === 'gamePage') renderGame(true); 
        if (activePage === 'playersPage' && document.activeElement.tagName !== 'INPUT') renderPlayers();
        if (activePage === 'statsPage') { renderRanking(); renderHistory(); }
    }, 2000); 
}

// Validiert mathematische Sonderregeln (Cabo 100->50, Limits)
function checkGameRulesAndLimits() {
    if (!currentGame || currentGame.gameKey === "custom") return false;

    let template = PREDEFINED_GAMES[currentGame.gameKey];
    if (!template) return false;

    let reachedLimit = false;

    currentGame.players.forEach(p => {
        if (template.hasResetRule && p.total === template.resetTrigger) {
            p.total = template.resetTarget;
            p.rounds.push(`🔄 Reset auf ${template.resetTarget}`);
            alert(`💥 Regel-Treffer! ${p.name} hat exakt ${template.resetTrigger} Punkte erreicht und fällt zurück auf ${template.resetTarget}!`);
        }
        if (template.hasLimit && p.total >= template.limitValue) {
            reachedLimit = true;
        }
    });

    if (reachedLimit) {
        alert(`🏁 Das Spiel-Limit von ${template.limitValue} Punkten wurde erreicht! Das Match wird jetzt automatisch ausgewertet.`);
        finishGame();
        return true; 
    }
    return false;
}