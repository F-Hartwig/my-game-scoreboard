export function updateWerewolfRoleCount(container, counter, getPlayerCount) {
    const selectedRoles = [...container.querySelectorAll('input[type="number"]')]
        .reduce((total, input) => total + Math.max(0, Math.floor(Number(input.value) || 0)), 0);
    counter.textContent = `${selectedRoles}/${getPlayerCount()}`;
}

export function bindWerewolfRoleCount(container, counter, getPlayerCount) {
    const update = () => updateWerewolfRoleCount(container, counter, getPlayerCount);
    container.querySelectorAll('input[type="number"]').forEach(input => input.addEventListener('input', update));
    update();
    return update;
}
