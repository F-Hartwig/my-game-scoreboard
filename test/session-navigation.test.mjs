import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('main navigation restores only valid non-preview pages after data and game restoration', async () => {
    const app = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
    const index = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(index, /app\.js\?v=mono-pulse-25/);

    assert.match(app, /const ACTIVE_MAIN_PAGE_SESSION_KEY = 'scorebuddy-active-main-page';/);
    assert.match(app, /const MAIN_PAGE_IDS = new Set\(\['gamePage', 'playersPage', 'statsPage', 'rulesPage'\]\);/);
    assert.match(app, /function restoreMainPageAfterReload\(\) \{\s+if \(IS_PREVIEW_MODE\) return 'gamePage';[\s\S]*?MAIN_PAGE_IDS\.has\(storedPageId\) \? storedPageId : 'gamePage';/);
    assert.match(app, /function rememberActiveMainPage\(pageId\) \{\s+if \(IS_PREVIEW_MODE \|\| !MAIN_PAGE_IDS\.has\(pageId\)\) return;[\s\S]*?sessionStorage\.setItem\(ACTIVE_MAIN_PAGE_SESSION_KEY, pageId\);/);
    assert.match(app, /restoreCurrentGameAfterReload\(\);\s+isFocusMode[\s\S]*?const restoredPageId = restoreMainPageAfterReload\(\);\s+await navigate\(restoredPageId, getMainPageNavigationElement\(restoredPageId\), \{ reloadData: false \}\);/);
    assert.match(app, /activePage\.classList\.add\("active"\);[\s\S]*?rememberActiveMainPage\(pageId\);/);
    assert.match(app, /IS_PREVIEW_MODE \|\| !state\.currentGame \? navigation\.overview : navigation\.game/);
    for (const id of ['overviewNav', 'playersNav', 'gameSwitcherTrigger', 'statsNav', 'rulesNav']) {
        assert.match(index, new RegExp(`id="${id}"`));
    }
});