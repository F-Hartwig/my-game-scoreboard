const test = require('node:test');
const assert = require('node:assert/strict');

function rootWith({ values = [], signs = [] } = {}) {
    return {
        querySelectorAll(selector) {
            if (selector === '#roundInputs input') return values.map(value => ({ value }));
            if (selector === '#roundInputs button[id^="sign_"]') return signs.map(textContent => ({ textContent }));
            return [];
        }
    };
}

test('score drafts block sync until values are saved or cleared', async () => {
    const { hasScoreEntryDraft } = await import('../score-entry-draft.mjs');

    assert.equal(hasScoreEntryDraft(rootWith()), false);
    assert.equal(hasScoreEntryDraft(rootWith({ values: ['', '42'] })), true);
    assert.equal(hasScoreEntryDraft(rootWith({ values: ['  '] })), false);
    assert.equal(hasScoreEntryDraft(rootWith({ signs: ['+', '-'] })), true);
});