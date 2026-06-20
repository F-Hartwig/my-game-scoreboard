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

    // Hier 'rulesPage' ergänzt:
    const titles = { gamePage: "🎲 ScoreBuddy", playersPage: "👥 Spieler", statsPage: "🏆 Statistik", rulesPage: "📚 Spielesammlung" };
    document.getElementById("headerTitle").innerText = titles[pageId];

    await loadAllFromDb();
    if(pageId === 'playersPage') renderPlayers();
    if(pageId === 'statsPage') { state.showAllHistory = false; renderRanking(); renderHistory(); }
    if(pageId === 'gamePage') { state.lastRenderedGameId = null; renderGame(); }
    // Hier neu:
    if(pageId === 'rulesPage') renderRulesPage();
}

// ===============================
// MODAL ENGINE
// ===============================
function openModal(title, bodyHtml, actionHtml) {
    document.getElementById("modalTitle").innerText = title;
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
        btn.style.background = '#e2e8f0';
        btn.style.color = '#475569';
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
    openModal("✏️ Name ändern", body, actions);
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
    openModal("🗑️ Spieler l&ouml;schen?", "<p style='color:var(--muted)'>M&ouml;chtest du diesen Spieler wirklich unwiderruflich entfernen?</p>", actions);
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
                        <div class="player-info">${p.wins} 🏆 · ${p.games} Matches</div>
                        ${p.favorite ? `<div class="favorite-badge">⭐ Favorit</div>` : ""}
                    </div>
                </div>
                <div class="actions">
                    <button class="icon-btn edit-btn" onclick="toggleFav(${p.id})">⭐</button>
                    <button class="icon-btn edit-btn" onclick="triggerRename(${p.id})">✏️</button>
                    <button class="icon-btn delete-btn" onclick="triggerDelete(${p.id})">🗑</button>
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

    // --- BEHOBEN: Custom bleibt immer auf Platz 1, Rest wird alphabetisch sortiert ---
    const selectableGames = PREDEFINED_GAMES
        .filter(g => !g.hideFromSelection)
        .sort((a, b) => {
            if (a.id === "custom") return -1; // Custom immer nach ganz oben
            if (b.id === "custom") return 1;
            return a.name.localeCompare(b.name); // Rest alphabetisch
        });
    
    const firstGame = selectableGames[0] || PREDEFINED_GAMES[0];
    const isCustomActive = firstGame.id === "custom";

    let html = `
        <div class="card">
            <div class="title">🎯 0. Spiel auswählen</div>
            <select id="predefinedGameSelect" onchange="handleGameSelectionChange(this.value)" style="width:100%; height:48px; border-radius:var(--radius-md); border:1px solid var(--border); padding:0 14px; font-size:16px; margin-bottom:14px; background:var(--card); font-weight:600; color:var(--text);">
                <!-- --- NEU: Nur die filterten Spiele als Option rendern --- -->
                ${selectableGames.map(g => `<option value="${g.id}">${g.name}</option>`).join("")}
            </select>
            <p id="gameDescriptionText" style="font-size:13px; color:var(--muted); margin-top:-8px; margin-bottom:20px; line-height:1.4; padding:0 4px;">
                ${firstGame.description}
            </p>

            <div id="customGameNameContainer" style="display: ${isCustomActive ? 'block' : 'none'}; margin-bottom: 20px;">
                <div class="title">📝 3. Name des Spiels</div>
                <input id="gameNameInput" placeholder="z.B. Kniffel, Scrabble, Rommé... (optional)">
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div class="title" style="margin:0;">🎮 1. Teilnehmer wählen</div>
                <div class="toggle-container">
                    <button class="toggle-btn active" id="toggleRated" onclick="setRated(true)">Gewertet</button>
                    <button class="toggle-btn" id="toggleUnrated" onclick="setRated(false)">Ungewertet</button>
                </div>
            </div>
            
            <div style="margin-bottom: 14px;">
                <button class="secondary" style="height: 44px; font-size: 14px; background: var(--primary-light); color: var(--primary); border-color: rgba(79, 70, 229, 0.2); font-weight:700;" onclick="openTeamBuilderModal()">👥 + Neues Team erstellen</button>
            </div>

            <div id="selectList" style="margin-bottom: 20px;">`;
            
    // Rendert alle Spieler und Teams (wird ausgelagert, damit wir es dynamisch neu bauen können)
    html += renderSetupPoolHtml();

    html += `
        </div>
        <div class="title">↕️ 2. Reihenfolge anpassen (ziehen)</div>
        <div id="dragOrderList" style="margin-bottom:20px; background:#f8fafc; border:1px solid var(--border); padding:10px; border-radius:var(--radius-md); min-height:50px;">
            <p style="color:var(--muted); font-size:13px; text-align:center; padding:10px;" id="dragPlaceholder">Wähle oben Teilnehmer aus, um deren Reihenfolge festzulegen.</p>
        </div>
        
        <div id="customGameModeContainer" style="display: ${isCustomActive ? 'block' : 'none'};">
            <div class="title">⚙️ 4. Eingabe-Modus wählen</div>
            <div style="display:grid; gap:10px; margin-bottom:20px;">
                <div class="mode-select-card selected" id="modeCardRound" onclick="selectGameMode('round', this)">
                    <div style="display:flex; justify-content:space-between; width:100%; font-weight:700;">
                        <span>Klassischer Runden-Modus</span>
                        <input type="radio" name="gameMode" value="round" checked>
                    </div>
                    <span style="font-size:13px; color:var(--muted)">Alle Spieler tragen am Ende jeder Runde gleichzeitig Punkte ein.</span>
                </div>
                
                <div class="mode-select-card" id="modeCardSingle" onclick="selectGameMode('single', this)">
                    <div style="display:flex; justify-content:space-between; width:100%; font-weight:700;">
                        <span>Flexibler Einzel-Modus</span>
                        <input type="radio" name="gameMode" value="single">
                    </div>
                    <span style="font-size:13px; color:var(--muted)">Punkte werden einzeln oder unregelmäßig eingetragen.</span>
                </div>
            </div>
        </div>

        <button onclick="createGame()">Spiel starten 🚀</button>
        <button class="secondary" style="margin-top:8px;" onclick="cancelSetup()">Abbrechen</button>
    </div>`;

    document.getElementById("gameContent").innerHTML = html;
}

// Generiert den Inhalt der Auswahlliste (filtert vergebene Spieler aus)
function renderSetupPoolHtml() {
    let html = "";
    
    // Ermittle alle Spieler, die bereits in IRGENDEINEM Team vergeben sind
    let assignedPlayerIds = [];
    if(state.tempTeams) {
        state.tempTeams.forEach(t => assignedPlayerIds.push(...t.playerIds));
    }

    // 1. Teams rendern
    if(state.tempTeams && state.tempTeams.length > 0) {
        state.tempTeams.forEach(t => {
            html += `
                <div class="select-card" data-type="team" data-id="${t.id}" onclick="toggleSelectCard(event, this)">
                    <div class="player-left" style="flex:1; min-width:0;">
                        <input type="checkbox" value="${t.id}" onclick="event.stopPropagation(); toggleSelectCard(event, this.parentElement.parentElement)">
                        <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0; background: var(--success-light); color: var(--success);">👥</div>
                        <strong style="word-break: break-all; overflow:hidden; text-overflow:ellipsis;">${t.name}</strong>
                    </div>
                    <button class="icon-btn delete-btn" style="width:32px; height:32px; font-size:12px; flex-shrink:0; margin-left:8px;" onclick="event.stopPropagation(); removeSingleTeam(${t.id})">✕</button>
                </div>`;
        });
    }

    // 2. Einzelspieler rendern (nur wenn sie NICHT in einem Team sind)
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

// ÖFFNET DAS NEUE MODAL ZUR TEAM-ERSTELLUNG
function openTeamBuilderModal() {
    // Finde Spieler heraus, die noch keinem Team angehören
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
        <button onclick="submitTeamBuilderModal()">Team erstellen ✓</button>
    `;

    openModal("👥 Neues Team gründen", bodyHtml, actionsHtml);
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
    state.tempTeams.push({
        id: teamId,
        name: teamName,
        playerIds: playerIds
    });

    closeModal();

    // Pool im DOM refreshen
    const selectList = document.getElementById("selectList");
    if (selectList) {
        selectList.innerHTML = renderSetupPoolHtml();
    }
    updateDragOrderList();
}

function removeSingleTeam(teamId) {
    state.tempTeams = state.tempTeams.filter(x => x.id !== teamId);
    
    // Pool im DOM refreshen, um gelöschte Spieler wieder anzuzeigen
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
        card.draggable = true;
        card.dataset.id = item.id;
        card.dataset.type = item.type;
        card.innerHTML = `
            <div class="player-left">
                <span style="color:var(--muted); font-size:14px; margin-right:4px;">↕️</span>
                <div class="avatar" style="width:28px; height:28px; font-size:10px; ${isTeam ? 'background: var(--success-light); color: var(--success);' : ''}">${isTeam ? '👥' : displayName.substring(0,2).toUpperCase()}</div>
                <strong>${displayName}</strong>
            </div>`;
            
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        
        card.addEventListener('touchstart', (e) => {
            card.classList.add('dragging');
            card.style.opacity = '0.5';
            card.style.transform = 'scale(0.98)';
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
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

        card.addEventListener('touchend', () => {
            card.classList.remove('dragging');
            card.style.opacity = '1';
            card.style.transform = 'none';
        });

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
// ===============================
// CORE MATCH ENGINE & RENDERING
// ===============================
function renderGame(isSyncUpdate = false) {
    if (state.isSettingUpGame) return; 

    let contentBox = document.getElementById("gameContent");
    
    if(!state.currentGame) {
        state.lastRenderedGameId = null;
        let html = `
            <div class="card">
                <div class="title">🎮 Neues Spiel starten</div>
                <p style="color: var(--muted); margin-bottom: 16px;">Aktuell läuft kein Spiel. Möchtest du eine neue Runde werten?</p>
                <button onclick="startSetup()">✨ Neues Spiel anlegen</button>
            </div>`;

        if(state.activeGames && state.activeGames.length > 0) {
            html += `<div class="title" style="margin-top:20px; padding:0 4px;">⏳ Aktive & pausierte Spiele (${state.activeGames.length})</div>`;
                
            state.activeGames.forEach(ag => {
                let modeText = ag.mode === 'round' ? 'Runden-Modus' : 'Einzel-Modus';
                let ratedBadge = ag.rated === false ? ' <span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:6px; font-weight:bold;">Ungewertet</span>' : '';
                
                html += `
                    <div class="active-game-card">
                        <div class="active-game-card-top">
                            <div class="active-game-meta">
                                <strong style="color:var(--text); font-size:15px; display:block; margin-bottom:2px;">🎲 ${ag.name}${ratedBadge}</strong>
                                <span style="font-size:11px; font-weight:600;">📅 Am ${ag.date} · ${modeText}</span>
                            </div>
                            <span class="active-game-badge">⏸ Pausiert</span>
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
                            <button class="resume-btn" onclick="resumeGame(${ag.id})">▶ Weiter spielen</button>
                            <button class="abort-btn" onclick="triggerDeleteActiveGame(${ag.id})">🗑</button>
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

    // HILFSFUNKTION FÜR CANASTA-PILLEN
    const getCanastaPill = (totalPoints) => {
        if (state.currentGame.gameTypeId !== "canasta") return "";
        let req = 50;
        if (totalPoints < 0) req = 15;
        else if (totalPoints >= 1500 && totalPoints < 3000) req = 90;
        else if (totalPoints >= 3000) req = 120;
        return `<span style="font-size: 11px; font-weight: 700; background: #eedffc; color: #7c3aed; padding: 2px 6px; border-radius: 6px; margin-left: 6px; border: 1px solid rgba(124, 58, 237, 0.2);">📋 Min: ${req}</span>`;
    };

    if (state.lastRenderedGameId === state.currentGame.id && document.getElementById("gameStatusLabel")) {
        document.getElementById("gameStatusLabel").innerText = `⚡ ${statusText}`;
        
        state.currentGame.players.forEach(p => {
            const isLeading = p.total === highestScore && anyRoundsPlayed && leadsCount === 1;
            
            let metaBox = document.getElementById(`meta_${p.id}`);
            if (metaBox) {
                metaBox.innerHTML = `<span>${p.name}</span>${getCanastaPill(p.total)}${isLeading ? '<span>👑</span>' : ''}`;
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
        ? `<button class="secondary" style="width:auto; height:32px; font-size:13px; padding:0 10px; border-radius:8px; flex-shrink:0; font-weight:700;" onclick="showGameRulesModal()">📜 Regeln</button>`
        : '';

    let html = `
        <div class="card" style="padding: 12px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span id="gameStatusLabel" style="font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:55%;">⚡ ${statusText}</span>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                ${rulesBtnHtml}
                <button class="secondary" style="width:40px; height:32px; font-size:14px; padding:0; border-radius:8px;" onclick="pauseCurrentGame()">⏸</button>
            </div>
        </div>

        <div class="card" style="padding: 14px 12px;">
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
                        ${isLeading ? '<span>👑</span>' : ''}
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

    if(state.currentGame.mode === 'round') {
        html += `
            <div class="card" id="inputCardAnchor">
                <div class="title">➕ Runde eintragen</div>
                <div class="round-grid" id="roundInputs">`;

        state.currentGame.players.forEach((p, idx) => {
            html += `
                <div class="round-player-row" style="background:#f8fafc; border:1px solid var(--border); padding:8px 12px; display:flex; align-items:center; gap:8px;">
                    <span class="player-name" style="flex:1;">${p.name}</span>
                    <button id="sign_${p.id}" onclick="toggleSign(${p.id})" style="width:36px; height:38px; border-radius:var(--radius-sm); background:#e2e8f0; color:#475569; font-size:16px; font-weight:800; padding:0; flex-shrink:0;">+</button>
                    <input type="text" inputmode="numeric" id="inp_${p.id}" placeholder="0" style="width:85px; height:38px; text-align:center; font-weight:700;"
                    onkeydown="handleRoundEnter(event, ${idx})">
                </div>`;
        });

        html += `</div>
                <button onclick="addRoundRow()">Runde speichern ✓</button>
                <button class="green" style="margin-top: 8px;" onclick="finishGame()">🏆 Spiel beenden</button>
             </div>`;
    } else {
        html += `
            <div class="card">
                <div class="title">➕ Einzelpunkte eintragen</div>
                <div class="round-grid" id="roundInputs">`;

        state.currentGame.players.forEach((p, idx) => {
            html += `
                <div class="round-player-row" style="display:flex; align-items:center; gap:8px;">
                    <span class="player-name" style="flex:1;">${p.name}</span>
                    <button id="sign_${p.id}" onclick="toggleSign(${p.id})" style="width:36px; height:38px; border-radius:var(--radius-sm); background:#e2e8f0; color:#475569; font-size:16px; font-weight:800; padding:0; flex-shrink:0;">+</button>
                    <input type="text" inputmode="numeric" id="inp_${p.id}" placeholder="0" style="width:85px; height:38px; text-align:center; font-weight:700;"
                    onkeydown="handleSingleEnter(event, ${p.id})">
                    <button class="submit-single-btn" onclick="addSingleScore(${p.id})" style="width:38px; height:38px;">✓</button>
                </div>`;
        });

        html += `</div>
                <button class="green" style="margin-top: 14px;" onclick="finishGame()">🏆 Spiel beenden</button>
             </div>`;
    }

    contentBox.innerHTML = html;
    
    setTimeout(() => {
        state.currentGame.players.forEach(p => {
            let sd = document.getElementById("scroll_" + p.id);
            if(sd) instantScrollToContainerEnd(sd);
        });
    }, 40);
}

function showGameRulesModal() {
    if (!state.currentGame || !state.currentGame.rules || !state.currentGame.rules.descriptionLong) return;
    
    let body = `<div style="font-size:14px; color:var(--text); line-height:1.5; padding:4px 0;">${state.currentGame.rules.descriptionLong}</div>`;
    let actions = `<button class="secondary" onclick="closeModal()">Schließen</button>`;
    
    openModal(`📜 ${state.currentGame.name} Regeln`, body, actions);
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
        btn.style.background = '#e2e8f0';
        btn.style.color = '#475569';
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
                background: ${isNegative ? 'var(--danger-light)' : '#e2e8f0'}; 
                color: ${isNegative ? 'var(--danger)' : '#475569'};">
                ${isNegative ? '-' : '+'}
            </button>
            <input type="text" inputmode="decimal" id="modalRoundInput" value="${absoluteValue}" style="text-align:center; font-weight:bold; font-size:18px;">
        </div>`;
        
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button onclick="submitEditRound()">✓ Speichern</button>`;
    
    openModal("✏️ Wert bearbeiten", body, actions);
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
    openModal("🗑️ Spielstand verwerfen?", body, actions);
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
            <div class="title">🏆 Wer hat gewonnen?</div>
            <div id="winnerCardsList" style="margin-bottom:16px;">
                <div class="winner-select-card" data-id="Unentschieden" onclick="selectWinnerCard(this)">
                    <div class="player-left">🤝 <strong>Unentschieden</strong></div>
                </div>`;

    state.currentGame.players.forEach(p => {
        const isBest = p.total === bestScore;
        html += `
            <div class="winner-select-card ${isBest ? 'selected' : ''}" data-id="${p.id}" onclick="selectWinnerCard(this)">
                <div class="player-left" style="flex: 1; min-width: 0;">
                    <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0; ${p.isTeam ? 'background: var(--success-light); color: var(--success);' : ''}">${p.isTeam ? '👥' : p.name.substring(0,2).toUpperCase()}</div>
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
        <div class="card" style="text-align:center; padding:24px 16px;">
            <div style="font-size:48px; margin-bottom:4px;">👑</div>
            <div style="font-size:22px; font-weight:850; color:var(--success);">${game.winner}</div>
            <p style="color:var(--muted); font-size:13px; font-weight:600; margin-top:4px;">🎲 ${game.name}${textModeInfo} · 📅 ${game.date}</p>
        </div>

        <div class="card">
            <div class="title">📊 Endresultat</div>`;

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

    html += `<button style="margin-top:14px;" onclick="newGame()">Hauptmenü</button></div>`;
    document.getElementById("gameContent").innerHTML = html;
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
        let badge = ["🥇", "🥈", "🥉"][i] || "🏅";

        box.innerHTML += `
            <div class="rank-card">
                <div class="rank-card-header">
                    <span>${badge}</span>
                    <span>${p.name}</span>
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
        let unratedTag = g.rated === false ? ' <span style="font-size:10px; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:6px; font-weight:bold;">Freundschaft</span>' : '';
        box.innerHTML += `
            <div class="history-card" onclick="viewGameDetails(${g.id})">
                <div class="history-card-top">
                    <div class="history-card-info">
                        <div class="history-card-date">🎲 ${g.name}${unratedTag}</div>
                        <div class="history-card-sub">📅 ${g.date}</div>
                    </div>
                    <div class="winner-badge">🏆 ${g.winner}</div>
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
                📜 Alle anzeigen (${state.games.length} Spiele)
            </button>`;
    }
}

function triggerShowAllHistory() {
    state.showAllHistory = true;
    renderHistory();
}

function viewGameDetails(gameId) {
    let g = state.games.find(x => x.id === gameId);
    if(!g) return;

    let highestScore = Math.max(...g.players.map(p => p.total));
    let anyRoundsPlayed = g.players.some(p => p.rounds && p.rounds.length > 0);

    let modeTextInfo = g.rated === false ? 'Freundschaftsspiel' : 'Gewertetes Match';
    let html = `
        <p style="color: var(--muted); font-size:13px; margin-bottom:16px; font-weight:500;">
            📅 Datum: ${g.date} · Typ: ${modeTextInfo}
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
                        ${isWinner ? '<span>👑</span>' : ''}
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
    
    let actions = `
        <button class="secondary" onclick="closeModal()" style="flex:1">Schließen</button>
        <button class="red" onclick="triggerDeleteHistoryGame(${g.id})" style="width:auto; padding:0 14px; background:var(--danger-light); color:var(--danger);">🗑️ Löschen</button>`;
    
    openModal(`📊 ${g.name}`, html, actions);

    setTimeout(() => {
        g.players.forEach(p => {
            let container = document.getElementById("modal_scroll_" + p.id);
            if(container) instantScrollToContainerEnd(container);
        });
    }, 50);
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
        openModal("⚠️ Spiel unwiderruflich löschen?", body, actions);
    }, 300);
}

async function initApp() {
    await loadAllFromDb();
    renderGame();
    startLiveSync(); 
}
// ===============================
// RULES COLLECTION SCREEN
// ===============================
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
            ? `<span style="font-size:11px; font-weight:700; background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:6px; margin-left:8px; border:1px solid var(--border); vertical-align:middle;">📖 Nur Regeln</span>`
            : '';

        // --- NEU: Play-Button generieren, wenn es kein reines Regel-Spiel ist ---
        let playBtnHtml = !g.hideFromSelection
            ? `<button class="icon-btn edit-btn" style="width:34px; height:34px; font-size:14px; background:var(--primary-light); color:var(--primary); margin-left:auto; flex-shrink:0;" 
                title="Spiel starten" onclick="event.stopPropagation(); quickStartGame('${g.id}')">▶</button>`
            : '';

        box.innerHTML += `
            <div class="history-card" style="cursor: default;">
                <div class="history-card-top" style="border-bottom: none; padding-bottom: 0; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                    <div class="history-card-info" style="flex:1; min-width:0;">
                        <div class="history-card-date" style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                            🎲 ${g.name} ${pureRulesBadge}
                        </div>
                    </div>
                    ${playBtnHtml}
                </div>
                <div class="history-card-sub" style="margin-top: 6px; line-height: 1.4; color:var(--muted); font-size:12px; font-weight:600;">${g.description}</div>
                ${g.rules && g.rules.descriptionLong ? `
                    <button class="secondary" style="margin-top: 10px; height: 36px; font-size: 13px; font-weight: 700;" 
                        onclick="openCollectionRulesModal('${g.id}')">
                        📜 Regelbuch öffnen
                    </button>
                ` : ''}
            </div>`;
    });
}

// --- OPTIMIERT: Direkt-Start-Funktion mit automatischer Pausen-Sicherung ---
async function quickStartGame(gameId) {
    // 1. Sicherheitsschranke: Falls aktuell ein Spiel läuft, pausiere es automatisch zuerst
    if (state.currentGame && state.currentGame.id) {
        await pauseCurrentGame(); // Sichert das Spiel fehlerfrei auf dem NAS / im Speicher
    }

    // 2. Simuliere den Klick auf den "Spiel"-Reiter in der Navigationsleiste unten
    const gameTab = document.querySelector(".bottom-nav .nav-item:first-child");
    
    // 3. Rufe das Setup auf
    startSetup();
    
    // 4. Setze das Dropdown auf das gewählte Spiel
    const selectEl = document.getElementById("predefinedGameSelect");
    if (selectEl) {
        selectEl.value = gameId;
        // Triggere das Onchange-Event für Beschreibungen und Modi im Hintergrund
        handleGameSelectionChange(gameId);
    }
    
    // 5. Navigation visuell abschließen
    if (gameTab) {
        navigate('gamePage', gameTab);
    }
}


// Hilfsfunktion, um das Modal aus der Sammlung heraus zu öffnen
function openCollectionRulesModal(gameId) {
    const game = PREDEFINED_GAMES.find(g => g.id === gameId);
    if (!game || !game.rules || !game.rules.descriptionLong) return;
    
    let body = `<div style="font-size:14px; color:var(--text); line-height:1.5; padding:4px 0;">${game.rules.descriptionLong}</div>`;
    let actions = `<button class="secondary" onclick="closeModal()">Schließen</button>`;
    
    openModal(`📜 ${game.name} Regeln`, body, actions);
}

// Vergiss nicht, die neuen Funktionen ganz unten global zu registrieren:
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
initApp();