const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Mono Pulse navigation keeps its targets and exposes the centered play and close controls', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(index, /style\.css\?v=mono-pulse-5/);
    assert.match(index, /app\.js\?v=mono-pulse-3/);
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.match(index, /nav-item nav-item--play[\s\S]*?openNewGameSetup\(this\)[\s\S]*?aria-label="Spiel anlegen"[\s\S]*?>[\s\S]*?<span>Spielen<\/span>/);
    assert.match(app, /async function openNewGameSetup\(element\)\s*\{\s*await navigate\('gamePage', element\);\s*startSetup\(\);\s*\}/s);
    assert.match(app, /window\.openNewGameSetup\s*=\s*openNewGameSetup\s*;/);
    assert.match(index, /<span>Übersicht<\/span>[\s\S]*?<span>Spieler<\/span>[\s\S]*?<span>Spielen<\/span>[\s\S]*?<span>Statistik<\/span>[\s\S]*?<span>Regeln<\/span>/);
    assert.match(index, /removeSyncBlockAndNavigate\('playersPage', this\)/);
    assert.match(index, /removeSyncBlockAndNavigate\('statsPage', this\)/);
    assert.match(index, /removeSyncBlockAndNavigate\('rulesPage', this\)/);
    assert.match(index, /class="modal-close"[^>]*aria-label="Schließen"[\s\S]*?m6 6 12 12M18 6 6 18/);
    assert.doesNotMatch(css, /\.nav-item\.active::after|\.nav-item--play\.active::after/);
    assert.match(css, /\.nav-item\.active\s*\{[^}]*color:\s*var\(--primary\);[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
    assert.match(css, /\.nav-play-icon\s*\{[^}]*width:\s*40px;[^}]*height:\s*40px;[^}]*background:\s*var\(--primary\);[^}]*translateY\(-6px\);/s);
    assert.match(css, /\.nav-item--play span:last-child\s*\{[^}]*margin-top:\s*-1px;/s);
});