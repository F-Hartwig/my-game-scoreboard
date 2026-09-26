import test from 'node:test';
import assert from 'node:assert/strict';
import { planWerewolfDayDeaths, planWerewolfNightDeaths } from '../werwolf-day-resolution.mjs';

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

const nightRoles = [
  { playerId: 1, roleId: 'witch', alive: true },
  { playerId: 2, roleId: 'prostitute', alive: true },
  { playerId: 3, roleId: 'hunter', alive: true },
  { playerId: 4, roleId: 'werewolf', alive: true },
  { playerId: 5, roleId: 'villager', alive: true },
  { playerId: 6, roleId: 'gamemaster', alive: false }
];

function nightPlan(overrides = {}) {
  return planWerewolfNightDeaths({ roles: nightRoles, lovers: [], nightState: {}, ...overrides });
}

test('a witch killed by wolves kills the visiting prostitute and her hunter lover before day planning', () => {
  const nightDeathIds = nightPlan({
    lovers: [2, 3],
    nightState: { prostituteTargetId: 1, wolfTargetId: 1 }
  });
  const dayPlan = plan({
    roles: nightRoles,
    lovers: [2, 3],
    nightDeathIds,
    hunterShotId: 4
  });

  assert.deepEqual(nightDeathIds, [1, 2, 3]);
  assert.equal(dayPlan.hunterId, 3);
  assert.deepEqual(dayPlan.hunterTargetIds, [4, 5]);
  assert.deepEqual(dayPlan.deathIds, [1, 2, 3, 4]);
});

test('a visiting prostitute survives when the wolf victim is healed or protected by the barkeeper', () => {
  assert.deepEqual(nightPlan({ nightState: { prostituteTargetId: 1, wolfTargetId: 1, healedTargetId: 1 } }), []);
  assert.deepEqual(nightPlan({ nightState: { prostituteTargetId: 1, wolfTargetId: 1, barkeeperTargetId: 1 } }), []);
});

test('poisoning the visited person kills the visiting prostitute', () => {
  assert.deepEqual(nightPlan({ nightState: { prostituteTargetId: 1, poisonTargetId: 1 } }), [1, 2]);
});

test('night death closure remains unique when sources and follow-up rules overlap', () => {
  assert.deepEqual(nightPlan({
    lovers: [1, 2],
    nightState: { prostituteTargetId: 1, wolfTargetId: 1, poisonTargetId: 1 }
  }), [1, 2]);
});
