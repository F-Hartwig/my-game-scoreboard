import { authState } from './auth-client.js';

const IS_PREVIEW_MODE = new URLSearchParams(window.location.search).get('preview') === '1';
let apiSaveVersion = 0;
let activeApiSaves = 0;

export function getApiSaveVersion() { return apiSaveVersion; }
export function hasActiveApiSaves() { return activeApiSaves > 0; }

export async function apiFetch(endpoint) {
    try {
        const suffix = IS_PREVIEW_MODE ? '?preview=1' : '';
        const res = await fetch(`/api/${endpoint}${suffix}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (error) {
        console.error(`Fehler beim Laden von ${endpoint}`, error);
        return undefined;
    }
}

export async function apiSave(endpoint, data) {
    if (IS_PREVIEW_MODE) {
        console.warn('Speichern ist in der Live-Vorschau deaktiviert.');
        return false;
    }
    apiSaveVersion++;
    activeApiSaves++;
    try {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': authState.csrfToken || '' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
    } catch (error) {
        console.error(`Fehler beim Speichern von ${endpoint}`, error);
        return false;
    } finally {
        activeApiSaves = Math.max(0, activeApiSaves - 1);
    }
}
