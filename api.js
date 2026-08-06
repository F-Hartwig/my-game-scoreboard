// Automatische Erkennung: Wenn 'localhost' oder '127.0.0.1' in der Adresse steht,
// nutzen wir den Offline-Modus. Auf dem NAS nutzen wir die echte DB.
const IS_OFFLINE_TEST = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
let apiSaveVersion = 0;
let activeApiSaves = 0;

export function getApiSaveVersion() {
    return apiSaveVersion;
}

export function hasActiveApiSaves() {
    return activeApiSaves > 0;
}

export async function apiFetch(endpoint) {
    // ---- 1. OFFLINE-MODUS (Browser-Speicher) ----
    if (IS_OFFLINE_TEST) {
        const localData = localStorage.getItem(`scorebuddy_${endpoint}`);
        if (!localData) {
            return endpoint === 'currentGame' ? null : [];
        }
        try {
            return JSON.parse(localData);
        } catch (e) {
            console.error("Ungültige lokale Daten für " + endpoint, e);
            return undefined;
        }
    }

    // ---- 2. ONLINE-MODUS (Echte NAS-Datenbank) ----
    try {
        const res = await fetch(`/api/${endpoint}`);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    } catch (e) {
        console.error("Fehler beim Laden von " + endpoint, e);
        return undefined;
    }
}

export async function apiSave(endpoint, data) {
    apiSaveVersion++;
    activeApiSaves++;

    try {
        // ---- 1. OFFLINE-MODUS (Browser-Speicher) ----
        if (IS_OFFLINE_TEST) {
            if (endpoint === 'currentGame' && (!data || Object.keys(data).length === 0)) {
                localStorage.removeItem(`scorebuddy_${endpoint}`);
            } else {
                localStorage.setItem(`scorebuddy_${endpoint}`, JSON.stringify(data));
            }
            return true;
        }

        // ---- 2. ONLINE-MODUS (Echte NAS-Datenbank) ----
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return true;
    } catch (e) {
        const storageLabel = IS_OFFLINE_TEST ? "lokalen " : "";
        console.error(`Fehler beim ${storageLabel}Speichern von ${endpoint}`, e);
        return false;
    } finally {
        activeApiSaves = Math.max(0, activeApiSaves - 1);
    }
}
