const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Mono Pulse navigation keeps its targets and exposes the centered play and close controls', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(index, /style\.css\?v=mono-pulse-33/);
    assert.match(index, /app\.js\?v=mono-pulse-22/);
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(index, /nav-item nav-item--play[\s\S]*?handleGameSwitcherTrigger\(this\)[\s\S]*?aria-controls="gameSwitcherPopover"[\s\S]*?<span>Spielen<\/span>/);
    assert.match(app, /async function openNewGameSetup\(element\)\s*\{\s*if \(IS_PREVIEW_MODE\) return;\s*await navigate\('gamePage', element\);\s*startSetup\(\);\s*\}/s);
    assert.match(app, /window\.openNewGameSetup\s*=\s*openNewGameSetup\s*;/);
    assert.match(app, /function discardSetupDraft\(\)\s*\{[\s\S]*?state\.isSettingUpGame = false;[\s\S]*?state\.tempTeams = \[\];[\s\S]*?state\.setupGuestPlayers = \[\];/);
    assert.match(app, /async function resumeGame\(gameId\)\s*\{\s*discardSetupDraft\(\);[\s\S]*?state\.currentGame = ag;[\s\S]*?renderGame\(\);/);
    assert.match(app, /function bindGameSwitcher\(\)/);
    assert.match(index, /id="gameSwitcherPopover"[\s\S]*?data-game-switcher-new/);
    assert.match(index, /<span>Übersicht<\/span>[\s\S]*?<span>Spieler<\/span>[\s\S]*?<span>Spielen<\/span>[\s\S]*?<span>Statistik<\/span>[\s\S]*?<span>Regeln<\/span>/);
    assert.match(index, /removeSyncBlockAndNavigate\('playersPage', this\)/);
    assert.match(index, /openOverview\(this\)[\s\S]*?<span>Übersicht<\/span>/);
    assert.match(app, /window\.openOverview\s*=\s*openOverview\s*;/);
    assert.match(index, /removeSyncBlockAndNavigate\('statsPage', this\)/);
    assert.match(index, /removeSyncBlockAndNavigate\('rulesPage', this\)/);
    assert.match(index, /class="modal-close"[^>]*aria-label="Schließen"[\s\S]*?m6 6 12 12M18 6 6 18/);
    assert.doesNotMatch(css, /\.nav-item\.active::after|\.nav-item--play\.active::after/);
    assert.match(css, /\.nav-item\.active[^\{]*\{[^}]*color:\s*var\(--accent\);[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    assert.match(css, /\.nav-play-icon\s*\{[^}]*background:\s*var\(--accent\);/s);
    assert.match(css, /\.nav-play-icon\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;[^}]*translateY\(-6px\);/s);
    assert.match(css, /\.nav-item--play span:last-child\s*\{[^}]*margin-top:\s*-1px;/s);
    assert.match(css, /\.game-switcher-item\.is-current\s*\{[^}]*border-color:\s*var\(--accent\);/s);
    assert.match(css, /\.game-switcher-item__self\s*\{[^}]*color:\s*var\(--accent-text\);/s);
});