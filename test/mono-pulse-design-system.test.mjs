import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Mono Pulse has one token source and no legacy visual effects', () => {
  assert.equal((css.match(/^:root\s*\{/gm) || []).length, 1);
  assert.equal((css.match(/^\[data-theme="dark"\]\s*\{/gm) || []).length, 1);
  assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\(/i);
  assert.doesNotMatch(css, /backdrop-filter/i);
  assert.doesNotMatch(css, /filter\s*:\s*blur\(/i);
  assert.doesNotMatch(css, /#(?:7588ff|4357df|4f46e5|6366f1|8b5cf6|365bd8|5f8ee7|8db6ff)\b/i);
  assert.doesNotMatch(css, /Mono Pulse audit completion/i);
  assert.doesNotMatch(index, /ambient-(?:background|orb)/i);
});

test('Mono Pulse exposes reusable component contracts', () => {
  assert.match(css, /--accent:\s*#ff5a1f/i);
  assert.match(css, /--radius-card:\s*14px/i);
  assert.match(css, /\.bottom-nav\s*\{/);
  assert.match(css, /\.nav-item\.active/);
  assert.match(css, /\.modal-close\s*\{/);
  assert.match(css, /\.game-status-card/);
  assert.match(css, /\.werwolf-role-card:has\(input:checked\)/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /font-variant-numeric:\s*tabular-nums/);
});