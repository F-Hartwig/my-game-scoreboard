import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { bindWerewolfRoleCount } from '../werwolf-role-count.mjs';

class FakeRoleInput extends EventTarget {
  constructor(value = '', checked = false) {
    super();
    this.value = value;
    this.checked = checked;
  }
}

test('Werwolf role counter includes the mandatory game master, follows checkbox changes, and treats an empty number field as zero', () => {
  const werewolf = new FakeRoleInput('');
  const gameMaster = new FakeRoleInput('', true);
  const seer = new FakeRoleInput('', false);
  const counter = { textContent: '' };
  const container = {
    querySelectorAll: selector => {
      if (selector === 'input[type="number"]') return [werewolf];
      if (selector === 'input[type="checkbox"][data-ww-role]') return [gameMaster, seer];
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };

  bindWerewolfRoleCount(container, counter, () => 6);
  assert.equal(counter.textContent, '1/6');

  werewolf.value = '2';
  werewolf.dispatchEvent(new Event('input'));
  assert.equal(counter.textContent, '3/6');

  seer.checked = true;
  seer.dispatchEvent(new Event('change'));
  assert.equal(counter.textContent, '4/6');

  werewolf.value = '';
  werewolf.dispatchEvent(new Event('input'));
  assert.equal(counter.textContent, '2/6');
});

test('Werwolf role fields are blank, show zero as their placeholder, and retain the numeric mobile keyboard', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(source, /type="number" min="0" placeholder="0" inputmode="numeric" pattern="\[0-9\]\*"/);
  assert.doesNotMatch(source, /type="number" min="0" value="0"/);
  assert.match(source, /\['gamemaster','Spielleiter'\]/);
  assert.match(source, /WW_REPEATABLE_ROLE_IDS\.has\(id\)/);
  assert.match(source, /id === 'gamemaster' \? 'checked disabled' : ''/);
  assert.doesNotMatch(source, /oninput="updateWerewolfRoleCount\(\)"/);
});
