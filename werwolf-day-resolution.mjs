function ids(values = []) {
  return [...new Set(values.map(Number).filter(Number.isFinite))];
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
