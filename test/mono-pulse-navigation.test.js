const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('Mono Pulse navigation keeps its targets and exposes the centered play and close controls', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

    assert.match(index, /style\.css\?v=mono-pulse-2/);
    assert.match(index, /nav-item nav-item--play[\s\S]*?navigate\('gamePage', this\)[\s\S]*?>[\s\S]*?<span>Spielen<\/span>/);
    assert.match(index, /removeSyncBlockAndNavigate\('playersPage', this\)/);
    assert.match(index, /removeSyncBlockAndNavigate\('statsPage', this\)/);
    assert.match(index, /removeSyncBlockAndNavigate\('rulesPage', this\)/);
    assert.match(index, /class="modal-close"[^>]*aria-label="Schließen"[\s\S]*?m6 6 12 12M18 6 6 18/);
    assert.match(css, /\.nav-item\.active::after\s*\{[^}]*width:\s*4px;[^}]*height:\s*4px;/s);
    assert.match(css, /\.nav-play-icon\s*\{[^}]*background:\s*var\(--primary\);/s);
});