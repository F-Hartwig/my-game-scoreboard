export function updateWerewolfRoleCount(container, counter, getPlayerCount) {
    const numberedRoles = [...container.querySelectorAll('input[type="number"]')]
        .reduce((total, input) => total + Math.max(0, Math.floor(Number(input.value) || 0)), 0);
    const selectedRoles = [...container.querySelectorAll('input[type="checkbox"][data-ww-role]')]
        .reduce((total, input) => total + (input.checked ? 1 : 0), numberedRoles);
    counter.textContent = `${selectedRoles}/${getPlayerCount()}`;
}

export function bindWerewolfRoleCount(container, counter, getPlayerCount) {
    const update = () => updateWerewolfRoleCount(container, counter, getPlayerCount);
    container.querySelectorAll('input[type="number"]').forEach(input => input.addEventListener('input', update));
    container.querySelectorAll('input[type="checkbox"][data-ww-role]').forEach(input => input.addEventListener('change', update));
    update();
    return update;
}
