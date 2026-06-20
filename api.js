// Automatische Erkennung: Wenn 'localhost' oder '127.0.0.1' in der Adresse steht,
// nutzen wir den Offline-Modus. Auf dem NAS nutzen wir die echte DB.
const IS_OFFLINE_TEST = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

export async function apiFetch(endpoint) {
    // ---- 1. OFFLINE-MODUS (Browser-Speicher) ----
    if (IS_OFFLINE_TEST) {
        const localData = localStorage.getItem(`scorebuddy_${endpoint}`);
        if (!localData) {
            return endpoint === 'currentGame' ? null : [];
        }
        return JSON.parse(localData);
    }

    // ---- 2. ONLINE-MODUS (Echte NAS-Datenbank) ----
    try {
        const res = await fetch(`/api/${endpoint}`);
        return await res.json();
    } catch (e) {
        console.error("Fehler beim Laden von " + endpoint, e);
        return endpoint === 'currentGame' ? null : [];
    }
}

export async function apiSave(endpoint, data) {
    // ---- 1. OFFLINE-MODUS (Browser-Speicher) ----
    if (IS_OFFLINE_TEST) {
        if (endpoint === 'currentGame' && (!data || Object.keys(data).length === 0)) {
            localStorage.removeItem(`scorebuddy_${endpoint}`);
        } else {
            localStorage.setItem(`scorebuddy_${endpoint}`, JSON.stringify(data));
        }
        return;
    }

    // ---- 2. ONLINE-MODUS (Echte NAS-Datenbank) ----
    try {
        await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error("Fehler beim Speichern von " + endpoint, e);
    }
}