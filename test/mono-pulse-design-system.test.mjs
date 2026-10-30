import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const gamesConfig = fs.readFileSync(path.join(root, 'gamesConfig.js'), 'utf8');

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
  assert.match(index, /style\.css\?v=mono-pulse-33/);
  assert.match(index, /class="theme-icon-sun"/);
  assert.match(index, /class="theme-icon-moon"/);
  assert.match(css, /\.theme-toggle-btn\.is-dark \.theme-icon-moon\s*\{\s*display:\s*block/);
  assert.match(css, /\.result-strip\s*\{[\s\S]*?justify-content:\s*flex-start;[\s\S]*?overflow-x:\s*auto/);
  assert.match(css, /\.result-strip > \*\s*\{\s*flex:\s*0 0 auto/);
  assert.match(css, /\.theme-toggle-btn\s*\{[\s\S]*?min-height:\s*42px/);
  assert.match(css, /\.stats-overview\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.personal-stats-overview\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(css, /\.personal-stats-grid > div\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.personal-comparison-grid > div\s*\{[^}]*background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.stats-overview-balance\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
});

test('wizard round information uses the shared neutral info-card surface', () => {
  assert.match(css, /\.wizard-starter-option,\s*\.info-card\)\s*\{[\s\S]*?background:\s*var\(--surface\)[\s\S]*?border:\s*1px solid var\(--line\)[\s\S]*?border-radius:\s*var\(--radius-control\)[\s\S]*?box-shadow:\s*none/);
  assert.match(app, /<div class="info-card wizard-turn-card">[\s\S]*?Beginnt diese Runde/);
  assert.match(app, /<div class="info-card wizard-turn-card wizard-turn-card-modal">[\s\S]*?Beginnt diese Runde/);
  assert.doesNotMatch(css, /\.wizard-turn-card\s*\{[^}]*?(?:background|border(?:-color|-radius)?|box-shadow)\s*:/s);
  assert.match(css, /\.wizard-player-card\s*\{\s*padding:\s*10px 0;/);
  assert.match(css, /\.wizard-input-field span\s*\{[\s\S]*?margin:\s*0 0 4px;/);
});

test('ranking and history use compact statistic boxes with semantic winners', () => {
  assert.match(css, /\.stat-grid > div\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.history-player-score\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.history-player-score\.is-winner\s*\{[\s\S]*?color:\s*var\(--success\)/);
  assert.match(css, /\.history-card-result\s*\{[\s\S]*?background:\s*var\(--success-soft\)/);
  assert.match(css, /\.history-card-result\.is-draw\s*\{[\s\S]*?background:\s*var\(--surface-soft\)/);
  assert.match(css, /\.match-card-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(css, /\.history-rating-badge\s*\{[\s\S]*?margin-left:\s*auto;[\s\S]*?flex:\s*0 0 auto/);
});

test('activity disclosure is structured and only signed score values use semantic colors', () => {
  assert.match(css, /\.activity-card\s*\{[\s\S]*?padding:\s*11px 12px/);
  assert.match(css, /\.activity-card summary\s*\{[\s\S]*?grid-template-columns:\s*1fr auto auto/);
  assert.match(css, /\.activity-card summary::after\s*\{[\s\S]*?border-right:/);
  assert.match(css, /\.val-pos\s*\{[\s\S]*?color:\s*var\(--success\)/);
  assert.match(css, /\.val-neg\s*\{[\s\S]*?color:\s*var\(--danger\)/);
  assert.doesNotMatch(css, /\.round-pill\.val-(?:pos|neg)/);
});

test('presence and activity cards use the full content width and the leading player gets an accent border', () => {
  assert.match(css, /\.collaboration-panel\s*\{[\s\S]*?padding:\s*12px 0/);
  assert.doesNotMatch(css, /\.collaboration-presence[^}]*margin-inline/);
  assert.match(css, /\.editing-notice\s*\{\s*margin-inline:\s*14px/);
  assert.match(css, /\.collaboration-presence\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?justify-content:\s*space-between;[\s\S]*?background:\s*var\(--surface\)[\s\S]*?border-radius:\s*var\(--radius-card\)/);
  assert.equal((css.match(/\.collaboration-presence\s*\{/g) || []).length, 1);
  assert.match(css, /\.scoreboard-row:has\(\.leader-badge\)\s*\{[\s\S]*?border-color:\s*var\(--accent\)/);
});

test('mobile header keeps an accessible account and profile-assignment control', () => {
  assert.match(index, /class="account-btn"[\s\S]*?aria-label="Konto und Profilzuweisung öffnen"/);
  assert.match(index, /class="account-btn-icon"/);
  assert.match(css, /\.account-btn-icon\s*\{[\s\S]*?stroke:\s*currentColor/);
  assert.match(css, /\.account-btn\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/);
  assert.match(css, /\.account-btn #accountLabel\s*\{\s*display:\s*none/);
});

test('Zählbund branding uses an adaptive header mark and dark app icon references', () => {
  assert.match(index, /<svg class="brand-mark"[^>]*role="img"[^>]*aria-labelledby="brandMarkTitle brandMarkDesc"/);
  assert.match(index, /<path fill="currentColor" d="M10 12H16V52H10Z M22 12H28V52H22Z M34 12H40V52H34Z M46 12H52V52H46Z"\/>/);
  assert.match(index, /<path fill="#FF5A1F" d="M6 40L54 16L58 24L10 48Z"\/>/);
  assert.match(index, /<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg\?v=zaehlbund-1">/);
  assert.match(index, /<link rel="apple-touch-icon" sizes="180x180" href="\/icon\.png\?v=zaehlbund-1">/);
  assert.doesNotMatch(index, /data:image\/svg\+xml|>SB<|%3ESB%3C|(?:#7588ff|#4357df|#4f46e5|#6366f1|#8b5cf6)/i);
  assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*50px;[\s\S]*?height:\s*50px;[\s\S]*?color:\s*var\(--text\)/);
});

test('all compact dashboard and game labels use the shared badge surface contract', () => {
  assert.match(css, /\.dashboard-win-rate,[\s\S]*?\.personal-rank-badge,[\s\S]*?\.wizard-order-badge,[\s\S]*?\.wizard-starter-status,[\s\S]*?\.rec-tag\s*\{[\s\S]*?background:\s*var\(--surface-soft\)[\s\S]*?border:\s*1px solid var\(--line\)[\s\S]*?border-radius:\s*var\(--radius-pill\)/);
  assert.match(css, /\.rec-tag,[\s\S]*?\.wizard-starter-option\.selected \.wizard-starter-status\s*\{[\s\S]*?background:\s*var\(--accent-soft\)/);
  assert.match(css, /\.game-limit-badge\.danger\s*\{[\s\S]*?background:\s*var\(--danger-soft\)/);
});

test('frequent players use badges and unrated active games align their badge right', () => {
  assert.match(app, /class="badge-neutral dashboard-person-badge"/);
  assert.match(app, /class="badge-neutral active-game-rating-badge">Ungewertet/);
  assert.match(app, /<div class="match-card-meta active-game-meta">[\s\S]*?<\/div>\s*\$\{ratedBadge\}/);
  assert.match(css, /\.dashboard-person-badge\s*\{[\s\S]*?padding:\s*6px 9px/);
  assert.match(css, /\.active-game-rating-badge\s*\{[\s\S]*?margin-left:\s*auto/);
});

test('all checkbox variants and mobile reorder handles remain visible and usable', () => {
  assert.match(css, /input\[type="checkbox"\]\s*\{[^}]*appearance:\s*none;[^}]*transition:\s*none;/s);
  assert.match(css, /input\[type="checkbox"\]:checked\s*\{[^}]*background:\s*var\(--accent\) url\("data:image\/svg\+xml[^}]*border-color:\s*var\(--accent\);/s);
  assert.match(css, /\.select-card input\[type="checkbox"\]\s*\{[^}]*border-radius:\s*50%;/s);
  assert.match(css, /\.reorder-handle\s*\{[^}]*touch-action:\s*none;/s);
  assert.match(css, /\.reorder-handle::before\s*\{[^}]*background:\s*currentColor;[^}]*box-shadow:\s*0 -6px 0 currentColor, 0 6px 0 currentColor;/s);
  assert.doesNotMatch(css, /button, \[onclick\][^{]*, \.reorder-handle\s*\{\s*touch-action:\s*manipulation/);
  assert.match(app, /reorderHandle\.addEventListener\('dragend',[\s\S]*?captureSetupSelection\(\);/);
  assert.match(app, /const finishTouchDrag = \(\) => \{[\s\S]*?captureSetupSelection\(\);/);
});

test('selected game-mode radios render a browser-stable filled state', () => {
  assert.match(css, /input\[type="radio"\]\s*\{[^}]*appearance:\s*none;[^}]*border-radius:\s*50%;[^}]*transition:\s*none;/s);
  assert.match(css, /input\[type="radio"\]:checked\s*\{[^}]*background:\s*var\(--accent\) url\("data:image\/svg\+xml[^}]*border-color:\s*var\(--accent\);/s);
  assert.doesNotMatch(css, /\.mode-select-card input\[type="radio"\]:checked::after/);
});

test('rule documents and sign states use shared classes instead of static inline visuals', () => {
  assert.doesNotMatch(gamesConfig, /style=/i);
  assert.match(gamesConfig, /class="rule-content"/);
  assert.match(gamesConfig, /class="rule-heading rule-heading--(?:success|warning|danger)"/);
  assert.match(css, /\.rule-content\s*\{[^}]*max-height:\s*400px[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.rule-heading\s*\{[^}]*color:\s*var\(--primary\)/s);
  assert.match(css, /\.modal-sign-btn\.is-negative\s*\{[^}]*color:\s*var\(--danger\)[^}]*background:\s*var\(--danger-light\)/s);
  assert.doesNotMatch(app, /modalSignBtn[\s\S]{0,300}style=/);
  assert.match(app, /classList\.toggle\('is-negative', isNegative\)/);
});