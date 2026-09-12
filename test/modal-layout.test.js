const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('player ID account modal can override the default action layout', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const actionTag = index.match(/<div[^>]*id="modalActions"[^>]*>/)?.[0] || '';

    assert.ok(actionTag, 'modal action container must exist');
    assert.doesNotMatch(actionTag, /style=/i, 'inline display must not override account grid');
    assert.match(css, /\.player-account-modal #modalActions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,/s);
});