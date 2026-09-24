import test from 'node:test';
import assert from 'node:assert/strict';
import { planWerewolfDayDeaths } from '../werwolf-day-resolution.mjs';

const roles = [
  { playerId: 1, roleId: 'villager', alive: true },
  { playerId: 2, roleId: 'hunter', alive: true },
  { playerId: 3, roleId: 'villager', alive: true },
  { playerId: 4, roleId: 'villager', alive: true },
  { playerId: 5, roleId: 'villager', alive: true },
  { playerId: 6, roleId: 'gamemaster', alive: false }
];

function plan(overrides = {}) {
  return planWerewolfDayDeaths({ roles, lovers: [], nightDeathIds: [], ...overrides });
}

test('day accusation defaults to nobody and offers each living non-night-victim exactly once', () => {
  const result = plan({ nightDeathIds: [1] });

  assert.equal(result.accusationId, null);
  assert.deepEqual(result.accusationTargetIds, [2, 3, 4, 5]);
  assert.equal(result.hunterId, null);
});

test('accusation kills a lover through the central planned lover closure', () => {
  const result = plan({ lovers: [3, 4], accusationId: 3 });

  assert.deepEqual(result.deathIds, [3, 4]);
});

test('an accused hunter receives one shot and cannot shoot self or already certain deaths', () => {
  const result = plan({ nightDeathIds: [1], accusationId: 2 });

  assert.equal(result.hunterId, 2);
  assert.deepEqual(result.hunterTargetIds, [3, 4, 5]);
});

test('a hunter dying as a lover gets a shot and that shot resolves the target lover', () => {
  const result = plan({ lovers: [1, 2], nightDeathIds: [1], hunterShotId: 3 });
  const shotWithLover = plan({ lovers: [1, 2, 3, 4], nightDeathIds: [1], hunterShotId: 3 });

  assert.equal(result.hunterId, 2);
  assert.deepEqual(result.deathIds, [1, 2, 3]);
  assert.deepEqual(shotWithLover.deathIds, [1, 2, 3, 4]);
});

test('no hunter selector is planned unless the full predicted death set kills the hunter', () => {
  const result = plan({ nightDeathIds: [1], accusationId: 3 });

  assert.equal(result.hunterId, null);
  assert.deepEqual(result.hunterTargetIds, []);
});
