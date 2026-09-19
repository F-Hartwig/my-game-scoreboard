import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { bindWerewolfRoleCount } from '../werwolf-role-count.mjs';

class FakeRoleInput extends EventTarget {
  constructor(value = '') {
    super();
    this.value = value;
  }
}

test('Werwolf role counter follows every input event and treats an empty field as zero', () => {
  const werewolf = new FakeRoleInput('');
  const seer = new FakeRoleInput('');
  const counter = { textContent: '' };
  const container = {
    querySelectorAll: selector => {
      assert.equal(selector, 'input[type="number"]');
      return [werewolf, seer];
    }
  };

  bindWerewolfRoleCount(container, counter, () => 6);
  assert.equal(counter.textContent, '0/6');

  werewolf.value = '2';
  werewolf.dispatchEvent(new Event('input'));
  assert.equal(counter.textContent, '2/6');

  seer.value = '3';
  seer.dispatchEvent(new Event('input'));
  assert.equal(counter.textContent, '5/6');

  werewolf.value = '';
  werewolf.dispatchEvent(new Event('input'));
  assert.equal(counter.textContent, '3/6');
});

test('Werwolf role fields are blank, show zero as their placeholder, and retain the numeric mobile keyboard', async () => {
  const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');

  assert.match(source, /type="number" min="0" placeholder="0" inputmode="numeric" pattern="\[0-9\]\*"/);
  assert.doesNotMatch(source, /type="number" min="0" value="0"/);
  assert.doesNotMatch(source, /oninput="updateWerewolfRoleCount\(\)"/);
});
