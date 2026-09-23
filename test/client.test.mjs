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
  assert.match(serverSource, /SCHEMA_VERSION = 7/);
  assert.match(collaborationSource, /Nur die letzte Änderung kann rückgängig gemacht werden/);
  assert.doesNotMatch(appSource, /Revanche-Abstimmung|achievement-card|Erfolge freigeschaltet/i);
});

test('guest-player setup is local to the current game and promotion is exposed only in history', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const stateSource = await fs.readFile(new URL('../state.js', import.meta.url), 'utf8');
  assert.match(appSource, />Gast hinzufügen</);
  assert.match(appSource, /guestDrafts: state\.setupGuestPlayers/);
  assert.match(appSource, /\/api\/guests\?gameId=/);
  assert.doesNotMatch(appSource, /authRequest\('\/api\/guests', \{ method: 'POST'/);
  assert.match(appSource, /Als festen Spieler übernehmen/);
  assert.match(stateSource, /setupGuestPlayers/);
});

test('collaboration refresh preserves activity disclosure and home keeps a compact primary action first', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const indexSource = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(source, /activityWasOpen = Boolean\(panel\.querySelector\('\.activity-card'\)\?\.open\)/);
  assert.match(source, /<details class="activity-card"\$\{activityWasOpen \? ' open' : ''\}>/);
  assert.match(source, /let html = `\$\{renderNewGameAction\(\)\}\$\{renderPersonalDashboardCard\(\)\}`/);
  assert.match(source, />Letzte Spiele</);
  assert.doesNotMatch(source, />Letzte Form</);
  assert.doesNotMatch(source, />Letzte Ergebnisse</);
  assert.match(indexSource, /style\.css\?v=werwolf-flow-2/);
  assert.match(indexSource, /app\.js\?v=werwolf-flow-3/);
  assert.match(source, /\$\{stats\.winRate\} % Siege/);
  assert.doesNotMatch(source, /active-game-badge paused-status/);
});

test('Werwolf client derives night steps from assigned roles and keeps persistent moderator resources', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /function wwHasAssignedRole\(ww, roleId\)/);
  assert.match(source, /const WW_STEP_ROLE_IDS = \{ child: \['child'\], prostitute: \['prostitute'\], barkeeper: \['barkeeper'\], werewolves: \['werewolf'\], witch: \['witch'\], seer: \['seer'\] \}/);
  assert.match(source, /function wwSteps\(ww\) \{[\s\S]*?\(ww\.number === 1 \? WW_NIGHT_ONE : WW_NIGHT\)\.filter\(step => !WW_STEP_ROLE_IDS\[step\] \|\| \(wwHasAnyAssignedRole\(ww, WW_STEP_ROLE_IDS\[step\]\) && wwStepActorIds\(ww, step\)\.length\)\)/);
  assert.match(source, /previousBarkeeperTargetId/);
  assert.match(source, /childModelPlayerId/);
  assert.match(source, /ww\.lovers = \[Number\(target\), Number\(target2\)\]/);
  assert.match(source, /witch\.resources\.heal = false/);
  assert.match(source, /witch\.resources\.poison = false/);
  assert.match(source, /function wwShowRole/);
  assert.match(source, /function wwFinishGame/);
});

test('Werwolf removes a stale child step when no child is assigned', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /const availableSteps = wwSteps\(ww\);[\s\S]*?if \(!availableSteps\.includes\(ww\.step\)\) ww\.step = availableSteps\[0\];/);
  assert.match(source, /function wwSaveAssignment\(\)[\s\S]*?wwEnsureState\(\);[\s\S]*?await saveWerewolf\(\);/);
});

test('Werwolf target controls exclude the known actor except barkeeper and witch, and sleeping actors', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /function wwTargetOptions\(actorIds = \[\], allowSelf = false\)/);
  assert.match(source, /function wwStepAllowsSelf\(step\) \{ return \['barkeeper', 'witch'\]\.includes\(step\); \}/);
  assert.match(source, /allowSelf \|\| !actorIds\.some\(actorId => String\(actorId\) === String\(role\.playerId\)\)/);
  assert.match(source, /function wwIsSleeping\(ww, playerId\) \{ return ww\.phase === 'night' && ww\.nightState\.prostituteTargetId != null && String\(ww\.nightState\.prostituteTargetId\) === String\(playerId\); \}/);
  assert.match(source, /role\.alive && roleIds\.includes\(role\.roleId\) && !wwIsSleeping\(ww, role\.playerId\)/);
  assert.match(source, /function wwSleepingStepNotice\(ww, step\)/);
  assert.match(source, /function wwSkipSleepingStep\(\)/);
  assert.match(source, /if \(!wwTargetIsValid\(ww, target, wwStepActorIds\(ww, step\), wwStepAllowsSelf\(step\)\)\) return/);
  assert.match(source, /return \['day'\]/);
});

test('Werwolf shows only awake actors in awakening titles and reaches day without a resolve step', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const nightStepDefinitions = source.slice(source.indexOf('const WW_NIGHT_ONE'), source.indexOf('function makeWerewolfRoleState'));

  assert.match(source, /function wwAwakeningTitle\(ww, step\)/);
  assert.match(source, /const actorNames = wwStepActorIds\(ww, step\)\.map\(wwPlayerName\)/);
  assert.match(source, /return actorNames\.length \? `\$\{title\} \(\$\{actorNames\.join\(', '\)\}\)` : title/);
  assert.match(source, /<strong>\$\{wwAwakeningTitle\(ww, step\)\}<\/strong>/);
  assert.match(source, /wwHasAnyAssignedRole\(ww, WW_STEP_ROLE_IDS\[step\]\) && wwStepActorIds\(ww, step\)\.length/);
  assert.doesNotMatch(nightStepDefinitions, /resolve|Folgen manuell auflösen/);
});

test('Werwolf steps use one footer action position and the shared selection checkbox component', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const styleSource = await fs.readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(appSource, /function wwStepFooter\(ww, step\)/);
  assert.match(appSource, /class="ww-step-footer"/);
  assert.doesNotMatch(appSource, /ww-status[\s\S]*?onclick="wwAdvance\(\)"[\s\S]*?ww-step-card/);
  assert.match(styleSource, /\.ww-step-footer \{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;/);
  assert.match(appSource, /class="select-card werwolf-role-card"/);
  assert.match(styleSource, /\.werwolf-role-card \{ min-height: 48px;/);
});

test('Werwolf setup selects players before roles, starts role counts at zero, and requires an exact role total', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const playerSelection = source.indexOf('Teilnehmer wählen');
  const roleSetup = source.indexOf('Rollen festlegen');

  assert.ok(playerSelection >= 0 && roleSetup > playerSelection, 'roles follow player selection');
  assert.match(source, /id="wwRoleCount"[^>]*>0\/0</);
  assert.match(source, /id="wwGameMaster"/);
  assert.match(source, /type="number" min="0" placeholder="0" inputmode="numeric" pattern="\[0-9\]\*"/);
  assert.match(source, /bindWerewolfRoleCount\(werwolfSetup, werwolfRoleCount/);
  assert.match(source, /roleIds\.length !== state\.currentGame\.players\.length - 1/);
  assert.match(source, /Die Rollenanzahl muss inklusive Spielleiter exakt der Anzahl der ausgewählten Teilnehmer entsprechen\./);
  assert.match(source, /view: 'handoff'/);
  assert.match(source, /function wwConfirmHandoff\(\)[\s\S]*?ww\.view = 'moderator'/);
  assert.match(source, /function wwRecordTarget\(\)[\s\S]*?await wwAdvance\(\);/);
  assert.match(source, /class="card ww-handoff-view"/);
});

test('Werwolf setup selects exactly one participant as game master, uses numeric fields only for repeatable roles, and caps unique roles', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(source, /WW_REPEATABLE_ROLE_IDS = new Set\(\['werewolf', 'villager'\]\)/);
  assert.match(source, /WW_UNIQUE_ROLE_IDS = new Set\(\['gamemaster', 'seer', 'witch', 'hunter', 'prostitute', 'barkeeper', 'terrorist', 'child', 'priest'\]\)/);
  assert.match(source, /function updateWerewolfGameMasterSelect\(\)/);
  assert.match(source, /const gameMasterId = document\.getElementById\('wwGameMaster'\)\?\.value/);
  assert.match(source, /if \(!gameMasterId\) \{ wwShowMessage\('Spielleitung fehlt', 'Wähle einen Spielleiter aus den Teilnehmern\.'/);
  assert.match(source, /String\(player\.id\) === String\(gameMasterId\) \? 'gamemaster' : roleIds\.shift\(\)/);
  assert.match(source, /function wwIsActiveRole\(role\) \{ return role\?\.roleId !== 'gamemaster'; \}/);
  assert.match(source, /function wwSaveAssignment\(\)[\s\S]*?gamemasterCount !== 1[\s\S]*?uniqueRoleCounts\.some\(count => count > 1\)/);
});

test('Werwolf separates handoff from moderation, resolves one day step, and uses modal-only secret results', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const styleSource = await fs.readFile(new URL('../style.css', import.meta.url), 'utf8');
  const werewolfFlow = source.slice(source.indexOf('async function createGame()'), source.indexOf('function renderGame('));

  assert.match(source, /if \(ww\.view === 'handoff'\)[\s\S]*?class="card ww-handoff-view"[\s\S]*?return;/);
  assert.match(source, /function wwShowRole\(\)[\s\S]*?ww\.handoffReveal = true; renderGame\(\);/);
  assert.match(source, /function wwSteps\(ww\)[\s\S]*?return \['day'\];/);
  assert.match(source, /function wwResolveDay\(\)[\s\S]*?ww\.phase = 'night'; ww\.number \+= 1/);
  assert.match(source, /Niemand ist gestorben\./);
  assert.match(source, /role\.currentTeam === 'wolves' \? 'böse' : 'gut'/);
  assert.doesNotMatch(source, /Seherin[^\n]*WW_ROLE_NAMES\[role\.roleId\]/);
  assert.match(source, /role\.effects\.heal = \{ night: ww\.number \}/);
  assert.match(source, /role\.effects\.poison = \{ night: ww\.number \}/);
  assert.match(source, /shotRole\.effects\.shot = \{ night: ww\.number \}/);
  assert.match(styleSource, /\.ww-effect-badge/);
  assert.doesNotMatch(werewolfFlow, /\b(?:window\.)?(?:alert|confirm)\s*\(/);
});

test('Werwolf game header uses generic minimize instead of a persistent pause state while step status is in the action card', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(source, /function renderWerewolfGame[\s\S]*?class="game-status-actions ww-actions"[\s\S]*?data-ww-action="handoff"[\s\S]*?data-ww-action="minimize"[\s\S]*?data-ww-action="finish"/);
  assert.match(source, /class="card ww-step-card">[\s\S]*?Nacht' : 'Tag'\} \$\{ww\.number\}[\s\S]*?wwStepLabel\(step\)/);
  assert.match(source, /function bindWerewolfHeaderActions\(contentBox\)/);
  assert.match(source, /minimizeButton\?\.addEventListener\('click', pauseCurrentGame\)/);
  assert.doesNotMatch(source, /ww\.paused/);
});

test('Werwolf header uses bound compact shared icon actions and finish invokes its dialog handler', async () => {
  const appSource = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const styleSource = await fs.readFile(new URL('../style.css', import.meta.url), 'utf8');

  assert.match(appSource, /window\.wwFinishGame = wwFinishGame;/);
  assert.match(appSource, /class="game-status-actions ww-actions"/);
  assert.match(appSource, /data-ww-action="minimize" aria-label="Zur Übersicht"/);
  assert.match(appSource, /data-ww-action="finish" aria-label="Partie beenden"/);
  assert.match(appSource, /finishButton\?\.addEventListener\('click', wwFinishGame\)/);
  assert.match(styleSource, /\.ww-actions \{ width: auto; flex: 0 0 auto; min-width: 0; \}/);
  assert.match(styleSource, /\.ww-step-card, \.ww-overview-card, \.ww-events-card \{ display: grid; gap: 12px; \}/);
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
  assert.match(appSource, /authRequest\(`\/api\/favorites\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(appSource, /state\.players = applyFavoriteSelection\(finished\.players\)/);
  assert.doesNotMatch(appSource, /favorite-btn admin-only/);
});

test('login offers an unchecked remember-me checkbox and sends its boolean state only with login', async () => {
  const source = await fs.readFile(new URL('../auth-client.js', import.meta.url), 'utf8');
  assert.match(source, /name="rememberMe" type="checkbox"/);
  assert.doesNotMatch(source, /name="rememberMe"[^>]*\schecked/);
  assert.match(source, /rememberMe: values\.get\('rememberMe'\) === 'on'/);
});