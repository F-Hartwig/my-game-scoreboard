import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createId, escapeHtml } from '../security.mjs';

test('escapeHtml neutralizes stored-XSS markup and attributes', () => {
    assert.equal(
        escapeHtml(`<img src=x onerror="alert('x')">&`),
        '&lt;img src=x onerror=&quot;alert(&#039;x&#039;)&quot;&gt;&amp;'
    );
});

test('all persisted user-facing names are escaped at HTML interpolation sites', async () => {
    const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
    const unsafePatterns = [
        '${p.name}', '${g.name}', '${ag.name}', '${game.name}', '${x.name}',
        '${p.name.substring', '${g.winner}', '${game.winner}', '${displayName}'
    ];
    for (const pattern of unsafePatterns) {
        assert.equal(source.includes(pattern), false, `unsafe interpolation remains: ${pattern}`);
    }
});

test('createId returns collision-resistant safe numeric IDs', () => {
    const ids = new Set(Array.from({ length: 10000 }, createId));
    assert.equal(ids.size, 10000);
    for (const id of ids) assert.equal(Number.isSafeInteger(id) && id >= 0, true);
});
