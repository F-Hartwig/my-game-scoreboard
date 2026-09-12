import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const clientFiles = ['app.js', 'state.js', 'index.html', 'style.css'];

test('client no longer loads, creates or renders game nights', async () => {
  for (const file of clientFiles) {
    const source = await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /gameNights?|game-night|Spieleabend/i, file);
  }
});

test('new and repeated games have no game-night assignment', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /gameNightId/);
  assert.match(source, /function startSetup\(prefillGame = null\)/);
  assert.match(source, /function startRematch\(\)/);
});

test('app and API share one auth module instance for CSRF state', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const apiSource = await fs.readFile(new URL('../api.js', import.meta.url), 'utf8');
  const authImport = /from ['"](\.\/auth-client\.js[^'"]*)['"]/;

  assert.equal(appSource.match(authImport)?.[1], './auth-client.js');
  assert.equal(apiSource.match(authImport)?.[1], './auth-client.js');
});

test('user bindings save directly from the select without a confirmation button', async () => {
  const source = await fs.readFile(new URL('../auth-client.js', import.meta.url), 'utf8');

  assert.match(source, /onchange="saveUserBinding\(\$\{user\.id\}, this\)"/);
  assert.doesNotMatch(source, /class="icon-btn edit-btn"/);
  assert.match(source, /select\.value = previousValue/);
});

test('multi-user UI wires presence, safe undo, dashboard and comparison without feature five', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const serverSource = await fs.readFile(new URL('../server.js', import.meta.url), 'utf8');
  const collaborationSource = await fs.readFile(new URL('../collaboration.js', import.meta.url), 'utf8');

  assert.match(appSource, /\/api\/presence/);
  assert.match(appSource, /function undoActivity/);
  assert.match(appSource, /buildPersonalDashboard/);
  assert.match(appSource, /buildHeadToHeadStats/);
  assert.match(serverSource, /SCHEMA_VERSION = 5/);
  assert.match(collaborationSource, /Nur die letzte Änderung kann rückgängig gemacht werden/);
  assert.doesNotMatch(appSource, /Revanche-Abstimmung|achievement-card|Erfolge freigeschaltet/i);
});

test('collaboration refresh preserves activity disclosure and home keeps a compact primary action first', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(source, /activityWasOpen = Boolean\(panel\.querySelector\('\.activity-card'\)\?\.open\)/);
  assert.match(source, /<details class="activity-card"\$\{activityWasOpen \? ' open' : ''\}>/);
  assert.match(source, /let html = `\$\{renderNewGameAction\(\)\}\$\{renderPersonalDashboardCard\(\)\}`/);
  assert.match(source, />Letzte Form</);
  assert.doesNotMatch(source, />Letzte Ergebnisse</);
  assert.match(indexSource, /style\.css\?v=user-favorites-1/);
  assert.match(indexSource, /app\.js\?v=user-favorites-1/);
  assert.match(source, /\$\{stats\.winRate\} % Siege/);
  assert.doesNotMatch(source, /active-game-badge paused-status/);
});

test('scoreboard can switch to a persistent compact three-column grid', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const styleSource = await fs.readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(appSource, /localStorage\.getItem\('scorebuddy-scoreboard-view'\)/);
  assert.match(appSource, /function toggleScoreboardView\(\)/);
  assert.match(appSource, /id="scoreboardViewToggle"/);
  assert.match(appSource, /Kompakte Übersicht ohne Runden/);
  assert.match(styleSource, /\.scoreboard-list\.is-grid-view \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /\.scoreboard-list\.is-grid-view \.history-scroll \{ display: none; \}/);
  assert.match(styleSource, /\.scoreboard-list:not\(\.is-grid-view\) \.round-pill \{ min-width: 36px !important; min-height: 36px !important;/);
  assert.match(styleSource, /\.scoreboard-list:not\(\.is-grid-view\) \.scoreboard-row \{ padding: 12px 14px; gap: 7px; \}/);
});

test('reload restores the open game for the current browser tab', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /ACTIVE_GAME_SESSION_KEY = 'scorebuddy-active-game-id'/);
  assert.match(source, /function rememberCurrentGame\(\)/);
  assert.match(source, /function restoreCurrentGameAfterReload\(\)/);
  assert.match(source, /state\.activeGames\.find\(game => String\(game\.id\) === storedGameId\) \|\| null/);
  assert.match(source, /await loadAllFromDb\(\);\s+restoreCurrentGameAfterReload\(\);/);
  assert.match(source, /async function pauseCurrentGame\(\)[\s\S]*?state\.currentGame = null;\s+rememberCurrentGame\(\);/);
});

test('player favorites are loaded and saved per authenticated account', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const stateSource = await fs.readFile(new URL('../state.js', import.meta.url), 'utf8');
  assert.match(stateSource, /apiFetch\('favorites'\)/);
  assert.match(stateSource, /favoritePlayerIds/);
  assert.match(appSource, /apiSave\('favorites', favoriteIds\)/);
  assert.doesNotMatch(appSource, /favorite-btn admin-only/);
});