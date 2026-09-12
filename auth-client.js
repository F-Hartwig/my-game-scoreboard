export const authState = { user: null, csrfToken: null };
const params = new URLSearchParams(window.location.search);
const isPreview = params.get('preview') === '1';
const invitationToken = params.get('invite');
let currentSetupMode = 'disabled';

async function jsonRequest(url, options = {}) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    if (authState.csrfToken && !['GET', 'HEAD'].includes(options.method || 'GET')) headers['X-CSRF-Token'] = authState.csrfToken;
    const response = await fetch(url, { ...options, headers });
    let data = null;
    try { data = await response.json(); } catch { /* response may be empty */ }
    if (!response.ok) throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status });
    return data;
}

function showGate(html) {
    const gate = document.getElementById('authGate');
    gate.innerHTML = `<div class="auth-card"><img src="/icon.png" alt="" width="64" height="64"><h1>ScoreBuddy</h1>${html}</div>`;
    gate.hidden = false;
    document.body.classList.add('auth-pending');
}

function errorText(error) {
    return `<p class="auth-error" role="alert">${String(error?.message || 'Unbekannter Fehler').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))}</p>`;
}

function loginView(message = '') {
    showGate(`<p class="auth-intro">Melde dich an, um ScoreBuddy zu verwenden.</p>${message}<form id="loginForm" class="auth-form"><label>Benutzername<input name="username" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><button>Anmelden</button></form><a class="preview-link" href="/?preview=1">Nur-Lesen-Vorschau öffnen</a>`);
    document.getElementById('loginForm').addEventListener('submit', submitLogin);
}

function setupView(message = '') {
    const privateSetup = currentSetupMode === 'private';
    const intro = privateSetup ? 'Richte den ersten Master aus deinem Heimnetz ein.' : 'Richte den ersten Master ein. Remote ist dafür ein separat gesetztes Setup-Token erforderlich.';
    const tokenField = privateSetup ? '' : '<label id="setupTokenLabel">Setup-Token<input name="setupToken" type="password" autocomplete="off"></label>';
    showGate(`<p class="auth-intro">${intro}</p>${message}<form id="setupForm" class="auth-form"><label>Benutzername<input name="username" autocomplete="username" required minlength="3"></label><label>Passwort<input name="password" type="password" autocomplete="new-password" required minlength="8"></label>${tokenField}<small>Mindestens 8 Zeichen.</small><button>Master sicher einrichten</button></form>`);
    document.getElementById('setupForm').addEventListener('submit', submitSetup);
}

async function submitLogin(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        const result = await jsonRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: values.get('username'), password: values.get('password') }) });
        finishAuth(result);
        window.location.reload();
    } catch (error) { loginView(errorText(error)); }
}

async function submitSetup(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
        const setupToken = values.get('setupToken');
        const result = await jsonRequest('/api/auth/setup', { method: 'POST', headers: setupToken ? { 'X-Setup-Token': setupToken } : {}, body: JSON.stringify({ username: values.get('username'), password: values.get('password') }) });
        finishAuth(result);
        window.location.reload();
    } catch (error) { setupView(errorText(error)); }
}

async function invitationView() {
    try {
        const details = await jsonRequest(`/api/invitations/${encodeURIComponent(invitationToken)}`);
        showGate(`<p class="auth-intro">Konto für <strong>${String(details.playerName).replace(/[&<>"']/g, '')}</strong> erstellen.</p><form id="inviteForm" class="auth-form"><label>Benutzername<input name="username" autocomplete="username" required minlength="3"></label><label>Passwort<input name="password" type="password" autocomplete="new-password" required minlength="8"></label><small>Mindestens 8 Zeichen. Die Einladung gilt einmalig.</small><button>Konto erstellen</button></form>`);
        document.getElementById('inviteForm').addEventListener('submit', async event => {
            event.preventDefault();
            const values = new FormData(event.currentTarget);
            try {
                const result = await jsonRequest(`/api/invitations/${encodeURIComponent(invitationToken)}/register`, { method: 'POST', body: JSON.stringify({ username: values.get('username'), password: values.get('password') }) });
                finishAuth(result);
                history.replaceState({}, '', '/');
                window.location.reload();
            } catch (error) { await invitationView(); document.querySelector('.auth-card').insertAdjacentHTML('beforeend', errorText(error)); }
        });
    } catch (error) { showGate(`<p class="auth-intro">Diese Einladung kann nicht verwendet werden.</p>${errorText(error)}<a class="preview-link" href="/">Zur Anmeldung</a>`); }
}

function finishAuth(result) {
    authState.user = result.user;
    authState.csrfToken = result.csrfToken;
    document.body.classList.remove('auth-pending');
    document.body.classList.toggle('is-admin', result.user.role === 'admin');
    document.body.classList.toggle('is-user', result.user.role !== 'admin');
    const gate = document.getElementById('authGate');
    if (gate) gate.hidden = true;
    const label = document.getElementById('accountLabel');
    if (label) label.textContent = result.user.username;
}

export async function initializeAuth() {
    if (isPreview) {
        document.body.classList.add('preview-mode', 'is-preview');
        document.getElementById('authGate').hidden = true;
        return true;
    }
    if (invitationToken) { await invitationView(); return false; }
    try {
        finishAuth(await jsonRequest('/api/auth/me'));
        return true;
    } catch (error) {
        if (error.status !== 401) { loginView(errorText(error)); return false; }
        try {
            const status = await jsonRequest('/api/auth/status');
            currentSetupMode = status.setupMode;
            if (status.setupRequired) setupView(); else loginView();
        } catch (statusError) { loginView(errorText(statusError)); }
        return false;
    }
}

export async function authRequest(url, options = {}) {
    return jsonRequest(url, options);
}

export function openAccountModal() {
    const adminButton = authState.user?.role === 'admin' ? '<button class="secondary" onclick="openUserManagement()">Benutzer verwalten</button>' : '';
    window.openModal('Konto', `<p class="modal-copy">Angemeldet als <strong>${authState.user?.username || ''}</strong></p><div class="auth-form"><label>Aktuelles Passwort<input id="currentPassword" type="password" autocomplete="current-password"></label><label>Neues Passwort<input id="newPassword" type="password" autocomplete="new-password"></label><p class="modal-inline-error" id="accountError" hidden></p></div>`, `<button class="secondary" onclick="closeModal()">Schließen</button>${adminButton}<button onclick="changeOwnPassword()">Passwort ändern</button><button class="red" onclick="logout()">Abmelden</button>`);
}

export async function changeOwnPassword() {
    const errorBox = document.getElementById('accountError');
    try {
        await jsonRequest('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: document.getElementById('currentPassword').value, newPassword: document.getElementById('newPassword').value }) });
        errorBox.textContent = 'Passwort wurde geändert.'; errorBox.hidden = false;
    } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
}

export async function logout() {
    try { await jsonRequest('/api/auth/logout', { method: 'POST', body: '{}' }); } finally { window.location.href = '/'; }
}

function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

async function playersAndUsers() {
    const [playersResponse, users] = await Promise.all([fetch('/api/players'), jsonRequest('/api/users')]);
    if (!playersResponse.ok) throw new Error('Spieler konnten nicht geladen werden.');
    return { players: await playersResponse.json(), users };
}

export async function openPlayerAccount(playerId) {
    try {
        const { players, users } = await playersAndUsers();
        const playerName = players.find(player => String(player.id) === String(playerId))?.name || 'Spieler';
        const linked = users.find(user => String(user.playerId) === String(playerId));
        if (linked) {
            const roleLabel = linked.role === 'admin' ? ' <span class="stats-count-badge">Master</span>' : '';
            const passwordField = linked.role === 'admin' ? '<p class="modal-copy">Das Master-Passwort änderst du über dein Konto oben rechts.</p>' : '<div class="auth-form"><label>Neues Startpasswort (optional)<input id="playerResetPassword" type="password" autocomplete="new-password"></label><p class="modal-inline-error" id="playerAccountError" hidden></p></div>';
            const accountActions = linked.role === 'admin' ? '' : `<button onclick="resetPlayerAccountPassword(${linked.id})">Speichern</button><button class="red" onclick="deletePlayerAccount(${linked.id})">Konto löschen</button>`;
            window.openModal(`Konto · ${html(playerName)}`, `<p class="modal-copy">Verknüpft mit <strong>${html(linked.username)}</strong>${roleLabel}.</p>${passwordField}`, `<button class="secondary" onclick="closeModal()">Schließen</button><button class="secondary" onclick="unlinkPlayerAccount(${linked.id})">Verknüpfung lösen</button>${accountActions}`, 'player-account-modal');
            return;
        }
        window.openModal(`Konto · ${html(playerName)}`, `<p class="modal-copy">Der Spieler kann ohne Konto bleiben, direkt ein Konto erhalten oder per einmaliger Einladung selbst eines anlegen.</p><div class="auth-form"><label>Benutzername<input id="newPlayerUsername" autocomplete="username"></label><label>Startpasswort<input id="newPlayerPassword" type="password" autocomplete="new-password"></label><p class="modal-inline-error" id="playerAccountError" hidden></p></div>`, `<button class="secondary" onclick="closeModal()">Schließen</button><button class="secondary" onclick="createPlayerInvitation('${String(playerId)}')">QR-Einladung</button><button onclick="createDirectPlayerAccount('${String(playerId)}')">Konto anlegen</button>`, 'player-account-modal');
    } catch (error) { window.openModal('Konto', errorText(error), '<button class="secondary" onclick="closeModal()">Schließen</button>'); }
}

function showPlayerError(error) {
    const box = document.getElementById('playerAccountError');
    if (box) { box.textContent = error.message; box.hidden = false; }
}

export async function createDirectPlayerAccount(playerId) {
    try {
        await jsonRequest('/api/users', { method: 'POST', body: JSON.stringify({ username: document.getElementById('newPlayerUsername').value, password: document.getElementById('newPlayerPassword').value, playerId }) });
        window.closeModal();
    } catch (error) { showPlayerError(error); }
}

export async function createPlayerInvitation(playerId) {
    try {
        const invite = await jsonRequest(`/api/players/${encodeURIComponent(playerId)}/invitations`, { method: 'POST', body: '{}' });
        const encodedSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(invite.qrSvg)}`;
        window.openModal('Einladung erstellt', `<p class="modal-copy">Einmalig verwendbar und 24 Stunden gültig.</p><div class="preview-qr"><img src="${encodedSvg}" alt="QR-Code zur Konto-Einladung"></div><label class="preview-link-label">Einladungslink<input id="inviteUrl" value="${html(invite.inviteUrl)}" readonly></label><p class="modal-inline-error" id="playerAccountError" hidden></p>`, `<button class="secondary" onclick="revokeInvitation(${invite.id})">Widerrufen</button><button onclick="copyInvitationLink()">Link kopieren</button>`);
    } catch (error) { showPlayerError(error); }
}

export async function revokeInvitation(id) {
    try { await jsonRequest(`/api/invitations/${id}`, { method: 'DELETE', body: '{}' }); window.closeModal(); }
    catch (error) { showPlayerError(error); }
}

export async function copyInvitationLink() {
    const input = document.getElementById('inviteUrl');
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); }
}

export async function unlinkPlayerAccount(id) {
    try { await jsonRequest(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ playerId: null }) }); window.closeModal(); }
    catch (error) { showPlayerError(error); }
}

export async function resetPlayerAccountPassword(id) {
    const password = document.getElementById('playerResetPassword').value;
    if (!password) return window.closeModal();
    try { await jsonRequest(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ password }) }); window.closeModal(); }
    catch (error) { showPlayerError(error); }
}

export async function deletePlayerAccount(id) {
    try { await jsonRequest(`/api/users/${id}`, { method: 'DELETE', body: '{}' }); window.closeModal(); }
    catch (error) { showPlayerError(error); }
}

export async function openUserManagement() {
    try {
        const [{ players, users }, invitations] = await Promise.all([playersAndUsers(), jsonRequest('/api/invitations')]);
        const rows = users.map(user => {
            const selectedPlayerId = String(user.playerId ?? '');
            return `<div class="user-row user-account-row"><div><strong>${html(user.username)}</strong><small>${user.role === 'admin' ? 'Master' : 'Benutzer'}</small></div><select id="userPlayer_${user.id}" data-current-value="${html(selectedPlayerId)}" aria-label="Spielerzuordnung für ${html(user.username)}" onchange="saveUserBinding(${user.id}, this)"><option value="">Nicht verknüpft</option>${players.map(player => `<option value="${html(player.id)}" ${selectedPlayerId === String(player.id) ? 'selected' : ''}>${html(player.name)}</option>`).join('')}</select>${user.role === 'admin' ? '<span class="user-row-action-spacer" aria-hidden="true"></span>' : `<button class="icon-btn delete-btn user-row-delete" onclick="deletePlayerAccount(${user.id})" aria-label="Konto ${html(user.username)} löschen">×</button>`}</div>`;
        }).join('');
        const invitationRows = invitations.map(invite => `<div class="user-row invitation-row"><div><strong>${html(invite.playerName)}</strong><small>Einladung bis ${new Date(invite.expiresAt).toLocaleString('de-DE')}</small></div><button class="icon-btn delete-btn user-row-delete" onclick="revokeInvitation(${invite.id})" aria-label="Einladung widerrufen">×</button></div>`).join('') || '<p class="modal-copy">Keine aktiven Einladungen.</p>';
        window.openModal('Benutzer verwalten', `<div class="user-list">${rows}</div><h4>Aktive Einladungen</h4><div class="user-list">${invitationRows}</div><p class="modal-inline-error" id="playerAccountError" hidden></p>`, '<button class="secondary" onclick="closeModal()">Schließen</button>');
    } catch (error) { showPlayerError(error); }
}

export async function saveUserBinding(id, select = document.getElementById(`userPlayer_${id}`)) {
    if (!select) return;
    const value = select.value;
    const previousValue = select.dataset.currentValue || '';
    if (value === previousValue) return;
    const errorBox = document.getElementById('playerAccountError');
    if (errorBox) { errorBox.textContent = ''; errorBox.hidden = true; }
    select.disabled = true;
    try {
        await jsonRequest(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify({ playerId: value || null }) });
        select.dataset.currentValue = value;
    } catch (error) {
        select.value = previousValue;
        showPlayerError(error);
    } finally {
        select.disabled = false;
    }
}

window.openAccountModal = openAccountModal;
window.changeOwnPassword = changeOwnPassword;
window.logout = logout;
window.openPlayerAccount = openPlayerAccount;
window.createDirectPlayerAccount = createDirectPlayerAccount;
window.createPlayerInvitation = createPlayerInvitation;
window.revokeInvitation = revokeInvitation;
window.copyInvitationLink = copyInvitationLink;
window.unlinkPlayerAccount = unlinkPlayerAccount;
window.resetPlayerAccountPassword = resetPlayerAccountPassword;
window.deletePlayerAccount = deletePlayerAccount;
window.openUserManagement = openUserManagement;
window.saveUserBinding = saveUserBinding;
