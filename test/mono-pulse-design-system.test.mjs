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

test('statistics containers stay transparent and theme toggle has visible icons', () => {
  assert.match(index, /style\.css\?v=mono-pulse-13/);
  assert.match(index, /class="theme-icon-sun"/);
  assert.match(index, /class="theme-icon-moon"/);
  assert.match(css, /\.theme-toggle-btn\.is-dark \.theme-icon-moon\s*\{\s*display:\s*block/);
  assert.match(css, /\.theme-toggle-btn\s*\{[\s\S]*?min-height:\s*42px/);
  assert.match(css, /\.stats-overview\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.personal-stats-overview\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.personal-stats-grid > div\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.personal-comparison-grid > div\s*\{[^}]*background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.stats-overview-balance\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
});

test('ranking and history use compact statistic boxes with semantic winners', () => {
  assert.match(css, /\.stat-grid > div\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.history-player-score\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.history-player-score\.is-winner\s*\{[\s\S]*?color:\s*var\(--success\)/);
  assert.match(css, /\.history-winner-summary\s*\{[\s\S]*?background:\s*var\(--success-soft\)/);
  assert.match(css, /\.history-winner-summary\.is-draw\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
});

test('activity disclosure is structured and only signed score values use semantic colors', () => {
  assert.match(css, /\.activity-card\s*\{[\s\S]*?padding:\s*11px 12px/);
  assert.match(css, /\.activity-card summary\s*\{[\s\S]*?grid-template-columns:\s*1fr auto auto/);
  assert.match(css, /\.activity-card summary::after\s*\{[\s\S]*?border-right:/);
  assert.match(css, /\.val-pos\s*\{[\s\S]*?color:\s*var\(--success\)/);
  assert.match(css, /\.val-neg\s*\{[\s\S]*?color:\s*var\(--danger\)/);
  assert.doesNotMatch(css, /\.round-pill\.val-(?:pos|neg)/);
});

test('activity card uses the full content width and the leading player gets an accent border', () => {
  assert.match(css, /\.collaboration-panel\s*\{[\s\S]*?padding:\s*12px 0/);
  assert.match(css, /\.collaboration-presence,[\s\S]*?\.editing-notice\s*\{[\s\S]*?margin-inline:\s*14px/);
  assert.match(css, /\.collaboration-presence\s*\{[\s\S]*?background:\s*var\(--surface\)[\s\S]*?border:\s*1px solid var\(--line\)/);
  assert.match(css, /\.scoreboard-row:has\(\.leader-badge\)\s*\{[\s\S]*?border-color:\s*var\(--accent\)/);
});