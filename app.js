import { apiSave } from './api.js';
import { state, loadAllFromDb } from './state.js';
import { PREDEFINED_GAMES } from './gamesConfig.js';

// ===============================
// CORE TIMING & LIVE SYNC
// ===============================
function startLiveSync() {
    if(state.autoRefreshInterval) clearInterval(state.autoRefreshInterval);
    state.autoRefreshInterval = setInterval(async () => {
        if (state.isSettingUpGame) return;

        await loadAllFromDb();
        const activePage = document.querySelector(".page.active").id;
        if (activePage === 'gamePage') renderGame(true); 
        if (activePage === 'playersPage' && document.activeElement.tagName !== 'INPUT') renderPlayers();
        if (activePage === 'statsPage') { renderRanking(); renderHistory(); }
    }, 2000); 
}

function instantScrollToContainerEnd(element) {
    if (!element) return;
    requestAnimationFrame(() => {
        element.scrollLeft = element.scrollWidth;
    });
}

function removeSyncBlockAndNavigate(pageId, element) {
    state.isSettingUpGame = false;
    state.lastRenderedGameId = null; 
    navigate(pageId, element);
}

// ===============================
// NAVIGATION
// ===============================
async function navigate(pageId, element) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
    element.classList.add("active");

    const titles = { gamePage: "ScoreBuddy", playersPage: "Spieler", statsPage: "Statistik", rulesPage: "Spielesammlung" };
    document.getElementById("headerTitle").innerText = titles[pageId];

    await loadAllFromDb();
    if(pageId === 'playersPage') renderPlayers();
    if(pageId === 'statsPage') { state.showAllHistory = false; renderRanking(); renderHistory(); }
    if(pageId === 'gamePage') { state.lastRenderedGameId = null; renderGame(); }
    if(pageId === 'rulesPage') renderRulesPage();
}

// ===============================
// MODAL ENGINE
// ===============================
function openModal(title, bodyHtml, actionHtml) {
    document.getElementById("modalTitle").innerHTML = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    document.getElementById("modalActions").innerHTML = actionHtml;
    document.getElementById("appModal").classList.add("open");
}


function toggleSignElement(btn) {
    if (!btn) return;
    if (btn.innerText === '+') {
        btn.innerText = '-';
        btn.style.background = 'var(--danger-light)';
        btn.style.color = 'var(--danger)';
    } else {
        btn.innerText = '+';
        btn.style.background = 'var(--card-raised)';
        btn.style.color = 'var(--muted)';
    }
}

function closeModal() {
    document.getElementById("appModal").classList.remove("open");
    state.activeEditPlayerId = null;
}

// ===============================
// PLAYERS MANAGEMENT
// ===============================
async function addPlayer() {
    let input = document.getElementById("playerInput");
    let name = input.value.trim();
    if(!name) return;
    state.players.push({ id: Date.now(), name, favorite: false, wins: 0, games: 0, points: 0 });
    input.value = "";
    await apiSave('players', state.players);
    renderPlayers();
}

async function toggleFav(id) {
    let p = state.players.find(x => x.id === id);
    if(p) p.favorite = !p.favorite;
    await apiSave('players', state.players);
    renderPlayers();
}

function triggerRename(id) {
    let p = state.players.find(x => x.id === id);
    state.activeEditPlayerId = id;
    let body = `<input id="modalInput" value="${p.name}">`;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button onclick="submitRename()">Speichern</button>`;
    openModal("Name ändern", body, actions);
}

async function submitRename() {
    let newName = document.getElementById("modalInput").value.trim();
    if(newName && state.activeEditPlayerId) {
        let p = state.players.find(x => x.id === state.activeEditPlayerId);
        if(p) p.name = newName;
        await apiSave('players', state.players);
        renderPlayers();
    }
    closeModal();
}

function triggerDelete(id) {
    state.activeEditPlayerId = id;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDelete()">Löschen</button>`;
    openModal("Spieler löschen?", "<p style='color:var(--muted)'>Möchtest du diesen Spieler wirklich unwiderruflich entfernen?</p>", actions);
}

async function submitDelete() {
    if(state.activeEditPlayerId) {
        state.players = state.players.filter(p => p.id !== state.activeEditPlayerId);
        await apiSave('players', state.players);
        renderPlayers();
    }
    closeModal();
}

function renderPlayers() {
    let box = document.getElementById("playersList");
    if(!box) return; box.innerHTML = "";

    if(state.players.length === 0) {
        box.innerHTML = `<p style="text-align:center; color:var(--muted); padding:20px;">Keine Spieler vorhanden.</p>`;
        return;
    }

    state.players.forEach(p => {
        let initials = p.name.substring(0, 2).toUpperCase();
        box.innerHTML += `
            <div class="player-card">
                <div class="player-left">
                    <div class="avatar">${initials}</div>
                    <div>
                        <div class="player-name">${p.name}</div>
                        <div class="player-info">${p.wins} Siege · ${p.games} Matches</div>
                        ${p.favorite ? `<div class="favorite-badge">Favorit</div>` : ""}
                    </div>
                </div>
                <div class="actions">
                    <button class="icon-btn edit-btn" onclick="toggleFav(${p.id})" aria-label="Favorit umschalten" title="Favorit umschalten">☆</button>
                    <button class="icon-btn edit-btn" onclick="triggerRename(${p.id})" aria-label="Namen ändern" title="Namen ändern">Aa</button>
                    <button class="icon-btn delete-btn" onclick="triggerDelete(${p.id})" aria-label="Spieler löschen" title="Spieler löschen">×</button>
                </div>
            </div>`;
    });
}

// ===============================
// CONFIGURABLE GAME SETUP & TOUCH-DRAG
// ===============================
function startSetup() {
    if(state.players.length < 2) {
        alert("Bitte lege zuerst mindestens 2 Spieler an!");
        return;
    }
    
    state.isSettingUpGame = true;
    state.ratedMode = true;
    state.tempTeams = []; 

    const selectableGames = PREDEFINED_GAMES
        .filter(g => !g.hideFromSelection)
        .sort((a, b) => {
            if (a.id === "custom") return -1; 
            if (b.id === "custom") return 1;
            return a.name.localeCompare(b.name); 
        });
    
    const firstGame = selectableGames[0] || PREDEFINED_GAMES[0];
    const isCustomActive = firstGame.id === "custom";

    let html = `
        <div class="card">
            <div class="title">Spiel auswählen</div>
            <select id="predefinedGameSelect" onchange="handleGameSelectionChange(this.value)" style="width:100%; height:48px; border-radius:var(--radius-md); border:1px solid var(--border); padding:0 14px; font-size:16px; margin-bottom:14px; background:var(--card); font-weight:600; color:var(--text);">
                ${selectableGames.map(g => `<option value="${g.id}">${g.name}</option>`).join("")}
            </select>
            <p id="gameDescriptionText" style="font-size:13px; color:var(--muted); margin-top:-8px; margin-bottom:20px; line-height:1.4; padding:0 4px;">
                ${firstGame.description}
            </p>

            <div id="customGameNameContainer" style="display: ${isCustomActive ? 'block' : 'none'}; margin-bottom: 20px;">
                <div class="title">Name des Spiels</div>
                <input id="gameNameInput" placeholder="z.B. Kniffel, Scrabble, Rommé... (optional)">
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div class="title" style="margin:0;">Teilnehmer wählen</div>
                <div class="toggle-container">
                    <button class="toggle-btn active" id="toggleRated" onclick="setRated(true)">Gewertet</button>
                    <button class="toggle-btn" id="toggleUnrated" onclick="setRated(false)">Ungewertet</button>
                </div>
            </div>
            
            <div style="margin-bottom: 14px;">
                <button class="secondary" style="height: 44px; font-size: 14px; background: var(--primary-light); color: var(--primary); border-color: rgba(79, 70, 229, 0.2); font-weight:700;" onclick="openTeamBuilderModal()">Neues Team erstellen</button>
            </div>

            <div id="selectList" style="margin-bottom: 20px;">`;
            
    html += renderSetupPoolHtml();

    html += `
        </div>
        <div class="title">Reihenfolge festlegen</div>
        <div id="dragOrderList" style="margin-bottom:20px; background:var(--card); border:1px solid var(--border); padding:10px; border-radius:var(--radius-md); min-height:50px;">
            <p style="color:var(--muted); font-size:13px; text-align:center; padding:10px;" id="dragPlaceholder">Wähle oben Teilnehmer aus, um deren Reihenfolge festzulegen.</p>
        </div>
        
        <div id="customGameModeContainer" style="display: ${isCustomActive ? 'block' : 'none'};">
    <div class="title">Eingabe-Modus wählen</div>
    <div style="display:grid; gap:10px; margin-bottom:20px;">
        
        <!-- Runden-Modus -->
        <div class="mode-select-card selected" id="modeCardRound" onclick="selectGameMode('round', this)">
            <input type="radio" name="gameMode" value="round" checked onclick="event.stopPropagation();">
            <div class="mode-select-card-content">
                <span style="font-weight:700;">Klassischer Runden-Modus</span>
                <span style="font-size:13px; color:var(--muted)">Alle Spieler tragen am Ende jeder Runde gleichzeitig Punkte ein.</span>
            </div>
        </div>
        
        <!-- Einzel-Modus -->
        <div class="mode-select-card" id="modeCardSingle" onclick="selectGameMode('single', this)">
            <input type="radio" name="gameMode" value="single" onclick="event.stopPropagation();">
            <div class="mode-select-card-content">
                <span style="font-weight:700;">Flexibler Einzel-Modus</span>
                <span style="font-size:13px; color:var(--muted)">Punkte werden einzeln oder unregelmäßig eingetragen.</span>
            </div>
        </div>

    </div>
</div>

        <button onclick="createGame()">Spiel starten</button>
        <button class="secondary" style="margin-top:8px;" onclick="cancelSetup()">Abbrechen</button>
    </div>`;

    document.getElementById("gameContent").innerHTML = html;
}

function renderSetupPoolHtml() {
    let html = "";
    let assignedPlayerIds = [];
    if(state.tempTeams) {
        state.tempTeams.forEach(t => assignedPlayerIds.push(...t.playerIds));
    }

    if(state.tempTeams && state.tempTeams.length > 0) {
        state.tempTeams.forEach(t => {
            html += `
                <div class="select-card" data-type="team" data-id="${t.id}" onclick="toggleSelectCard(event, this)">
                    <div class="player-left" style="flex:1; min-width:0;">
                        <input type="checkbox" value="${t.id}" onclick="event.stopPropagation(); toggleSelectCard(event, this.parentElement.parentElement)">
                        <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0; background: var(--success-light); color: var(--success);">T</div>
                        <strong style="word-break: break-all; overflow:hidden; text-overflow:ellipsis;">${t.name}</strong>
                    </div>
                    <button class="icon-btn delete-btn" style="width:32px; height:32px; font-size:14px; flex-shrink:0; margin-left:8px;" onclick="event.stopPropagation(); removeSingleTeam(${t.id})">×</button>
                </div>`;
        });
    }

    state.players.forEach(p => {
        if (!assignedPlayerIds.includes(p.id)) {
            html += `
                <div class="select-card" data-type="player" data-id="${p.id}" onclick="toggleSelectCard(event, this)">
                    <div class="player-left">
                        <input type="checkbox" value="${p.id}" onclick="event.stopPropagation(); toggleSelectCard(event, this.parentElement.parentElement)">
                        <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0;">${p.name.substring(0,2).toUpperCase()}</div>
                        <strong>${p.name}</strong>
                    </div>
                </div>`;
        }
    });

    return html;
}

function openTeamBuilderModal() {
    let assignedPlayerIds = [];
    if(state.tempTeams) {
        state.tempTeams.forEach(t => assignedPlayerIds.push(...t.playerIds));
    }
    let availablePlayers = state.players.filter(p => !assignedPlayerIds.includes(p.id));

    if (availablePlayers.length < 2) {
        alert("Es gibt nicht genügend freie Einzelspieler, um ein neues Team zu bilden!");
        return;
    }

    let bodyHtml = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">Wähle die Spieler aus, die zusammen ein Team bilden sollen:</p>
        <div id="modalTeamPlayersList" style="max-height:260px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; padding:2px;">`;

    availablePlayers.forEach(p => {
        bodyHtml += `
            <div class="select-card" style="margin-bottom:0; padding:10px;" onclick="this.querySelector('input').click(); this.classList.toggle('selected', this.querySelector('input').checked)">
                <div class="player-left">
                    <input type="checkbox" value="${p.id}" onclick="event.stopPropagation(); this.closest('.select-card').classList.toggle('selected', this.checked)">
                    <div class="avatar" style="width:28px; height:28px; font-size:10px;">${p.name.substring(0,2).toUpperCase()}</div>
                    <span style="font-weight:600; font-size:14px;">${p.name}</span>
                </div>
            </div>`;
    });

    bodyHtml += `</div>`;

    let actionsHtml = `
        <button class="secondary" onclick="closeModal()">Abbrechen</button>
        <button onclick="submitTeamBuilderModal()">Team erstellen</button>
    `;

    openModal("Neues Team gründen", bodyHtml, actionsHtml);
}

function submitTeamBuilderModal() {
    const checkedBoxes = [...document.querySelectorAll("#modalTeamPlayersList input:checked")];
    if (checkedBoxes.length < 2) {
        alert("Ein Team muss aus mindestens 2 Spielern bestehen!");
        return;
    }

    const playerIds = checkedBoxes.map(b => Number(b.value));
    const teamPlayers = state.players.filter(p => playerIds.includes(p.id));
    const teamName = teamPlayers.map(p => p.name).join(" / ");
    const teamId = Date.now();

    if(!state.tempTeams) state.tempTeams = [];
    state.tempTeams.push({ id: teamId, name: teamName, playerIds: playerIds });
    closeModal();

    const selectList = document.getElementById("selectList");
    if (selectList) {
        selectList.innerHTML = renderSetupPoolHtml();
    }
    updateDragOrderList();
}

function removeSingleTeam(teamId) {
    state.tempTeams = state.tempTeams.filter(x => x.id !== teamId);
    const selectList = document.getElementById("selectList");
    if (selectList) {
        selectList.innerHTML = renderSetupPoolHtml();
    }
    updateDragOrderList();
}

function handleGameSelectionChange(gameId) {
    const gameConfig = PREDEFINED_GAMES.find(g => g.id === gameId);
    if (!gameConfig) return;
    
    document.getElementById("gameDescriptionText").innerText = gameConfig.description;
    
    const nameContainer = document.getElementById("customGameNameContainer");
    const modeContainer = document.getElementById("customGameModeContainer");

    if (gameId === "custom") {
        if (nameContainer) nameContainer.style.display = "block";
        if (modeContainer) modeContainer.style.display = "block";
        selectGameMode('round', document.getElementById("modeCardRound"));
    } else {
        if (nameContainer) nameContainer.style.display = "none";
        if (modeContainer) modeContainer.style.display = "none";
        
        if (gameConfig.defaultMode === 'single') {
            selectGameMode('single', document.getElementById("modeCardSingle"));
        } else {
            selectGameMode('round', document.getElementById("modeCardRound"));
        }
    }
}

function setRated(val) {
    state.ratedMode = val;
    document.getElementById("toggleRated").classList.toggle("active", val);
    document.getElementById("toggleUnrated").classList.toggle("active", !val);
}

function cancelSetup() {
    state.isSettingUpGame = false;
    state.lastRenderedGameId = null;
    renderGame();
}

function toggleSelectCard(e, cardElement) {
    const checkbox = cardElement.querySelector('input[type="checkbox"]');
    if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
    cardElement.classList.toggle('selected', checkbox.checked);
    updateDragOrderList();
}

function updateDragOrderList() {
    const checkedBoxes = [...document.querySelectorAll("#selectList input:checked")];
    const dragBox = document.getElementById("dragOrderList");
    const placeholder = document.getElementById("dragPlaceholder");
    
    if(checkedBoxes.length === 0) {
        dragBox.innerHTML = "";
        dragBox.appendChild(placeholder);
        return;
    }
    
    if(placeholder) placeholder.remove();
    
    let selectedItems = checkedBoxes.map(b => {
        const card = b.closest(".select-card");
        return { id: Number(b.value), type: card.dataset.type };
    });

    const currentOrderIds = [...dragBox.querySelectorAll(".drag-card")].map(c => Number(c.dataset.id));
    dragBox.innerHTML = "";
    
    const finalItems = currentOrderIds.map(id => {
        return selectedItems.find(item => item.id === id);
    }).filter(Boolean);

    selectedItems.forEach(item => {
        if(!finalItems.some(f => f.id === item.id)) finalItems.push(item);
    });
    
    finalItems.forEach(item => {
        let displayName = "";
        let isTeam = item.type === "team";

        if (isTeam) {
            let t = state.tempTeams.find(x => x.id === item.id);
            displayName = t ? t.name : "Team";
        } else {
            let p = state.players.find(x => x.id === item.id);
            if(!p) return;
            displayName = p.name;
        }
        
        let card = document.createElement("div");
        card.className = "drag-card";
        card.dataset.id = item.id;
        card.dataset.type = item.type;
        card.innerHTML = `
            <div class="player-left">
                <div class="avatar" style="width:28px; height:28px; font-size:10px; ${isTeam ? 'background: var(--success-light); color: var(--success);' : ''}">${isTeam ? 'T' : displayName.substring(0,2).toUpperCase()}</div>
                <strong>${displayName}</strong>
            </div>
            <span class="reorder-handle" draggable="true" role="button" tabindex="0" aria-label="${displayName} verschieben" title="Reihenfolge ändern"></span>`;

        const reorderHandle = card.querySelector('.reorder-handle');

        reorderHandle.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(item.id));
            if (e.dataTransfer.setDragImage) {
                e.dataTransfer.setDragImage(card, 24, card.offsetHeight / 2);
            }
        });
        reorderHandle.addEventListener('dragend', () => card.classList.remove('dragging'));

        reorderHandle.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();

            if (e.key === 'ArrowUp') {
                const previousCard = card.previousElementSibling;
                if (previousCard?.classList.contains('drag-card')) {
                    dragBox.insertBefore(card, previousCard);
                }
            } else {
                const nextCard = card.nextElementSibling;
                if (nextCard?.classList.contains('drag-card')) {
                    dragBox.insertBefore(nextCard, card);
                }
            }

            reorderHandle.focus();
        });
        
        reorderHandle.addEventListener('touchstart', () => {
            card.classList.add('dragging');
            card.style.opacity = '0.5';
            card.style.transform = 'scale(0.98)';
        }, { passive: true });

        reorderHandle.addEventListener('touchmove', (e) => {
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            e.preventDefault(); 

            const touch = e.touches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const closestItem = targetElement ? targetElement.closest('.drag-card') : null;
            
            if (closestItem && closestItem !== dragging) {
                const bounding = closestItem.getBoundingClientRect();
                const offset = touch.clientY - bounding.top - bounding.height / 2;
                if (offset > 0) {
                    dragBox.insertBefore(dragging, closestItem.nextSibling);
                } else {
                    dragBox.insertBefore(dragging, closestItem);
                }
            }
        }, { passive: false });

        const finishTouchDrag = () => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
            card.style.transform = 'none';
        };

        reorderHandle.addEventListener('touchend', finishTouchDrag);
        reorderHandle.addEventListener('touchcancel', finishTouchDrag);

        dragBox.appendChild(card);
    });
    
    dragBox.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(dragBox, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (dragging && !e.touches) { 
            if (afterElement == null) dragBox.appendChild(dragging);
            else dragBox.insertBefore(dragging, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.drag-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: -Infinity }).element;
}

function selectGameMode(mode, element) {
    document.querySelectorAll(".mode-select-card").forEach(c => c.classList.remove("selected"));
    element.classList.add("selected");
    element.querySelector('input[type="radio"]').checked = true;
}

async function createGame() {
    let dragCards = [...document.querySelectorAll("#dragOrderList .drag-card")];
    if(dragCards.length < 2){ alert("Wähle mindestens 2 Parteien aus!"); return; }

    let selectedMode = document.querySelector('input[name="gameMode"]:checked').value;
    let selectedGameId = document.getElementById("predefinedGameSelect").value;
    const gameConfig = PREDEFINED_GAMES.find(g => g.id === selectedGameId);

    let gameName = gameConfig.name;
    if (selectedGameId === "custom") {
        let typedName = document.getElementById("gameNameInput").value.trim();
        gameName = typedName || gameConfig.name;
    }

    state.currentGame = {
        id: Date.now(),
        gameTypeId: gameConfig.id,
        name: gameName,
        mode: selectedMode,
        rated: state.ratedMode,
        date: new Date().toLocaleDateString("de-DE"),
        rules: gameConfig.rules,
        players: dragCards.map(card => {
            let id = Number(card.dataset.id);
            let type = card.dataset.type;
            if (type === "team") {
                let t = state.tempTeams.find(x => x.id === id);
                return { id: t.id, name: t.name, isTeam: true, playerIds: t.playerIds, rounds: [], total: 0 };
            } else {
                let p = state.players.find(x => x.id === id);
                return { id: p.id, name: p.name, isTeam: false, playerIds: [p.id], rounds: [], total: 0 };
            }
        })
    };
    
    state.isSettingUpGame = false;
    state.lastRenderedGameId = null; 
    await apiSave('currentGame', state.currentGame);
    renderGame();
}

// ===============================
// CORE MATCH ENGINE & RENDERING
// ===============================
function renderGame(isSyncUpdate = false) {
    if (state.isSettingUpGame) return; 

    let contentBox = document.getElementById("gameContent");
    
    if(!state.currentGame) {
        state.lastRenderedGameId = null;
        let html = `
            <div class="card welcome-card">
                <div class="welcome-kicker">Bereit für den Spieleabend?</div>
                <div class="title">Neues Spiel starten</div>
                <p class="welcome-copy">Wähle eure Mitspieler, das passende Spiel und behalte jeden Punkt entspannt im Blick.</p>
                <button onclick="startSetup()">Spiel anlegen</button>
            </div>`;

        if(state.activeGames && state.activeGames.length > 0) {
            html += `<div class="title" style="margin-top:20px; padding:0 4px;">Aktive & pausierte Spiele (${state.activeGames.length})</div>`;
                
            state.activeGames.forEach(ag => {
                let modeText = ag.mode === 'round' ? 'Runden-Modus' : 'Einzel-Modus';
                let ratedBadge = ag.rated === false ? ' <span style="font-size:10px; background:var(--card-raised); color:var(--muted); padding:3px 7px; border:1px solid var(--border-strong); border-radius:999px; font-weight:bold;">Ungewertet</span>' : '';
                
                html += `
                    <div class="active-game-card">
                        <div class="active-game-card-top">
                            <div class="active-game-meta">
                                <strong style="color:var(--text); font-size:15px; display:block; margin-bottom:2px;">${ag.name}${ratedBadge}</strong>
                                <span style="font-size:11px; font-weight:600;">${ag.date} · ${modeText}</span>
                            </div>
                            <span class="active-game-badge">Pausiert</span>
                        </div>
                        <div class="active-game-players-box">
                            ${ag.players.map(x => `
                                <div class="active-game-player-line">
                                    <span>${x.name}</span>
                                    <strong>${x.total} Pkt</strong>
                                </div>
                            `).join("")}
                        </div>
                        <div class="active-game-actions">
                            <button class="resume-btn" onclick="resumeGame(${ag.id})">Fortsetzen</button>
                            <button class="abort-btn" onclick="triggerDeleteActiveGame(${ag.id})" aria-label="Spielstand löschen" title="Spielstand löschen">×</button>
                        </div>
                    </div>`;
            });
        }
        contentBox.innerHTML = html;
        return;
    }

    let maxRounds = Math.max(...state.currentGame.players.map(p => p.rounds.length), 0);
    let highestScore = Math.max(...state.currentGame.players.map(p => p.total));
    let leadsCount = state.currentGame.players.filter(p => p.total === highestScore).length;
    let anyRoundsPlayed = state.currentGame.players.some(p => p.rounds.length > 0);

    let modeTextInfo = state.currentGame.rated === false ? ' (Ungewertet)' : '';
    let statusText = state.currentGame.mode === 'round' ? `${state.currentGame.name}${modeTextInfo} · Runde ${maxRounds + 1}` : `${state.currentGame.name}${modeTextInfo}`;

    // --- LOGIK FÜR CANASTA & FEHLENDE PUNKTE BIS ZUM GOAL/LIMIT ---
    const getCanastaPill = (totalPoints) => {
        if (state.currentGame.gameTypeId !== "canasta") return "";
        let req = 50;
        if (totalPoints < 0) req = 15;
        else if (totalPoints >= 1500 && totalPoints < 3000) req = 90;
        else if (totalPoints >= 3000) req = 120;
        return `<span style="font-size: 11px; font-weight: 700; background: var(--primary-light); color: var(--primary); padding: 3px 7px; border-radius: 999px; margin-left: 6px; border: 1px solid var(--border-strong);">Min. ${req}</span>`;
    };

    const getRemainingPointsBadge = (totalPoints) => {
        const rules = state.currentGame.rules;
        if (!rules || rules.endTriggerPoints === null) return "";

        const target = rules.endTriggerPoints;
        const isLowest = rules.winCondition === "lowest";

        if (isLowest) {
            // z.B. Cabo (101) oder Skyjo (100)
            const margin = target - totalPoints;
            if (margin <= 0) {
                return `<span class="game-limit-badge danger">Limit überschritten!</span>`;
            }
            return `<span class="game-limit-badge">${margin} Pkt. bis Limit</span>`;
        } else {
            // z.B. Flip 7 (200) oder Canasta (5000)
            const needed = target - totalPoints;
            if (needed <= 0) {
                return `<span class="game-limit-badge success">Ziel erreicht!</span>`;
            }
            return `<span class="game-limit-badge">noch ${needed} Pkt.</span>`;
        }
    };

    // --- PARTIELLES RE-RENDERING BEI FAST-SYNC ---
    if (state.lastRenderedGameId === state.currentGame.id && document.getElementById("gameStatusLabel")) {
        document.getElementById("gameStatusLabel").innerText = statusText;
        
        state.currentGame.players.forEach(p => {
            const isLeading = p.total === highestScore && anyRoundsPlayed && leadsCount === 1;
            
            let metaBox = document.getElementById(`meta_${p.id}`);
            if (metaBox) {
                metaBox.innerHTML = `<span>${p.name}</span>${getCanastaPill(p.total)}${getRemainingPointsBadge(p.total)}${isLeading ? '<span class="leader-badge">Führt</span>' : ''}`;
            }
            
            let totalBadge = document.getElementById(`total_${p.id}`);
            if (totalBadge) totalBadge.innerText = `${p.total} Pkt`;
            
            let scrollBox = document.getElementById(`scroll_${p.id}`);
            if (scrollBox) {
                let roundCounter = 1;
                let pillsHtml = p.rounds.map((val, i) => {
                    let cls = val > 0 ? 'val-pos' : (val < 0 ? 'val-neg' : '');
                    let prefix = (state.currentGame.mode === 'single' && val > 0) ? '+' : '';
                    
                    let isEvent = false;
                    let displayVal = val;
                    if (typeof val === 'string' && val.startsWith('EVENT:')) {
                        isEvent = true;
                        displayVal = val.replace('EVENT:', '');
                        cls = Number(displayVal) < 0 ? 'val-neg' : 'val-pos';
                        prefix = '';
                    }

                    let label = '';
                    if (state.currentGame.mode === 'round') {
                        if (isEvent) {
                            label = ''; 
                        } else {
                            label = `<span class="r-num">R${roundCounter}:</span>`;
                            roundCounter++; 
                        }
                    }

                    return `
                        <div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, '${val}')">
                            ${label}
                            <span class="${cls}">${prefix}${displayVal}</span>
                        </div>`;
                }).join("");
                if(p.rounds.length === 0) pillsHtml = '<div class="round-pill" style="color:var(--muted); border:none; background:transparent; padding:0;">0 Einträge</div>';
                
                if (scrollBox.dataset.len != p.rounds.length) {
                    scrollBox.innerHTML = pillsHtml;
                    scrollBox.dataset.len = p.rounds.length;
                    instantScrollToContainerEnd(scrollBox);
                }
            }
        });
        return; 
    }

    state.lastRenderedGameId = state.currentGame.id;

    const hasLongRules = state.currentGame.rules && state.currentGame.rules.descriptionLong;
    let rulesBtnHtml = hasLongRules 
        ? `<button class="secondary" style="width:auto; height:32px; font-size:13px; padding:0 10px; border-radius:8px; flex-shrink:0; font-weight:700;" onclick="showGameRulesModal()">Regeln</button>`
        : '';

    let html = `
        <div class="card game-status-card" style="padding: 12px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span id="gameStatusLabel" style="font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:55%;">${statusText}</span>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                ${rulesBtnHtml}
                <button class="secondary" style="width:auto; height:32px; font-size:12px; padding:0 10px; border-radius:10px;" onclick="pauseCurrentGame()">Pausieren</button>
            </div>
        </div>

        <div class="card scoreboard-card" style="padding: 14px 12px;">
            <div class="scoreboard-list">`;

    state.currentGame.players.forEach(p => {
        const isLeading = p.total === highestScore && anyRoundsPlayed && leadsCount === 1;
        
        let roundCounter = 1;
        html += `
            <div class="scoreboard-row">
                <div class="scoreboard-player-header">
                    <div class="player-meta" id="meta_${p.id}">
                        <span>${p.name}</span>
                        ${getCanastaPill(p.total)}
                        ${getRemainingPointsBadge(p.total)}
                        ${isLeading ? '<span class="leader-badge">Führt</span>' : ''}
                    </div>
                    <div class="total-badge" id="total_${p.id}">${p.total} Pkt</div>
                </div>
                <div class="history-scroll" id="scroll_${p.id}" data-len="${p.rounds.length}">
                    ${p.rounds.map((val, i) => {
                        let cls = val > 0 ? 'val-pos' : (val < 0 ? 'val-neg' : '');
                        let prefix = (state.currentGame.mode === 'single' && val > 0) ? '+' : '';
                        
                        let isEvent = false;
                        let displayVal = val;
                        if (typeof val === 'string' && val.startsWith('EVENT:')) {
                            isEvent = true;
                            displayVal = val.replace('EVENT:', '');
                            cls = Number(displayVal) < 0 ? 'val-neg' : 'val-pos';
                            prefix = '';
                        }

                        let label = '';
                        if (state.currentGame.mode === 'round') {
                            if (isEvent) {
                                label = '';
                            } else {
                                label = `<span class="r-num">R${roundCounter}:</span>`;
                                roundCounter++;
                            }
                        }

                        return `
                            <div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, '${val}')">
                                ${label}
                                <span class="${cls}">${prefix}${displayVal}</span>
                            </div>`;
                    }).join("")}
                    ${p.rounds.length === 0 ? '<div class="round-pill" style="color:var(--muted); border:none; background:transparent; padding:0;">0 Einträge</div>' : ''}
                </div>
            </div>`;
    });

    html += `</div></div>`;
    if (state.currentGame.gameTypeId === "wizard") {
        html += `
            <div class="card score-entry-card">
                <div class="title">Wizard Rundenwertung</div>
                <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">Runde ${maxRounds + 1}: Trage die gebotenen und gemachten Stiche ein.</p>
                <button onclick="openWizardRoundModal()">Runde ${maxRounds + 1} auswerten</button>
                <button class="green" style="margin-top: 8px;" onclick="finishGame()">Spiel beenden</button>
            </div>`;
    } else if(state.currentGame.mode === 'round') {
        html += `
            <div class="card score-entry-card" id="inputCardAnchor">
                <div class="title">Runde eintragen</div>
                <div class="round-grid" id="roundInputs">`;

        state.currentGame.players.forEach((p, idx) => {
            html += `
                <div class="round-player-row" style="background:var(--card); border:1px solid var(--border); padding:8px 12px; display:flex; align-items:center; gap:8px;">
                    <span class="player-name" style="flex:1;">${p.name}</span>
                    <button id="sign_${p.id}" onclick="toggleSign(${p.id})" style="width:36px; height:38px; border-radius:var(--radius-sm); background:var(--card-raised); color:var(--muted); font-size:16px; font-weight:800; padding:0; flex-shrink:0; box-shadow:var(--shadow-inset);">+</button>
                    <input type="text" inputmode="numeric" id="inp_${p.id}" placeholder="0" style="width:85px; height:38px; text-align:center; font-weight:700;"
                    onkeydown="handleRoundEnter(event, ${idx})">
                </div>`;
        });

        html += `</div>
                <button onclick="addRoundRow()">Runde speichern</button>
                <button class="green" style="margin-top: 8px;" onclick="finishGame()">Spiel beenden</button>
             </div>`;
    } else {
        html += `
            <div class="card score-entry-card">
                <div class="title">Einzelpunkte eintragen</div>
                <div class="round-grid" id="roundInputs">`;

        state.currentGame.players.forEach((p, idx) => {
            html += `
                <div class="round-player-row" style="display:flex; align-items:center; gap:8px;">
                    <span class="player-name" style="flex:1;">${p.name}</span>
                    <button id="sign_${p.id}" onclick="toggleSign(${p.id})" style="width:36px; height:38px; border-radius:var(--radius-sm); background:var(--card-raised); color:var(--muted); font-size:16px; font-weight:800; padding:0; flex-shrink:0; box-shadow:var(--shadow-inset);">+</button>
                    <input type="text" inputmode="numeric" id="inp_${p.id}" placeholder="0" style="width:85px; height:38px; text-align:center; font-weight:700;"
                    onkeydown="handleSingleEnter(event, ${p.id})">
                    <button class="submit-single-btn" onclick="addSingleScore(${p.id})" style="width:42px; height:38px; font-size:11px;">OK</button>
                </div>`;
        });

        html += `</div>
                <button class="green" style="margin-top: 14px;" onclick="finishGame()">Spiel beenden</button>
             </div>`;
    }

    contentBox.innerHTML = html;
    
    setTimeout(() => {
        state.currentGame.players.forEach(p => {
            let sd = document.getElementById("scroll_" + p.id);
            if(sd) instantScrollToContainerEnd(sd);
        });
    }, 40);

    updateDealerUI();
}


function showGameRulesModal() {
    if (!state.currentGame || !state.currentGame.rules || !state.currentGame.rules.descriptionLong) return;
    
    let body = `<div style="font-size:14px; color:var(--text); line-height:1.5; padding:4px 0;">${state.currentGame.rules.descriptionLong}</div>`;
    let actions = `<button class="secondary" onclick="closeModal()">Schließen</button>`;
    
    openModal(`${state.currentGame.name} · Regeln`, body, actions);
}

function toggleSign(playerId) {
    toggleSignElement(document.getElementById(`sign_${playerId}`));
}

function handleRoundEnter(e, index) {
    if(e.key !== "Enter") return;
    e.preventDefault();
    let inputs = document.querySelectorAll("#roundInputs input");
    if(inputs[index + 1]) inputs[index + 1].focus(); else addRoundRow();
}

function handleSingleEnter(e, playerId) {
    if(e.key !== "Enter") return;
    e.preventDefault();
    addSingleScore(playerId);
}

function resetSignButton(playerId) {
    const btn = document.getElementById(`sign_${playerId}`);
    if (btn) {
        btn.innerText = '+';
        btn.style.background = 'var(--card-raised)';
        btn.style.color = 'var(--muted)';
    }
}

// ===============================
// RULES & GAME END AUTOMATION
// ===============================
function checkGameRulesAndLimits() {
    if (!state.currentGame || !state.currentGame.rules) return;
    
    const rules = state.currentGame.rules;
    let limitReached = false;

    state.currentGame.players.forEach(p => {
        if (rules.exactMatchRule && p.total === rules.exactMatchRule.target) {
            const pointsToDeduct = rules.exactMatchRule.target - rules.exactMatchRule.resetTo;
            
            p.total = rules.exactMatchRule.resetTo;
            p.rounds.push(`EVENT:-${pointsToDeduct}`);
        }

        if (rules.endTriggerPoints !== null && p.total >= rules.endTriggerPoints) {
            limitReached = true;
        }
    });

    if (limitReached) {
        setTimeout(() => {
            finishGame();
        }, 100);
    }
}

async function addRoundRow() {
    state.currentGame.players.forEach(p => {
        let input = document.getElementById("inp_" + p.id);
        let signBtn = document.getElementById("sign_" + p.id);
        
        let cleanVal = input.value.replace(',', '.');
        let val = Number(cleanVal || 0);
        if (isNaN(val)) val = 0;
        
        if (signBtn && signBtn.innerText === '-') {
            val = -Math.abs(val);
        }
        
        p.rounds.push(val);
        p.total += val;

        if (input) input.value = "";
        resetSignButton(p.id);
    });
    
    checkGameRulesAndLimits();
    
    // Geber weiterschalten UND UI sofort updaten:
    if (typeof state.currentGame.dealerIndex !== "number") {
        state.currentGame.dealerIndex = 0;
    }
    state.currentGame.dealerIndex = (state.currentGame.dealerIndex + 1) % state.currentGame.players.length;
    updateDealerUI();

    await apiSave('currentGame', state.currentGame);
    renderGame(true); 
}


async function addSingleScore(playerId) {
    let input = document.getElementById("inp_" + playerId);
    let signBtn = document.getElementById("sign_" + playerId);
    if(!input || input.value === "") return; 
    
    let cleanVal = input.value.replace(',', '.');
    let val = Number(cleanVal);
    if (isNaN(val)) val = 0;

    if (signBtn && signBtn.innerText === '-') {
        val = -Math.abs(val);
    }

    let p = state.currentGame.players.find(x => x.id === playerId);
    if(p) { p.rounds.push(val); p.total += val; }
    
    checkGameRulesAndLimits();
    await apiSave('currentGame', state.currentGame);
    renderGame(true); 
    
    let nextInp = document.getElementById("inp_" + playerId);
    if(nextInp) {
        nextInp.value = ""; 
        nextInp.focus();
    }
    resetSignButton(playerId);
}

let activeEditRoundData = null;

function triggerEditRound(playerId, roundIndex, currentVal) {
    let p = state.currentGame.players.find(x => x.id === playerId);
    activeEditRoundData = { playerId, roundIndex };
    let labelText = state.currentGame.mode === 'round' ? `Runde ${roundIndex + 1}` : `Eintrag ${roundIndex + 1}`;
    
    let displayVal = currentVal;
    if (typeof currentVal === 'string' && currentVal.startsWith('EVENT:')) {
        displayVal = currentVal.replace('EVENT:', '');
    }

    let absoluteValue = Math.abs(Number(displayVal));
    let isNegative = Number(displayVal) < 0;

    let body = `
        <p style="color:var(--muted); margin-bottom:10px; font-size:14px;">Korrigiere die Punktzahl für <strong>${p.name}</strong> (${labelText}):</p>
        <div style="display:flex; gap:8px; align-items:center;">
            <button id="modalSignBtn" onclick="toggleSignElement(this)" style="width:44px; height:48px; border-radius:var(--radius-md); font-size:18px; font-weight:800; padding:0; flex-shrink:0; 
                background: ${isNegative ? 'var(--danger-light)' : 'var(--card-raised)'};
                color: ${isNegative ? 'var(--danger)' : 'var(--muted)'};">
                ${isNegative ? '-' : '+'}
            </button>
            <input type="text" inputmode="decimal" id="modalRoundInput" value="${absoluteValue}" style="text-align:center; font-weight:bold; font-size:18px;">
        </div>`;
        
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button onclick="submitEditRound()">Speichern</button>`;
    
    openModal("Wert bearbeiten", body, actions);
}

async function submitEditRound() {
    let inputVal = document.getElementById("modalRoundInput").value.trim();
    let modalSignBtn = document.getElementById("modalSignBtn");
    
    let cleanVal = inputVal.replace(',', '.');
    let num = Number(cleanVal);
    if(isNaN(num)) num = 0;
    
    if (modalSignBtn && modalSignBtn.innerText === '-') {
        num = -Math.abs(num);
    } else {
        num = Math.abs(num);
    }
    
    if(activeEditRoundData) {
        let p = state.currentGame.players.find(x => x.id === activeEditRoundData.playerId);
        if(p) {
            let wasEvent = typeof p.rounds[activeEditRoundData.roundIndex] === 'string' && p.rounds[activeEditRoundData.roundIndex].startsWith('EVENT:');
            p.rounds[activeEditRoundData.roundIndex] = wasEvent ? `EVENT:${num}` : num;
            
            p.total = p.rounds.reduce((a, b) => {
                let cleanVal = (typeof b === 'string' && b.startsWith('EVENT:')) ? b.replace('EVENT:', '') : b;
                let n = Number(cleanVal);
                return a + (isNaN(n) ? 0 : n);
            }, 0);
            
            let scrollBox = document.getElementById(`scroll_${p.id}`);
            if (scrollBox) scrollBox.dataset.len = -1;
            
            checkGameRulesAndLimits();
            await apiSave('currentGame', state.currentGame);
            renderGame(true); 
        }
    }
    closeModal();
}

async function pauseCurrentGame() {
    if(!state.currentGame) return;
    state.activeGames = state.activeGames.filter(x => x.id !== state.currentGame.id);
    state.activeGames.push(state.currentGame);
    state.currentGame = null;
    await apiSave('activeGames', state.activeGames);
    await apiSave('currentGame', {});
    renderGame();
}

async function resumeGame(gameId) {
    let ag = state.activeGames.find(x => x.id === gameId);
    if(ag) {
        state.currentGame = ag;
        state.activeGames = state.activeGames.filter(x => x.id !== gameId);
        await apiSave('activeGames', state.activeGames);
        await apiSave('currentGame', state.currentGame);
        renderGame();
    }
}

let activeDeleteActiveGameId = null;
function triggerDeleteActiveGame(gameId) {
    activeDeleteActiveGameId = gameId;
    let ag = state.activeGames.find(x => x.id === gameId);
    let body = `<p style="color:var(--muted)">Möchtest du das pausierte Spiel <strong>${ag.name}</strong> wirklich unwiderruflich verwerfen?</p>`;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDeleteActiveGame()">Löschen</button>`;
    openModal("Spielstand verwerfen?", body, actions);
}

async function submitDeleteActiveGame() {
    if(activeDeleteActiveGameId) {
        state.activeGames = state.activeGames.filter(x => x.id !== activeDeleteActiveGameId);
        await apiSave('activeGames', state.activeGames);
        renderGame();
    }
    closeModal();
}

// ===============================
// FINISH GAME & SMART WINNER SUGGESTION
// ===============================
function finishGame() {
    state.isSettingUpGame = true; 
    
    const rules = state.currentGame.rules || { winCondition: "highest" };
    const isLowestWins = rules.winCondition === "lowest";

    let bestScore = isLowestWins 
        ? Math.min(...state.currentGame.players.map(p => p.total))
        : Math.max(...state.currentGame.players.map(p => p.total));

    let html = `
        <div class="card">
            <div class="title">Wer hat gewonnen?</div>
            <div id="winnerCardsList" style="margin-bottom:16px;">
                <div class="winner-select-card" data-id="Unentschieden" onclick="selectWinnerCard(this)">
                    <div class="player-left"><strong>Unentschieden</strong></div>
                </div>`;

    state.currentGame.players.forEach(p => {
        const isBest = p.total === bestScore;
        html += `
            <div class="winner-select-card ${isBest ? 'selected' : ''}" data-id="${p.id}" onclick="selectWinnerCard(this)">
                <div class="player-left" style="flex: 1; min-width: 0;">
                    <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0; ${p.isTeam ? 'background: var(--success-light); color: var(--success);' : ''}">${p.isTeam ? 'T' : p.name.substring(0,2).toUpperCase()}</div>
                    <strong class="player-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</strong>
                    ${isBest ? '<span class="rec-tag" style="margin-left:8px; flex-shrink:0;">Empfehlung</span>' : ''}
                </div>
                <div style="margin-left:auto; padding-left:12px; font-weight:700; font-size:14px; white-space:nowrap; text-align:right; flex-shrink:0;">
                    ${p.total} Pkt
                </div>
            </div>`;
    });

    html += `</div>
            <button class="green" onclick="saveGame()">Spielwertung speichern</button>
            <button class="secondary" style="margin-top:8px;" onclick="cancelSetup()">Zurück</button>
        </div>`;

    document.getElementById("gameContent").innerHTML = html;
}

function selectWinnerCard(element) {
    const isDrawCard = element.getAttribute("data-id") === "Unentschieden";
    
    if (isDrawCard) {
        document.querySelectorAll(".winner-select-card").forEach(c => c.classList.remove("selected"));
        element.classList.add("selected");
    } else {
        const drawCard = document.querySelector('.winner-select-card[data-id="Unentschieden"]');
        if (drawCard) drawCard.classList.remove("selected");
        element.classList.toggle("selected");
        
        const selectedCount = document.querySelectorAll(".winner-select-card.selected").length;
        if (selectedCount === 0 && drawCard) {
            drawCard.classList.add("selected");
        }
    }
}

async function saveGame() {
    let selectedCards = [...document.querySelectorAll(".winner-select-card.selected")];
    let winnerName = "Unentschieden";
    let winnerPartyIds = [];

    if (selectedCards.length > 0 && selectedCards[0].getAttribute("data-id") !== "Unentschieden") {
        winnerPartyIds = selectedCards.map(c => Number(c.getAttribute("data-id")));
        let winnerObjects = winnerPartyIds.map(id => state.currentGame.players.find(x => x.id === id)).filter(Boolean);
        winnerName = winnerObjects.map(w => w.name).join(" + ");
    }

    state.currentGame.winner = winnerName;
    state.currentGame.date = new Date().toLocaleDateString("de-DE");

    if (state.currentGame.rated !== false) {
        let individualWinnerPlayerIds = [];
        if (winnerPartyIds.length > 0) {
            state.currentGame.players.forEach(cp => {
                if (winnerPartyIds.includes(cp.id)) {
                    individualWinnerPlayerIds.push(...cp.playerIds);
                }
            });
        }

        state.players.forEach(p => {
            if (individualWinnerPlayerIds.includes(p.id)) {
                p.wins++;
            }
        });
        
        state.currentGame.players.forEach(cp => {
            cp.playerIds.forEach(pId => {
                let p = state.players.find(x => x.id === pId);
                if(p) { 
                    p.games++; 
                    p.points += (typeof cp.total === 'number' ? cp.total : 0); 
                }
            });
        });
    }

    state.activeGames = state.activeGames.filter(x => x.id !== state.currentGame.id);
    state.games.push(state.currentGame);
    
    const finishedGameCopy = state.currentGame;
    state.currentGame = null; 
    state.lastRenderedGameId = null;

    await apiSave('players', state.players);
    await apiSave('activeGames', state.activeGames);
    await apiSave('games', state.games);
    await apiSave('currentGame', {}); 

    showResult(finishedGameCopy);
}

function showResult(gameData) {
    const game = gameData || state.currentGame; 
    if (!game) return;

    let textModeInfo = game.rated === false ? ' (Freundschaftsspiel)' : '';
    let html = `
        <div class="card result-hero-card" style="text-align:center; padding:24px 16px;">
            <div class="result-label">Ergebnis</div>
            <div style="font-size:22px; font-weight:850; color:var(--success);">${game.winner}</div>
            <p style="color:var(--muted); font-size:13px; font-weight:600; margin-top:4px;">${game.name}${textModeInfo} · ${game.date}</p>
        </div>

        <div class="card">
            <div class="title">Endresultat</div>`;

    const rules = game.rules || { winCondition: "highest" };
    let sortedFinal = [...game.players].sort((a,b) => {
        return rules.winCondition === "lowest" ? a.total - b.total : b.total - a.total;
    });

    let currentRank = 1;
    sortedFinal.forEach((p, idx) => {
        if (idx > 0 && p.total === sortedFinal[idx - 1].total) {
            // bleibt gleich
        } else {
            currentRank = idx + 1;
        }

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border)">
                <span style="font-weight:600; font-size:14px;">${currentRank}. ${p.name}</span>
                <strong style="color:var(--primary); font-size:15px;">${p.total} Pkt</strong>
            </div>`;
    });

    html += `
    <button style="margin-top:14px;" onclick="startRematch()">Revanche starten</button>
    <button class="secondary" style="margin-top:8px;" onclick="newGame()">Hauptmenü</button>
    </div>`;

    document.getElementById("gameContent").innerHTML = html;
}

async function startRematch() {
    // Falls das eben beendete Spiel noch in der Historie ist, nehmen wir das aktuellste
    const lastGame = state.games[state.games.length - 1];
    if (!lastGame) {
        newGame();
        return;
    }

    state.isSettingUpGame = false;
    state.lastRenderedGameId = null;

    // Erstelle ein neues Spiel mit exakt denselben Parametern
    state.currentGame = {
        id: Date.now(),
        gameTypeId: lastGame.gameTypeId,
        name: lastGame.name,
        mode: lastGame.mode,
        rated: lastGame.rated,
        date: new Date().toLocaleDateString("de-DE"),
        rules: lastGame.rules,
        players: lastGame.players.map(p => ({
            id: p.id,
            name: p.name,
            isTeam: p.isTeam || false,
            playerIds: [...(p.playerIds || [p.id])],
            rounds: [],
            total: 0
        }))
    };

    await apiSave('currentGame', state.currentGame);
    renderGame();
}


async function newGame() {
    state.currentGame = null;
    state.isSettingUpGame = false;
    await apiSave('currentGame', {});
    renderGame();
}

// ===============================
// STATS & RANKING
// ===============================
function renderRanking() {
    let box = document.getElementById("ranking");
    if(!box) return; box.innerHTML = "";

    if(state.players.length === 0) {
        box.innerHTML = `<p style="color:var(--muted); text-align:center; padding:10px;">Keine Daten verfügbar.</p>`;
        return;
    }

    let sorted = [...state.players].sort((a, b) => b.wins - a.wins);
    sorted.forEach((p, i) => {
        let winRate = p.games ? Math.round((p.wins / p.games) * 100) : 0;
        let rank = String(i + 1).padStart(2, "0");

        box.innerHTML += `
            <div class="rank-card" style="cursor: pointer; transition: background 0.15s ease;" onclick="openPlayerProfileModal(${p.id})">
                <div class="rank-card-header" style="justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                        <span class="rank-position">${rank}</span>
                        <span>${p.name}</span>
                    </div>
                    <span class="profile-link">Profil</span>
                </div>
                <div class="stat-grid">
                    <div><strong>${p.wins}</strong><span>Siege</span></div>
                    <div><strong>${p.games}</strong><span>Spiele</span></div>
                    <div><strong>${winRate}%</strong><span>Quote</span></div>
                </div>
            </div>`;
    });
}

function renderHistory() {
    let box = document.getElementById("history");
    if(!box) return; box.innerHTML = "";

    if(!state.games || state.games.length === 0) {
        box.innerHTML = `<p style="text-align:center; color:var(--muted); padding:10px;">Keine Spiele aufgezeichnet.</p>`;
        return;
    }

    let reversedGames = [...state.games].reverse();
    let gamesToRender = state.showAllHistory ? reversedGames : reversedGames.slice(0, 5);

    gamesToRender.forEach(g => {
        let unratedTag = g.rated === false ? ' <span style="font-size:10px; background:var(--card-raised); color:var(--muted); padding:3px 7px; border:1px solid var(--border-strong); border-radius:999px; font-weight:bold;">Freundschaft</span>' : '';
        box.innerHTML += `
            <div class="history-card" onclick="viewGameDetails(${g.id})">
                <div class="history-card-top">
                    <div class="history-card-info">
                        <div class="history-card-date">${g.name}${unratedTag}</div>
                        <div class="history-card-sub">${g.date}</div>
                    </div>
                    <div class="winner-badge">Gewinner: ${g.winner}</div>
                </div>
                <div class="history-card-scores">
                    ${g.players.map(p => {
                        const isWinner = g.winner.includes(p.name);
                        return `<span class="history-player-score ${isWinner ? 'is-winner' : ''}">${p.name}: <strong>${p.total}</strong></span>`;
                    }).join("")}
                </div>
            </div>`;
    });

    if (state.games.length > 5 && !state.showAllHistory) {
        box.innerHTML += `
            <button class="secondary" style="margin-top: 10px; height: 40px; font-size: 14px;" onclick="triggerShowAllHistory()">
                Alle anzeigen (${state.games.length} Spiele)
            </button>`;
    }
}

function triggerShowAllHistory() {
    state.showAllHistory = true;
    renderHistory();
}

let activeHistoryGameId = null;

function viewGameDetails(gameId) {
    let g = state.games.find(x => x.id === gameId);
    if(!g) return;

    activeHistoryGameId = gameId;
    let highestScore = Math.max(...g.players.map(p => p.total));
    let anyRoundsPlayed = g.players.some(p => p.rounds && p.rounds.length > 0);
    let modeTextInfo = g.rated === false ? 'Freundschaftsspiel' : 'Gewertetes Match';
    
    let html = `
        <p style="color: var(--muted); font-size:13px; margin-bottom:16px; font-weight:500;">
            Datum: ${g.date} · Typ: ${modeTextInfo}
        </p>
        <div class="modal-scoreboard-list" style="margin-bottom:20px;">`;

    g.players.forEach(p => {
        const isWinner = g.winner.includes(p.name) || (g.winner === 'Unentschieden' && p.total === highestScore && anyRoundsPlayed);
        let roundCounter = 1;
        
        html += `
            <div class="modal-player-card">
                <div class="modal-player-header">
                    <div class="modal-player-meta">
                        <span>${p.name}</span>
                        ${isWinner ? '<span class="leader-badge">Gewinner</span>' : ''}
                    </div>
                    <div class="modal-total-badge">${p.total} Pkt</div>
                </div>
                
                <div class="modal-rounds-container" id="modal_scroll_${p.id}">
                    ${p.rounds.map((val, i) => {
                        let cls = val > 0 ? 'val-pos' : (val < 0 ? 'val-neg' : '');
                        let prefix = (g.mode === 'single' && val > 0) ? '+' : '';
                        
                        let isEvent = false;
                        let displayVal = val;
                        if (typeof val === 'string' && val.startsWith('EVENT:')) {
                            isEvent = true;
                            displayVal = val.replace('EVENT:', '');
                            cls = Number(displayVal) < 0 ? 'val-neg' : 'val-pos';
                            prefix = '';
                        }

                        let label = '';
                        if (g.mode === 'round') {
                            if (isEvent) {
                                label = '';
                            } else {
                                label = `<span class="r-num">R${roundCounter}:</span>`;
                                roundCounter++;
                            }
                        }

                        return `
                            <div class="round-pill">
                                ${label}
                                <span class="${cls}">${prefix}${displayVal}</span>
                            </div>`;
                    }).join("")}
                    ${p.rounds.length === 0 ? '<div class="round-pill" style="color:var(--muted); border:none; background:transparent; padding:0;">0 Einträge</div>' : ''}
                </div>
            </div>`;
    });

    html += `</div>`;
    
    // Titel als HTML-String für innerHTML
    let modalTitle = `<span style="display:flex; align-items:center; gap:8px;">${g.name} <button class="icon-btn edit-btn" style="width:30px; height:28px; font-size:11px; flex-shrink:0;" onclick="triggerRenameHistoryGame(${g.id})" title="Spielnamen ändern" aria-label="Spielnamen ändern">Aa</button></span>`;

    let actions = `
        <button class="secondary" onclick="closeModal()" style="flex:1">Schließen</button>
        <button class="red" onclick="triggerDeleteHistoryGame(${g.id})" style="width:auto; padding:0 14px; background:var(--danger-light); color:var(--danger);">Löschen</button>`;
    
    openModal(modalTitle, html, actions);

    setTimeout(() => {
        g.players.forEach(p => {
            let container = document.getElementById("modal_scroll_" + p.id);
            if(container) instantScrollToContainerEnd(container);
        });
    }, 50);
}

function triggerRenameHistoryGame(gameId) {
    let g = state.games.find(x => x.id === gameId);
    if (!g) return;
    
    activeHistoryGameId = gameId;
    closeModal();

    setTimeout(() => {
        let body = `
            <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">Gib einen neuen Namen für das Spiel ein:</p>
            <input id="historyRenameInput" value="${g.name}" placeholder="z.B. Spieleabend Runde 1...">
        `;
        let actions = `
            <button class="secondary" onclick="viewGameDetails(${gameId})">Abbrechen</button>
            <button onclick="submitRenameHistoryGame()">Speichern</button>
        `;
        openModal("Spielnamen ändern", body, actions);
    }, 200);
}

async function submitRenameHistoryGame() {
    let inputEl = document.getElementById("historyRenameInput");
    if (!inputEl) return;

    let newName = inputEl.value.trim();
    if (newName && activeHistoryGameId) {
        let g = state.games.find(x => x.id === activeHistoryGameId);
        if (g) {
            g.name = newName;
            await apiSave('games', state.games);
            renderHistory();
            viewGameDetails(activeHistoryGameId);
            return;
        }
    }
    closeModal();
}


async function submitDeleteHistoryGame() {
    if(activeHistoryDeleteId) {
        let g = state.games.find(x => x.id === activeHistoryDeleteId);
        if(g) {
            if (g.rated !== false) {
                g.players.forEach(cp => {
                    cp.playerIds.forEach(pId => {
                        let p = state.players.find(x => x.id === pId);
                        if(p) {
                            p.games = Math.max(0, p.games - 1);
                            p.points = Math.max(0, p.points - (typeof cp.total === 'number' ? cp.total : 0));
                            if(g.winner.includes(cp.name)) {
                                p.wins = Math.max(0, p.wins - 1);
                            }
                        }
                    });
                });
            }
            state.games = state.games.filter(x => x.id !== activeHistoryDeleteId);
            await apiSave('players', state.players);
            await apiSave('games', state.games);
            renderRanking();
            renderHistory();
        }
    }
    closeModal();
}

let activeHistoryDeleteId = null;
function triggerDeleteHistoryGame(gameId) {
    activeHistoryDeleteId = gameId;
    let g = state.games.find(x => x.id === gameId);
    closeModal();
    
    setTimeout(() => {
        let body = `<p style="color:var(--muted)">Möchtest du das spiel <strong>${g.name}</strong> wirklich löschen? Alle Siege und Punkte werden restlos aus der Bestenliste abgezogen!</p>`;
        let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDeleteHistoryGame()">Definitiv löschen</button>`;
        openModal("Spiel unwiderruflich löschen?", body, actions);
    }, 300);
}

// ===============================
// RULES COLLECTION SCREEN
// ===============================
function renderRulesPage() {
    let box = document.getElementById("rulesGameList");
    if(!box) return; box.innerHTML = "";

    const gamesWithRules = PREDEFINED_GAMES
        .filter(g => g.id !== "custom")
        .sort((a, b) => a.name.localeCompare(b.name));

    gamesWithRules.forEach(g => {
        let pureRulesBadge = g.hideFromSelection 
            ? `<span style="font-size:11px; font-weight:700; background:var(--card-raised); color:var(--muted); padding:3px 8px; border-radius:999px; margin-left:8px; border:1px solid var(--border-strong); vertical-align:middle;">Nur Regeln</span>`
            : '';

        let playBtnHtml = !g.hideFromSelection
            ? `<button class="icon-btn edit-btn" style="width:34px; height:34px; font-size:14px; background:var(--primary-light); color:var(--primary); margin-left:auto; flex-shrink:0;" 
                title="Spiel starten" aria-label="Spiel starten" onclick="event.stopPropagation(); quickStartGame('${g.id}')">Start</button>`
            : '';

        box.innerHTML += `
            <div class="history-card" style="cursor: default;">
                <div class="history-card-top" style="border-bottom: none; padding-bottom: 0; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div class="history-card-info" style="flex:1; min-width:0;">
                        <div class="history-card-date" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                            ${g.name} ${pureRulesBadge}
                        </div>
                    </div>
                    ${playBtnHtml}
                </div>
                <div class="history-card-sub" style="margin-top: 6px; line-height: 1.4; color:var(--muted); font-size:12px; font-weight:600;">${g.description}</div>
                ${g.rules && g.rules.descriptionLong ? `
                    <button class="secondary" style="margin-top: 10px; height: 36px; font-size: 13px; font-weight: 700;" 
                        onclick="openCollectionRulesModal('${g.id}')">
                        Regelbuch öffnen
                    </button>
                ` : ''}
            </div>`;
    });
}

async function quickStartGame(gameId) {
    if (state.currentGame && state.currentGame.id) {
        await pauseCurrentGame(); 
    }
    const gameTab = document.querySelector(".bottom-nav .nav-item:first-child");
    startSetup();
    
    const selectEl = document.getElementById("predefinedGameSelect");
    if (selectEl) {
        selectEl.value = gameId;
        handleGameSelectionChange(gameId);
    }
    if (gameTab) {
        navigate('gamePage', gameTab);
    }
}

function openCollectionRulesModal(gameId) {
    const game = PREDEFINED_GAMES.find(g => g.id === gameId);
    if (!game || !game.rules || !game.rules.descriptionLong) return;
    
    let body = `<div style="font-size:14px; color:var(--text); line-height:1.5; padding:4px 0;">${game.rules.descriptionLong}</div>`;
    let actions = `<button class="secondary" onclick="closeModal()">Schließen</button>`;
    
    openModal(`${game.name} · Regeln`, body, actions);
}

// ===============================
// DETAILED PLAYER PROFILE STATS
// ===============================
function openPlayerProfileModal(playerId) {
    const p = state.players.find(x => x.id === playerId);
    if (!p) return;

    let gameStats = {}; 
    let partnerStats = {}; 

    state.games.forEach(g => {
        if (g.rated === false) return; 

        const playerInMatch = g.players.find(cp => cp.playerIds && cp.playerIds.includes(playerId));
        if (playerInMatch) {
            let matchDisplayName = g.name || "Custom-Spiel";
            if (g.gameTypeId === "custom" || g.id === "custom") {
                matchDisplayName = g.name || "Custom-Spiel";
            }

            if (!gameStats[matchDisplayName]) {
                gameStats[matchDisplayName] = { games: 0, wins: 0 };
            }
            gameStats[matchDisplayName].games++;
            
            const isWinner = g.winner === playerInMatch.name || g.winner.includes(playerInMatch.name);
            if (isWinner) {
                gameStats[matchDisplayName].wins++;
            }

            if (playerInMatch.isTeam && playerInMatch.playerIds.length > 1) {
                playerInMatch.playerIds.forEach(pId => {
                    if (pId !== playerId) {
                        let partnerObj = state.players.find(x => x.id === pId);
                        if (partnerObj) {
                            if (!partnerStats[partnerObj.name]) {
                                partnerStats[partnerObj.name] = { games: 0, wins: 0 };
                            }
                            partnerStats[partnerObj.name].games++;
                            if (isWinner) partnerStats[partnerObj.name].wins++;
                        }
                    }
                });
            }
        }
    });

    let gamesHtml = "";
    const sortedGameNames = Object.keys(gameStats).sort((a, b) => gameStats[b].wins - gameStats[a].wins);
    
    if (sortedGameNames.length === 0) {
        gamesHtml = `<p style="color:var(--muted); font-size:13px; text-align:center; padding:10px;">Noch keine gewerteten Spieldaten vorhanden.</p>`;
    } else {
        sortedGameNames.forEach(gName => {
            const stats = gameStats[gName];
            const rate = Math.round((stats.wins / stats.games) * 100);
            gamesHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border)">
                    <div style="font-size:14px; font-weight:600;">${gName}</div>
                    <div style="text-align:right; font-size:13px;">
                        <strong>${stats.wins} Siege</strong> <span style="color:var(--muted)">/ ${stats.games} Spiele</span>
                        <span style="margin-left:6px; font-weight:700; color:var(--primary); background:var(--primary-light); padding:2px 6px; border-radius:6px;">${rate}%</span>
                    </div>
                </div>`;
        });
    }

    let partnerHtml = "";
    const sortedPartners = Object.keys(partnerStats).sort((a, b) => partnerStats[b].wins - partnerStats[a].wins);
    
    if (sortedPartners.length > 0) {
        const bestPartnerName = sortedPartners[0];
        const pStats = partnerStats[bestPartnerName];
        const pRate = Math.round((pStats.wins / pStats.games) * 100);
        partnerHtml = `
            <div style="margin-top:16px; background:var(--success-light); border:1px solid rgba(16, 185, 129, 0.2); padding:12px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <div style="font-size:11px; font-weight:700; color:var(--success); text-transform:uppercase; letter-spacing:0.5px;">Beste Team-Harmonie</div>
                    <div style="font-size:15px; font-weight:700; margin-top:2px;">Mit ${bestPartnerName}</div>
                </div>
                <div style="text-align:right; font-size:13px;">
                    <strong>${pStats.wins} Siege</strong> <span style="color:var(--muted)">in ${pStats.games} Spielen</span>
                    <div style="font-weight:800; color:var(--success); font-size:14px;">${pRate}% Win-Rate</div>
                </div>
            </div>`;
    }

    let bodyHtml = `
        <div style="text-align:center; margin-bottom:16px;">
            <div class="avatar" style="width:54px; height:54px; font-size:18px; margin:0 auto 8px auto;">${p.name.substring(0,2).toUpperCase()}</div>
            <h2 style="font-size:20px; font-weight:800;">${p.name}</h2>
            <p style="color:var(--muted); font-size:13px; margin-top:2px;">Gesamt-Erfolgsquote: <strong>${p.games ? Math.round((p.wins / p.games) * 100) : 0}%</strong></p>
        </div>
        
        <div style="font-weight:700; font-size:14px; margin-bottom:8px; color:var(--muted);">Siege nach Spielen</div>
        <div style="display:flex; flex-direction:column; gap:2px; margin-bottom:10px;">
            ${gamesHtml}
        </div>
        ${partnerHtml}
    `;

    let actionsHtml = `<button class="secondary" style="flex:1;" onclick="closeModal()">Schließen</button>`;
    openModal(`Spielerprofil`, bodyHtml, actionsHtml);
}

// ===============================
// THEME ENGINE
// ===============================
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    const btn = document.getElementById("themeToggleBtn");
    if (btn) {
        const isDark = theme === "dark";
        btn.classList.toggle("is-dark", isDark);
        btn.setAttribute("aria-label", isDark ? "Helles Farbschema aktivieren" : "Dunkles Farbschema aktivieren");
        btn.setAttribute("title", isDark ? "Helles Farbschema aktivieren" : "Dunkles Farbschema aktivieren");
    }

    const label = document.getElementById("themeToggleLabel");
    if (label) label.innerText = theme === "dark" ? "Hell" : "Dunkel";

    const themeMeta = document.getElementById("themeColorMeta");
    if (themeMeta) themeMeta.setAttribute("content", theme === "dark" ? "#151b28" : "#f4f7fc");
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("scorebuddy_theme", newTheme);
}

async function initApp() {
    // Theme-Einstellung laden bevor die App rendert
    const storedTheme = localStorage.getItem("scorebuddy_theme");
    const savedTheme = storedTheme === "dark" ? "dark" : "light";
    applyTheme(savedTheme);

    await loadAllFromDb();
    renderGame();
    startLiveSync(); 
}

// ===============================
// TOOLBAR & TIMER ENGINE
// ===============================
let timerInterval = null;
let timerSecondsLeft = 0;
let isTimerExpired = false; // Flag um abgelaufenen Zustand zu erkennen

function toggleTimerMenu() {
    // Wenn der Timer läuft ODER abgelaufen ist: Beim Klick zurücksetzen & beenden
    if (timerInterval || isTimerExpired) {
        stopTimer();
        return;
    }

    let body = `
        <p style="color:var(--muted); font-size:14px; margin-bottom:14px;">Wähle die Zeitdauer für den Zug-Timer:</p>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
            <button class="secondary" onclick="startTimer(30)">30 Sek</button>
            <button class="secondary" onclick="startTimer(60)">1 Min</button>
            <button class="secondary" onclick="startTimer(120)">2 Min</button>
            <button class="secondary" onclick="startTimer(180)">3 Min</button>
            <button class="secondary" onclick="startTimer(300)">5 Min</button>
        </div>
    `;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button>`;
    openModal("Zug-Timer starten", body, actions);
}

function startTimer(seconds) {
    closeModal();
    stopTimer();

    isTimerExpired = false;
    timerSecondsLeft = seconds;
    updateTimerUI();

    timerInterval = setInterval(() => {
        timerSecondsLeft--;
        updateTimerUI();

        if (timerSecondsLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            onTimerExpired();
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isTimerExpired = false;

    const btn = document.getElementById("timerToolBtn");
    const label = document.getElementById("timerLabel");
    if (btn && label) {
        label.innerText = "Timer";
        btn.classList.remove("timer-active", "timer-expired");
    }
}

function updateTimerUI() {
    const btn = document.getElementById("timerToolBtn");
    const label = document.getElementById("timerLabel");
    if (!btn || !label) return;

    btn.classList.add("timer-active");
    btn.classList.remove("timer-expired");

    let mins = Math.floor(timerSecondsLeft / 60);
    let secs = timerSecondsLeft % 60;
    let formattedSecs = secs < 10 ? `0${secs}` : secs;

    label.innerText = mins > 0 ? `${mins}:${formattedSecs}` : `${secs}s`;
}

function onTimerExpired() {
    isTimerExpired = true; // Markiert, dass der Timer abgelaufen ist

    const btn = document.getElementById("timerToolBtn");
    const label = document.getElementById("timerLabel");
    if (btn && label) {
        label.innerText = "Zeit um!";
        btn.classList.remove("timer-active");
        btn.classList.add("timer-expired");
    }

    // Smartphone Vibration (falls unterstützt)
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // Sanfter Piepton über Web Audio API
    try {
        let ctx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.log("Audio nicht unterstützt:", e);
    }
}

// ===============================
// IN-GAME STARTSPIELER-SELEKTOR
// ===============================

// 1. Öffnet das Auswahl-Modal mit allen Mitspielern
function openStartPlayerSelectorModal() {
    if (!state.currentGame || !state.currentGame.players || state.currentGame.players.length < 2) {
        alert("Es muss zuerst ein aktives Spiel mit mindestens 2 Spielern laufen!");
        return;
    }

    const players = state.currentGame.players;

    let body = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:12px;">Wähle den Startspieler manuell oder starte den Zufallsgenerator:</p>
        
        <div id="startPlayerList" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
            ${players.map(p => `
                <div class="select-card start-player-card" data-id="${p.id}" onclick="selectStartPlayerDirectly(${p.id})" style="margin-bottom:0; padding:12px;">
                    <div class="player-left">
                        <div class="avatar" style="width:30px; height:30px; font-size:11px;">${p.isTeam ? 'T' : p.name.substring(0,2).toUpperCase()}</div>
                        <strong class="start-player-name">${p.name}</strong>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    let actions = `
        <button class="secondary" onclick="closeModal()">Abbrechen</button>
        <button id="randomRollBtn" onclick="runStartPlayerAnimation()">Zufällig auswählen</button>
    `;

    openModal("Startspieler bestimmen", body, actions);
}

// 2. Direkt-Auswahl per Klick auf einen Namen
function selectStartPlayerDirectly(playerId) {
    applyNewStartPlayer(playerId);
}

// 3. Animation für den Zufalls-Generator (Roulette-Effekt)
// Animation für den Zufalls-Generator (Roulette-Effekt)
function runStartPlayerAnimation() {
    const cards = [...document.querySelectorAll(".start-player-card")];
    const rollBtn = document.getElementById("randomRollBtn");
    if (cards.length < 2) return;

    if (rollBtn) rollBtn.disabled = true;

    let currentIdx = 0;
    let speed = 70;  // Start-Geschwindigkeit in ms
    let rounds = 0;
    const totalRounds = 16 + Math.floor(Math.random() * 8); // Anzahl der Sprünge

    function highlightNext() {
        // Alle abwählen
        cards.forEach(c => {
            c.classList.remove("selected");
            c.style.borderColor = "";
            c.style.background = "";
        });
        
        // Aktuellen hervorheben
        cards[currentIdx].classList.add("selected");

        // Kurze Vibration bei jedem "Tick" (falls vom Handy unterstützt)
        if ("vibrate" in navigator) {
            navigator.vibrate(20);
        }

        rounds++;
        if (rounds < totalRounds) {
            currentIdx = (currentIdx + 1) % cards.length;
            speed += 18; // Animation wird am Ende spürbar langsamer
            setTimeout(highlightNext, speed);
        } else {
            // Auslosung beendet -> Gewinner-Karte optisch hervorheben
            const winnerCard = cards[currentIdx];
            const winnerId = Number(winnerCard.getAttribute("data-id"));

            winnerCard.classList.remove("selected");
            winnerCard.style.background = "var(--success-light)";
            winnerCard.style.borderColor = "var(--success)";
            
            // Text des Gewinners leicht betonen
            const nameEl = winnerCard.querySelector(".start-player-name");
            if (nameEl) nameEl.innerHTML += " · ausgewählt";

            // Erfolgs-Vibration
            if ("vibrate" in navigator) {
                navigator.vibrate([100, 50, 100]);
            }

            // 1,5 Sekunden warten, damit man den Gewinner klar sieht, bevor geschlossen wird
            setTimeout(() => {
                applyNewStartPlayer(winnerId);
            }, 1500);
        }
    }

    highlightNext();
}

// Wendet die neue Reihenfolge an und speichert
async function applyNewStartPlayer(playerId) {
    const players = state.currentGame.players;
    const targetIdx = players.findIndex(p => p.id === playerId);
    if (targetIdx === -1) return;

    // Reihenfolge der Spieler rotieren (Gewinner nach ganz oben)
    state.currentGame.players = [
        ...players.slice(targetIdx),
        ...players.slice(0, targetIdx)
    ];

    state.lastRenderedGameId = null; // Erzwingt frisches Re-Rendering der Zeilen
    await apiSave('currentGame', state.currentGame);
    renderGame();
    closeModal();
}


// ===============================
// GEBER / DEALER ENGINE
// ===============================

function updateDealerUI() {
    const label = document.getElementById("dealerLabel");
    if (!label) return;

    if (!state.currentGame || !state.currentGame.players || state.currentGame.players.length === 0) {
        label.innerText = "Geber: --";
        return;
    }

    if (typeof state.currentGame.dealerIndex !== "number") {
        state.currentGame.dealerIndex = 0;
    }

    if (state.currentGame.dealerIndex >= state.currentGame.players.length) {
        state.currentGame.dealerIndex = 0;
    }

    const currentDealer = state.currentGame.players[state.currentGame.dealerIndex];
    if (currentDealer) {
        label.innerText = `Geber: ${currentDealer.name}`;
    }
}

async function advanceDealer() {
    if (!state.currentGame || !state.currentGame.players || state.currentGame.players.length === 0) return;

    if (typeof state.currentGame.dealerIndex !== "number") {
        state.currentGame.dealerIndex = 0;
    }

    state.currentGame.dealerIndex = (state.currentGame.dealerIndex + 1) % state.currentGame.players.length;
    
    // Sofort die UI im DOM aktualisieren!
    updateDealerUI();
    
    await apiSave('currentGame', state.currentGame);
}

async function rotateDealerManually() {
    if (!state.currentGame || !state.currentGame.players || state.currentGame.players.length === 0) {
        alert("Es muss zuerst ein aktives Spiel laufen!");
        return;
    }

    await advanceDealer();

    if ("vibrate" in navigator) {
        navigator.vibrate(30);
    }
}
// ===============================
// WÜRFELBECHER ENGINE
// ===============================
let selectedDiceType = 6;  // Standard: W6
let selectedDiceCount = 1; // Standard: 1 Würfel

function openDiceModal() {
    let body = `
        <div style="text-align:center; margin-bottom:16px;">
            <div id="diceDisplayBox" style="display:flex; justify-content:center; align-items:center; gap:8px; flex-wrap:wrap; min-height:80px; margin:10px 0;">
                <!-- Wird dynamisch befüllt -->
            </div>
            <div id="diceTotalLabel" style="font-size:14px; font-weight:700; color:var(--muted); height:20px;">Bereit zum Würfeln!</div>
        </div>

        <div style="margin-bottom:14px;">
            <span style="font-size:12px; font-weight:700; color:var(--muted); display:block; margin-bottom:6px;">WÜRFELTYP</span>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
                <button class="secondary" id="dtype_4" onclick="setDiceType(4)" style="height:34px; font-size:12px; padding:0;">W4</button>
                <button class="secondary" id="dtype_6" onclick="setDiceType(6)" style="height:34px; font-size:12px; padding:0;">W6</button>
                <button class="secondary" id="dtype_8" onclick="setDiceType(8)" style="height:34px; font-size:12px; padding:0;">W8</button>
                <button class="secondary" id="dtype_10" onclick="setDiceType(10)" style="height:34px; font-size:12px; padding:0;">W10</button>
                <button class="secondary" id="dtype_12" onclick="setDiceType(12)" style="height:34px; font-size:12px; padding:0;">W12</button>
                <button class="secondary" id="dtype_20" onclick="setDiceType(20)" style="height:34px; font-size:12px; padding:0;">W20</button>
                <button class="secondary" id="dtype_50" onclick="setDiceType(50)" style="height:34px; font-size:12px; padding:0;">W50</button>
                <button class="secondary" id="dtype_100" onclick="setDiceType(100)" style="height:34px; font-size:12px; padding:0;">W100</button>
            </div>
        </div>

        <div style="margin-bottom:16px;">
            <span style="font-size:12px; font-weight:700; color:var(--muted); display:block; margin-bottom:6px;">ANZAHL (1-5)</span>
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:6px;">
                <button class="secondary" id="dcount_1" onclick="setDiceCount(1)" style="height:34px; font-size:12px; padding:0;">1x</button>
                <button class="secondary" id="dcount_2" onclick="setDiceCount(2)" style="height:34px; font-size:12px; padding:0;">2x</button>
                <button class="secondary" id="dcount_3" onclick="setDiceCount(3)" style="height:34px; font-size:12px; padding:0;">3x</button>
                <button class="secondary" id="dcount_4" onclick="setDiceCount(4)" style="height:34px; font-size:12px; padding:0;">4x</button>
                <button class="secondary" id="dcount_5" onclick="setDiceCount(5)" style="height:34px; font-size:12px; padding:0;">5x</button>
            </div>
        </div>
    `;

    let actions = `
        <button class="secondary" onclick="closeModal()">Schließen</button>
        <button id="rollDiceBtn" onclick="rollDiceAnimation()">Würfeln</button>
    `;

    openModal("Würfelbecher", body, actions);

    // Initial-Darstellung anhand der gewählten Werte rendern
    setDiceType(selectedDiceType);
    setDiceCount(selectedDiceCount);
}

function updateDicePreview() {
    const displayBox = document.getElementById("diceDisplayBox");
    const totalLabel = document.getElementById("diceTotalLabel");
    if (!displayBox) return;

    const boxSize = selectedDiceCount >= 4 ? '52px' : '60px';
    const fontSize = selectedDiceCount >= 4 ? '26px' : '32px';

    let html = '';
    for (let i = 0; i < selectedDiceCount; i++) {
        html += `
            <div style="font-size:${fontSize}; background:var(--bg); border:2px dashed var(--border); border-radius:var(--radius-md); width:${boxSize}; height:${boxSize}; display:flex; align-items:center; justify-content:center; font-weight:800; color:var(--muted);">
                ?
            </div>
        `;
    }

    displayBox.innerHTML = html;
    if (totalLabel) {
        totalLabel.innerText = `Bereit für ${selectedDiceCount}x W${selectedDiceType}!`;
    }
}

function setDiceType(type) {
    selectedDiceType = type;
    [4, 6, 8, 10, 12, 20, 50, 100].forEach(t => {
        const btn = document.getElementById(`dtype_${t}`);
        if (btn) {
            btn.style.borderColor = t === type ? 'var(--primary)' : 'var(--border)';
            btn.style.background = t === type ? 'var(--primary-light)' : 'var(--card)';
            btn.style.color = t === type ? 'var(--primary)' : 'var(--text)';
        }
    });
    updateDicePreview();
}

function setDiceCount(count) {
    selectedDiceCount = count;
    [1, 2, 3, 4, 5].forEach(c => {
        const btn = document.getElementById(`dcount_${c}`);
        if (btn) {
            btn.style.borderColor = c === count ? 'var(--primary)' : 'var(--border)';
            btn.style.background = c === count ? 'var(--primary-light)' : 'var(--card)';
            btn.style.color = c === count ? 'var(--primary)' : 'var(--text)';
        }
    });
    updateDicePreview();
}

function rollDiceAnimation() {
    const displayBox = document.getElementById("diceDisplayBox");
    const totalLabel = document.getElementById("diceTotalLabel");
    const rollBtn = document.getElementById("rollDiceBtn");
    if (!displayBox) return;

    if (rollBtn) rollBtn.disabled = true;

    let rollsLeft = 12;
    let speed = 60;

    function shake() {
        let tempResults = [];
        let tempSum = 0;

        for (let i = 0; i < selectedDiceCount; i++) {
            let val = Math.floor(Math.random() * selectedDiceType) + 1;
            tempResults.push(val);
            tempSum += val;
        }

        const fontSize = selectedDiceType >= 100 ? '22px' : (selectedDiceCount >= 4 ? '26px' : '32px');
        const boxSize = selectedDiceCount >= 4 ? '52px' : '60px';

        displayBox.innerHTML = tempResults.map(v => `
            <div style="font-size:${fontSize}; background:var(--bg); border:2px solid var(--primary); border-radius:var(--radius-md); width:${boxSize}; height:${boxSize}; display:flex; align-items:center; justify-content:center; font-weight:800; color:var(--primary); transform: rotate(${(Math.random() * 16) - 8}deg);">
                ${v}
            </div>
        `).join('');

        if (totalLabel) {
            totalLabel.innerText = selectedDiceCount > 1 ? `Gesamtsumme: ${tempSum}` : `Ergebnis: ${tempSum}`;
        }

        if ("vibrate" in navigator) {
            navigator.vibrate(15);
        }

        rollsLeft--;
        if (rollsLeft > 0) {
            speed += 12;
            setTimeout(shake, speed);
        } else {
            if (rollBtn) rollBtn.disabled = false;
            
            if ("vibrate" in navigator) {
                navigator.vibrate([40, 30, 40]);
            }
        }
    }

    shake();
}

// ===============================
// WIZARD ENGINE (mit Zwischenspeicher)
// ===============================

function calculateWizardPoints(bid, actual) {
    if (bid === actual) {
        return 20 + (actual * 10);
    } else {
        return -10 * Math.abs(bid - actual);
    }
}

// Speichert die aktuellen Input-Werte live im state UND in der DB/LocalStorage
async function saveWizardDraft(playerId) {
    if (!state.currentGame) return;
    if (!state.currentGame.wizardDraft) {
        state.currentGame.wizardDraft = {};
    }

    const bidInput = document.getElementById(`wiz_bid_${playerId}`);
    const actInput = document.getElementById(`wiz_act_${playerId}`);

    state.currentGame.wizardDraft[playerId] = {
        bid: bidInput ? bidInput.value : "",
        act: actInput ? actInput.value : ""
    };

    clearWizardErrors(playerId);

    // WICHTIG: Sofort im LocalStorage / Backend sichern!
    await apiSave('currentGame', state.currentGame);
}

// Modal zur komfortablen Wizard-Rundeneingabe
function openWizardRoundModal() {
    if (!state.currentGame || state.currentGame.gameTypeId !== "wizard") return;

    const maxRounds = Math.max(...state.currentGame.players.map(p => p.rounds.length), 0);
    const currentRoundNum = maxRounds + 1;

    // Entwurf aus dem State laden
    const draft = state.currentGame.wizardDraft || {};

    let body = `
        <p style="color:var(--muted); font-size:13px; margin-bottom:14px;">
            Trage für <strong>Runde ${currentRoundNum}</strong> (${currentRoundNum} Karte/n) Ansage & gemachte Stiche ein:
        </p>

        <div style="display:flex; flex-direction:column; gap:10px;">
            ${state.currentGame.players.map(p => {
                const pDraft = draft[p.id] || { bid: "", act: "" };
                // Falls undefined oder null, leeren String nutzen
                const bidVal = (pDraft.bid !== undefined && pDraft.bid !== null) ? pDraft.bid : "";
                const actVal = (pDraft.act !== undefined && pDraft.act !== null) ? pDraft.act : "";

                return `
                    <div style="background:var(--bg); border:1px solid var(--border); padding:10px; border-radius:var(--radius-md);" id="wiz_card_${p.id}">
                        <div style="font-weight:700; margin-bottom:6px;">${p.name}</div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                            <div>
                                <span style="font-size:11px; color:var(--muted); font-weight:600;">Gefordert (Tipp)</span>
                                <input type="number" inputmode="numeric" id="wiz_bid_${p.id}" value="${bidVal}" placeholder="0" style="height:38px; text-align:center; font-weight:bold; transition:all 0.2s;" oninput="saveWizardDraft(${p.id})">
                            </div>
                            <div>
                                <span style="font-size:11px; color:var(--muted); font-weight:600;">Gemacht (Stiche)</span>
                                <input type="number" inputmode="numeric" id="wiz_act_${p.id}" value="${actVal}" placeholder="0" style="height:38px; text-align:center; font-weight:bold; transition:all 0.2s;" oninput="saveWizardDraft(${p.id})">
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <div id="wizardErrorMsg" style="display:none; color:var(--danger); font-size:12px; font-weight:700; margin-top:12px; text-align:center; padding:8px; background:var(--danger-light); border-radius:var(--radius-sm);"></div>
    `;

    let actions = `
        <button class="secondary" onclick="closeModal()">Schließen</button>
        <button onclick="submitWizardRound()">Runde auswerten</button>
    `;

    openModal(`Wizard · Runde ${currentRoundNum}`, body, actions);
}

// Setzt Fehler-Markierungen zurück
function clearWizardErrors(playerId) {
    const bidInput = document.getElementById(`wiz_bid_${playerId}`);
    const actInput = document.getElementById(`wiz_act_${playerId}`);
    const errBox = document.getElementById("wizardErrorMsg");

    if (bidInput) {
        bidInput.style.borderColor = "";
        bidInput.style.background = "";
    }
    if (actInput) {
        actInput.style.borderColor = "";
        actInput.style.background = "";
    }
    if (errBox) {
        errBox.style.display = "none";
    }
}

async function submitWizardRound() {
    const maxRounds = Math.max(...state.currentGame.players.map(p => p.rounds.length), 0);
    const currentRoundNum = maxRounds + 1;

    let totalActualStiche = 0;
    let hasValidationError = false;
    let errorText = "";

    const errBox = document.getElementById("wizardErrorMsg");

    state.currentGame.players.forEach(p => clearWizardErrors(p.id));

    // 1. Einzelprüfungen durchführen
    state.currentGame.players.forEach(p => {
        let bidInput = document.getElementById(`wiz_bid_${p.id}`);
        let actInput = document.getElementById(`wiz_act_${p.id}`);

        let bid = Number(bidInput?.value || 0);
        let act = Number(actInput?.value || 0);

        if (bid < 0 || act < 0) {
            if (bid < 0 && bidInput) {
                bidInput.style.borderColor = "var(--danger)";
                bidInput.style.background = "var(--danger-light)";
            }
            if (act < 0 && actInput) {
                actInput.style.borderColor = "var(--danger)";
                actInput.style.background = "var(--danger-light)";
            }
            hasValidationError = true;
            errorText = "Negative Stiche sind nicht erlaubt!";
        }

        if (bid > currentRoundNum || act > currentRoundNum) {
            if (bid > currentRoundNum && bidInput) {
                bidInput.style.borderColor = "var(--danger)";
                bidInput.style.background = "var(--danger-light)";
            }
            if (act > currentRoundNum && actInput) {
                actInput.style.borderColor = "var(--danger)";
                actInput.style.background = "var(--danger-light)";
            }
            hasValidationError = true;
            errorText = `Maximal ${currentRoundNum} Stich(e) in Runde ${currentRoundNum} erlaubt!`;
        }

        totalActualStiche += act;
    });

    // 2. Summenprüfung aller gemachten Stiche
    if (!hasValidationError && totalActualStiche !== currentRoundNum) {
        state.currentGame.players.forEach(p => {
            let actInput = document.getElementById(`wiz_act_${p.id}`);
            if (actInput) {
                actInput.style.borderColor = "var(--danger)";
                actInput.style.background = "var(--danger-light)";
            }
        });
        hasValidationError = true;
        errorText = `In Runde ${currentRoundNum} müssen insgesamt genau ${currentRoundNum} Stich(e) verteilt werden (Aktuell: ${totalActualStiche}).`;
    }

    if (hasValidationError) {
        if (errBox) {
            errBox.innerText = errorText;
            errBox.style.display = "block";
        }
        if ("vibrate" in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
        return;
    }

    // 3. Wenn alles valide ist: Punkte auswerten
    state.currentGame.players.forEach(p => {
        let bidInput = document.getElementById(`wiz_bid_${p.id}`);
        let actInput = document.getElementById(`wiz_act_${p.id}`);

        let bid = Number(bidInput?.value || 0);
        let act = Number(actInput?.value || 0);

        let earnedPoints = calculateWizardPoints(bid, act);

        p.rounds.push(earnedPoints);
        p.total += earnedPoints;
    });

    // Zwischenspeicher nach erfolgreichem Auswerten zurücksetzen
    state.currentGame.wizardDraft = {};

    // Geber weiterdrehen
    if (typeof state.currentGame.dealerIndex !== "number") {
        state.currentGame.dealerIndex = 0;
    }
    state.currentGame.dealerIndex = (state.currentGame.dealerIndex + 1) % state.currentGame.players.length;
    updateDealerUI();

    await apiSave('currentGame', state.currentGame);
    closeModal();
    renderGame(true);
}

// =========================================================
// ZENTRALE TOOLBAR-STEUERUNG (Vollautomatisch via Observer)
// =========================================================
function checkAndToggleInGameTools() {
    // Weiche: Sind wir aktuell In-Game?
    // Wir prüfen einfach, ob das Element existiert, das NUR auf dem Spielfeld gerendert wird
    // (z. B. dein Runden-Eingabebereich oder die Scorecard-ID):
    const isGameActive = !!(
        document.getElementById("inputCardAnchor") || 
        document.getElementById("roundInputs") ||
        document.querySelector(".round-grid")
    );

    // Alle Tools mit der Klasse .in-game-only anpassen
    const inGameTools = document.querySelectorAll(".in-game-only");
    inGameTools.forEach(tool => {
        tool.style.display = isGameActive ? "inline-flex" : "none";
    });
}

// Beobachtet automatisch alle HTML-Änderungen auf der Seite
const appObserver = new MutationObserver(() => {
    checkAndToggleInGameTools();
});

// Beobachter auf das gesamte Dokument ansetzen (sobald das DOM bereit ist)
document.addEventListener("DOMContentLoaded", () => {
    appObserver.observe(document.body, { childList: true, subtree: true });
    checkAndToggleInGameTools(); // Initialer Check beim Start
});



// Global registrieren
window.saveWizardDraft = saveWizardDraft;
window.clearWizardErrors = clearWizardErrors;






// Global registrieren
window.openDiceModal = openDiceModal;
window.setDiceType = setDiceType;
window.setDiceCount = setDiceCount;
window.rollDiceAnimation = rollDiceAnimation;



// Global registrieren
window.updateDealerUI = updateDealerUI;
window.rotateDealerManually = rotateDealerManually;
window.advanceDealer = advanceDealer;

// Global registrieren
window.openStartPlayerSelectorModal = openStartPlayerSelectorModal;
window.selectStartPlayerDirectly = selectStartPlayerDirectly;
window.runStartPlayerAnimation = runStartPlayerAnimation;




// Global für HTML-Onclick registrieren
window.toggleTheme = toggleTheme;
window.openPlayerProfileModal = openPlayerProfileModal;
window.quickStartGame = quickStartGame;
window.renderRulesPage = renderRulesPage;
window.openCollectionRulesModal = openCollectionRulesModal;
window.navigate = navigate;
window.removeSyncBlockAndNavigate = removeSyncBlockAndNavigate;
window.addPlayer = addPlayer;
window.toggleFav = toggleFav;
window.triggerRename = triggerRename;
window.submitRename = submitRename;
window.triggerDelete = triggerDelete;
window.submitDelete = submitDelete;
window.closeModal = closeModal;
window.startSetup = startSetup;
window.handleGameSelectionChange = handleGameSelectionChange;
window.setRated = setRated;
window.cancelSetup = cancelSetup;
window.toggleSelectCard = toggleSelectCard;
window.selectGameMode = selectGameMode;
window.createGame = createGame;
window.pauseCurrentGame = pauseCurrentGame;
window.resumeGame = resumeGame;
window.triggerDeleteActiveGame = triggerDeleteActiveGame;
window.submitDeleteActiveGame = submitDeleteActiveGame;
window.toggleSign = toggleSign;
window.handleRoundEnter = handleRoundEnter;
window.addRoundRow = addRoundRow;
window.finishGame = finishGame;
window.handleSingleEnter = handleSingleEnter;
window.addSingleScore = addSingleScore;
window.triggerEditRound = triggerEditRound;
window.submitEditRound = submitEditRound;
window.selectWinnerCard = selectWinnerCard;
window.saveGame = saveGame;
window.newGame = newGame;
window.triggerShowAllHistory = triggerShowAllHistory;
window.viewGameDetails = viewGameDetails;
window.triggerDeleteHistoryGame = triggerDeleteHistoryGame;
window.submitDeleteHistoryGame = submitDeleteHistoryGame;
window.toggleSignElement = toggleSignElement;
window.showGameRulesModal = showGameRulesModal;
window.openTeamBuilderModal = openTeamBuilderModal;
window.submitTeamBuilderModal = submitTeamBuilderModal;
window.removeSingleTeam = removeSingleTeam;
window.triggerRenameHistoryGame = triggerRenameHistoryGame;
window.submitRenameHistoryGame = submitRenameHistoryGame;
window.startRematch = startRematch;
window.toggleTimerMenu = toggleTimerMenu;
window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.openWizardRoundModal = openWizardRoundModal;
window.submitWizardRound = submitWizardRound;


initApp();
