function ids(values = []) {
  return [...new Set(values.map(Number).filter(Number.isFinite))];
}

export function planWerewolfNightDeaths({ roles = [], lovers = [], nightState = {} } = {}) {
  const activeLivingIds = roles
    .filter(role => role.roleId !== 'gamemaster' && role.alive)
    .map(role => Number(role.playerId));
  const livingIds = new Set(activeLivingIds);
  const deathIds = new Set();
  const addLiving = playerId => {
    const id = Number(playerId);
    if (!livingIds.has(id) || deathIds.has(id)) return false;
    deathIds.add(id);
    return true;
  };
  const wolfTargetId = nightState.wolfTargetId;
  if (wolfTargetId != null && String(wolfTargetId) !== String(nightState.healedTargetId) && String(wolfTargetId) !== String(nightState.barkeeperTargetId)) addLiving(wolfTargetId);
  addLiving(nightState.poisonTargetId);

  const loverIds = ids(lovers).filter(playerId => livingIds.has(playerId));
  const prostitute = roles.find(role => role.roleId === 'prostitute' && role.alive);
  const prostituteTargetId = Number(nightState.prostituteTargetId);
  let changed = true;
  while (changed) {
    changed = false;
    if (loverIds.some(playerId => deathIds.has(playerId))) {
      for (const loverId of loverIds) changed = addLiving(loverId) || changed;
    }
    if (Number.isFinite(prostituteTargetId) && deathIds.has(prostituteTargetId) && prostitute) changed = addLiving(prostitute.playerId) || changed;
  }
  return [...deathIds];
}

export function planWerewolfDayDeaths({ roles = [], lovers = [], nightDeathIds = [], accusationId = null, hunterShotId = null } = {}) {
  const activeLivingIds = roles
    .filter(role => role.roleId !== 'gamemaster' && role.alive)
    .map(role => Number(role.playerId));
  const livingIds = new Set(activeLivingIds);
  const loverIds = ids(lovers);
  const expandLovers = deathIds => {
    const result = new Set(ids(deathIds));
    if (loverIds.some(playerId => result.has(playerId))) loverIds.forEach(playerId => result.add(playerId));
    return [...result].filter(playerId => livingIds.has(playerId));
  };
  const confirmedNightDeathIds = expandLovers(nightDeathIds);
  const accusationTargetIds = activeLivingIds.filter(playerId => !confirmedNightDeathIds.includes(playerId));
  const selectedAccusationId = Number(accusationId);
  const validAccusationId = accusationTargetIds.includes(selectedAccusationId) ? selectedAccusationId : null;
  const predictedDeathIds = expandLovers([...confirmedNightDeathIds, validAccusationId]);
  const hunter = roles.find(role => role.roleId === 'hunter' && role.alive && predictedDeathIds.includes(Number(role.playerId)));
  const hunterId = hunter ? Number(hunter.playerId) : null;
  const hunterTargetIds = hunterId == null
    ? []
    : activeLivingIds.filter(playerId => playerId !== hunterId && !predictedDeathIds.includes(playerId));
  const selectedHunterShotId = Number(hunterShotId);
  const validHunterShotId = hunterTargetIds.includes(selectedHunterShotId) ? selectedHunterShotId : null;

  return {
    accusationId: validAccusationId,
    accusationTargetIds,
    hunterId,
    hunterTargetIds,
    hunterShotId: validHunterShotId,
    deathIds: expandLovers([...predictedDeathIds, validHunterShotId])
  };
}
