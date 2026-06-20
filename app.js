// ===============================
// STATE & CENTRAL DATABASE LOGIC
// ===============================
let players = [];
let games = [];
let activeGames = [];
let currentGame = null;
let activeEditPlayerId = null;
let showAllHistory = false;
let autoRefreshInterval = null;
let isSettingUpGame = false;
let lastRenderedGameId = null; 
let ratedMode = true;
// ==========================================
// OFFLINE-TESTMODUS (OHNE DATABASE / SERVER)
// ==========================================

// Holt die Daten direkt aus dem Speicher deines Browsers (LocalStorage)
async function apiFetch(endpoint) {
    try {
        const localData = localStorage.getItem(`scorebuddy_${endpoint}`);
        // Wenn für diesen Endpunkt noch nichts gespeichert ist, leeres Array/Objekt zurückgeben
        if (!localData) {
            return endpoint === 'currentGame' ? null : [];
        }
        return JSON.parse(localData);
    } catch (e) {
        console.error("Fehler beim lokalen Laden von " + endpoint, e);
        return endpoint === 'currentGame' ? null : [];
    }
}

// Speichert die Daten direkt im Browser
async function apiSave(endpoint, data) {
    try {
        // Falls currentGame geleert wird (z.B. {}), löschen wir es aus dem Speicher
        if (endpoint === 'currentGame' && (!data || Object.keys(data).length === 0)) {
            localStorage.removeItem(`scorebuddy_${endpoint}`);
        } else {
            localStorage.setItem(`scorebuddy_${endpoint}`, JSON.stringify(data));
        }
    } catch (e) {
        console.error("Fehler beim lokalen Speichern von " + endpoint, e);
    }
}
async function loadAllFromDb() {
    if (isSettingUpGame) return;

    players = await apiFetch('players');
    games = await apiFetch('games');
    activeGames = await apiFetch('activeGames');
    currentGame = await apiFetch('currentGame');
    
    if (Array.isArray(currentGame) && currentGame.length === 0) currentGame = null;
    if (currentGame && Object.keys(currentGame).length === 0) currentGame = null;
}

function startLiveSync() {
    if(autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshInterval = setInterval(async () => {
        if (isSettingUpGame) return;

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
    isSettingUpGame = false;
    lastRenderedGameId = null; 
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

    const titles = { gamePage: "🎲 ScoreBuddy", playersPage: "👥 Spieler", statsPage: "🏆 Statistik" };
    document.getElementById("headerTitle").innerText = titles[pageId];

    await loadAllFromDb();
    if(pageId === 'playersPage') renderPlayers();
    if(pageId === 'statsPage') { showAllHistory = false; renderRanking(); renderHistory(); }
    if(pageId === 'gamePage') { lastRenderedGameId = null; renderGame(); }
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
    activeEditPlayerId = null;
}

// ===============================
// PLAYERS MANAGEMENT
// ===============================
async function addPlayer() {
    let input = document.getElementById("playerInput");
    let name = input.value.trim();
    if(!name) return;
    players.push({ id: Date.now(), name, favorite: false, wins: 0, games: 0, points: 0 });
    input.value = "";
    await apiSave('players', players);
    renderPlayers();
}

async function toggleFav(id) {
    let p = players.find(x => x.id === id);
    if(p) p.favorite = !p.favorite;
    await apiSave('players', players);
    renderPlayers();
}

function triggerRename(id) {
    let p = players.find(x => x.id === id);
    activeEditPlayerId = id;
    let body = `<input id="modalInput" value="${p.name}">`;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button onclick="submitRename()">Speichern</button>`;
    openModal("✏️ Name ändern", body, actions);
}

async function submitRename() {
    let newName = document.getElementById("modalInput").value.trim();
    if(newName && activeEditPlayerId) {
        let p = players.find(x => x.id === activeEditPlayerId);
        if(p) p.name = newName;
        await apiSave('players', players);
        renderPlayers();
    }
    closeModal();
}

function triggerDelete(id) {
    activeEditPlayerId = id;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDelete()">Löschen</button>`;
    openModal("🗑️ Spieler löschen?", "<p style='color:var(--muted)'>Möchtest du diesen Spieler wirklich unwiderruflich entfernen?</p>", actions);
}

async function submitDelete() {
    if(activeEditPlayerId) {
        players = players.filter(p => p.id !== activeEditPlayerId);
        await apiSave('players', players);
        renderPlayers();
    }
    closeModal();
}

function renderPlayers() {
    let box = document.getElementById("playersList");
    if(!box) return; box.innerHTML = "";

    if(players.length === 0) {
        box.innerHTML = `<p style="text-align:center; color:var(--muted); padding:20px;">Keine Spieler vorhanden.</p>`;
        return;
    }

    players.forEach(p => {
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
// CONFIGURABLE GAME SETUP (WITH IPHONE TOUCH-DRAG SUPPORT)
// ===============================
function startSetup() {
    if(players.length < 2) {
        alert("Bitte lege zuerst mindestens 2 Spieler an!");
        return;
    }
    
    isSettingUpGame = true;
    ratedMode = true;

    let html = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                <div class="title" style="margin:0;">🎮 1. Spieler wählen</div>
                <div class="toggle-container">
                    <button class="toggle-btn active" id="toggleRated" onclick="setRated(true)">Gewertet</button>
                    <button class="toggle-btn" id="toggleUnrated" onclick="setRated(false)">Ungewertet</button>
                </div>
            </div>
            <div id="selectList" style="margin-bottom: 20px;">`;
            
    players.forEach(p => {
        html += `
            <div class="select-card" onclick="toggleSelectCard(event, this)">
                <div class="player-left">
                    <input type="checkbox" value="${p.id}" onclick="event.stopPropagation(); toggleSelectCard(event, this.parentElement.parentElement)">
                    <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0;">${p.name.substring(0,2).toUpperCase()}</div>
                    <strong>${p.name}</strong>
                </div>
            </div>`;
    });

    html += `
        </div>

        <div class="title">↕️ 2. Reihenfolge anpassen (ziehen)</div>
        <div id="dragOrderList" style="margin-bottom:20px; background:#f8fafc; border:1px solid var(--border); padding:10px; border-radius:var(--radius-md); min-height:50px;">
            <p style="color:var(--muted); font-size:13px; text-align:center; padding:10px;" id="dragPlaceholder">Wähle oben Spieler aus, um deren Reihenfolge festzulegen.</p>
        </div>

        <div class="title">📝 3. Name des Spiels</div>
        <input id="gameNameInput" placeholder="z.B. Kniffel, Scrabble, Rommé... (optional)" style="margin-bottom: 20px;">
        
        <div class="title">⚙️ 4. Eingabe-Modus wählen</div>
        <div style="display:grid; gap:10px; margin-bottom:20px;">
            <div class="mode-select-card selected" onclick="selectGameMode('round', this)">
                <div style="display:flex; justify-content:space-between; width:100%; font-weight:700;">
                    <span>Klassischer Runden-Modus</span>
                    <input type="radio" name="gameMode" value="round" checked>
                </div>
                <span style="font-size:13px; color:var(--muted)">Alle Spieler tragen am Ende jeder Runde gleichzeitig Punkte ein.</span>
            </div>
            
            <div class="mode-select-card" onclick="selectGameMode('single', this)">
                <div style="display:flex; justify-content:space-between; width:100%; font-weight:700;">
                    <span>Flexibler Einzel-Modus</span>
                    <input type="radio" name="gameMode" value="single">
                </div>
                <span style="font-size:13px; color:var(--muted)">Punkte werden einzeln oder unregelmäßig eingetragen.</span>
            </div>
        </div>

        <button onclick="createGame()">Spiel starten 🚀</button>
        <button class="secondary" style="margin-top:8px;" onclick="cancelSetup()">Abbrechen</button>
    </div>`;

    document.getElementById("gameContent").innerHTML = html;
}

function setRated(val) {
    ratedMode = val;
    document.getElementById("toggleRated").classList.toggle("active", val);
    document.getElementById("toggleUnrated").classList.toggle("active", !val);
}

function cancelSetup() {
    isSettingUpGame = false;
    lastRenderedGameId = null;
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
    
    const currentOrderIds = [...dragBox.querySelectorAll(".drag-card")].map(c => Number(c.dataset.id));
    const selectedIds = checkedBoxes.map(b => Number(b.value));
    
    dragBox.innerHTML = "";
    
    const finalIds = currentOrderIds.filter(id => selectedIds.includes(id));
    selectedIds.forEach(id => { if(!finalIds.includes(id)) finalIds.push(id); });
    
    finalIds.forEach(id => {
        let p = players.find(x => x.id === id);
        if(!p) return;
        
        let card = document.createElement("div");
        card.className = "drag-card";
        card.draggable = true;
        card.dataset.id = p.id;
        card.innerHTML = `
            <div class="player-left">
                <span style="color:var(--muted); font-size:14px; margin-right:4px;">↕️</span>
                <div class="avatar" style="width:28px; height:28px; font-size:10px;">${p.name.substring(0,2).toUpperCase()}</div>
                <strong>${p.name}</strong>
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
    let selectedOrder = [...document.querySelectorAll("#dragOrderList .drag-card")].map(c => Number(c.dataset.id));
    if(selectedOrder.length < 2){ alert("Wähle mindestens 2 Spieler aus!"); return; }

    let selectedMode = document.querySelector('input[name="gameMode"]:checked').value;
    
    let typedName = document.getElementById("gameNameInput").value.trim();
    let defaultName = selectedMode === 'round' ? 'Runden-Spiel' : 'Einzel-Spiel';
    let gameName = typedName || defaultName;

    currentGame = {
        id: Date.now(),
        name: gameName,
        mode: selectedMode,
        rated: ratedMode,
        date: new Date().toLocaleDateString("de-DE"),
        players: selectedOrder.map(id => {
            let p = players.find(x => x.id === id);
            return { id: p.id, name: p.name, rounds: [], total: 0 };
        })
    };
    
    isSettingUpGame = false;
    lastRenderedGameId = null; 
    await apiSave('currentGame', currentGame);
    renderGame();
}

// ===============================
// CORE MATCH ENGINE & RENDERING
// ===============================
function renderGame(isSyncUpdate = false) {
    if (isSettingUpGame) return; 

    let contentBox = document.getElementById("gameContent");
    
    if(!currentGame) {
        lastRenderedGameId = null;
        let html = `
            <div class="card">
                <div class="title">🎮 Neues Spiel starten</div>
                <p style="color: var(--muted); margin-bottom: 16px;">Aktuell läuft kein Spiel. Möchtest du eine neue Runde werten?</p>
                <button onclick="startSetup()">✨ Neues Spiel anlegen</button>
            </div>`;

        if(activeGames && activeGames.length > 0) {
            html += `<div class="title" style="margin-top:20px; padding:0 4px;">⏳ Aktive & pausierte Spiele (${activeGames.length})</div>`;
                
            activeGames.forEach(ag => {
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

    let maxRounds = Math.max(...currentGame.players.map(p => p.rounds.length), 0);
    let highestScore = Math.max(...currentGame.players.map(p => p.total));
    let leadsCount = currentGame.players.filter(p => p.total === highestScore).length;
    let anyRoundsPlayed = currentGame.players.some(p => p.rounds.length > 0);

    let modeTextInfo = currentGame.rated === false ? ' (Ungewertet)' : '';
    let statusText = currentGame.mode === 'round' ? `${currentGame.name}${modeTextInfo} · Runde ${maxRounds + 1}` : `${currentGame.name}${modeTextInfo}`;

    if (lastRenderedGameId === currentGame.id && document.getElementById("gameStatusLabel")) {
        document.getElementById("gameStatusLabel").innerText = `⚡ ${statusText}`;
        
        currentGame.players.forEach(p => {
            const isLeading = p.total === highestScore && anyRoundsPlayed && leadsCount === 1;
            
            let metaBox = document.getElementById(`meta_${p.id}`);
            if (metaBox) {
                metaBox.innerHTML = `<span>${p.name}</span>${isLeading ? '<span>👑</span>' : ''}`;
            }
            
            let totalBadge = document.getElementById(`total_${p.id}`);
            if (totalBadge) totalBadge.innerText = `${p.total} Pkt`;
            
            let scrollBox = document.getElementById(`scroll_${p.id}`);
            if (scrollBox) {
                let pillsHtml = p.rounds.map((val, i) => {
                    let cls = val > 0 ? 'val-pos' : (val < 0 ? 'val-neg' : '');
                    let prefix = (currentGame.mode === 'single' && val > 0) ? '+' : '';
                    let label = currentGame.mode === 'round' ? `<span class="r-num">R${i+1}:</span>` : '';
                    return `
                        <div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, ${val})">
                            ${label}
                            <span class="${cls}">${prefix}${val}</span>
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

    lastRenderedGameId = currentGame.id;

    let html = `
        <div class="card" style="padding: 12px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <span id="gameStatusLabel" style="font-weight:700; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:75%;">⚡ ${statusText}</span>
            <button class="secondary" style="width:40px; height:32px; font-size:14px; padding:0; border-radius:8px; flex-shrink:0;" onclick="pauseCurrentGame()">⏸</button>
        </div>

        <div class="card" style="padding: 14px 12px;">
            <div class="scoreboard-list">`;

    currentGame.players.forEach(p => {
        const isLeading = p.total === highestScore && anyRoundsPlayed && leadsCount === 1;
        
        html += `
            <div class="scoreboard-row">
                <div class="scoreboard-player-header">
                    <div class="player-meta" id="meta_${p.id}">
                        <span>${p.name}</span>
                        ${isLeading ? '<span>👑</span>' : ''}
                    </div>
                    <div class="total-badge" id="total_${p.id}">${p.total} Pkt</div>
                </div>
                <div class="history-scroll" id="scroll_${p.id}" data-len="${p.rounds.length}">
                    ${p.rounds.map((val, i) => {
                        let cls = val > 0 ? 'val-pos' : (val < 0 ? 'val-neg' : '');
                        let prefix = (currentGame.mode === 'single' && val > 0) ? '+' : '';
                        let label = currentGame.mode === 'round' ? `<span class="r-num">R${i+1}:</span>` : '';
                        return `
                            <div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, ${val})">
                                ${label}
                                <span class="${cls}">${prefix}${val}</span>
                            </div>`;
                    }).join("")}
                    ${p.rounds.length === 0 ? '<div class="round-pill" style="color:var(--muted); border:none; background:transparent; padding:0;">0 Einträge</div>' : ''}
                </div>
            </div>`;
    });

    html += `</div></div>`;

    if(currentGame.mode === 'round') {
        html += `
            <div class="card" id="inputCardAnchor">
                <div class="title">➕ Runde eintragen</div>
                <div class="round-grid" id="roundInputs">`;

        currentGame.players.forEach((p, idx) => {
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

        currentGame.players.forEach((p, idx) => {
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
        currentGame.players.forEach(p => {
            let sd = document.getElementById("scroll_" + p.id);
            if(sd) instantScrollToContainerEnd(sd);
        });
    }, 40);
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

// ===============================
// ACTION LOGIC
// ===============================
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

async function addRoundRow() {
    currentGame.players.forEach(p => {
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
    
    await apiSave('currentGame', currentGame);
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

    let p = currentGame.players.find(x => x.id === playerId);
    if(p) { p.rounds.push(val); p.total += val; }
    
    await apiSave('currentGame', currentGame);
    renderGame(true); 
    
    let nextInp = document.getElementById("inp_" + playerId);
    if(nextInp) {
        nextInp.value = ""; 
        nextInp.focus();
    }
    resetSignButton(playerId);
}

// LIVE-RUNDEN BEARBEITUNG
let activeEditRoundData = null;

function triggerEditRound(playerId, roundIndex, currentVal) {
    let p = currentGame.players.find(x => x.id === playerId);
    activeEditRoundData = { playerId, roundIndex };
    let labelText = currentGame.mode === 'round' ? `Runde ${roundIndex + 1}` : `Eintrag ${roundIndex + 1}`;
    
    let absoluteValue = Math.abs(currentVal);
    let isNegative = currentVal < 0;

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
        let p = currentGame.players.find(x => x.id === activeEditRoundData.playerId);
        if(p) {
            p.rounds[activeEditRoundData.roundIndex] = num;
            p.total = p.rounds.reduce((a, b) => a + b, 0);
            
            let scrollBox = document.getElementById(`scroll_${p.id}`);
            if (scrollBox) scrollBox.dataset.len = -1;
            
            await apiSave('currentGame', currentGame);
            renderGame(true); 
        }
    }
    closeModal();
}

async function pauseCurrentGame() {
    if(!currentGame) return;
    activeGames = activeGames.filter(x => x.id !== currentGame.id);
    activeGames.push(currentGame);
    currentGame = null;
    await apiSave('activeGames', activeGames);
    await apiSave('currentGame', {});
    renderGame();
}

async function resumeGame(gameId) {
    let ag = activeGames.find(x => x.id === gameId);
    if(ag) {
        currentGame = ag;
        activeGames = activeGames.filter(x => x.id !== gameId);
        await apiSave('activeGames', activeGames);
        await apiSave('currentGame', currentGame);
        renderGame();
    }
}

let activeDeleteActiveGameId = null;
function triggerDeleteActiveGame(gameId) {
    activeDeleteActiveGameId = gameId;
    let ag = activeGames.find(x => x.id === gameId);
    let body = `<p style="color:var(--muted)">Möchtest du das pausierte Spiel <strong>${ag.name}</strong> wirklich unwiderruflich verwerfen?</p>`;
    let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDeleteActiveGame()">Löschen</button>`;
    openModal("🗑️ Spielstand verwerfen?", body, actions);
}

async function submitDeleteActiveGame() {
    if(activeDeleteActiveGameId) {
        activeGames = activeGames.filter(x => x.id !== activeDeleteActiveGameId);
        await apiSave('activeGames', activeGames);
        renderGame();
    }
    closeModal();
}

// ===============================
// FINISH GAME
// ===============================
function finishGame() {
    isSettingUpGame = true; 
    let highestScore = Math.max(...currentGame.players.map(p => p.total));
    let html = `
        <div class="card">
            <div class="title">🏆 Wer hat gewonnen?</div>
            <div id="winnerCardsList" style="margin-bottom:16px;">
                <div class="winner-select-card" data-id="Unentschieden" onclick="selectWinnerCard(this)">
                    <div class="player-left">🤝 <strong>Unentschieden</strong></div>
                </div>`;

    currentGame.players.forEach(p => {
        const isHighest = p.total === highestScore;
        html += `
            <div class="winner-select-card ${isHighest ? 'selected' : ''}" data-id="${p.id}" onclick="selectWinnerCard(this)">
                <div class="player-left" style="flex: 1; min-width: 0;">
                    <div class="avatar" style="width:32px; height:32px; font-size:11px; flex-shrink:0;">${p.name.substring(0,2).toUpperCase()}</div>
                    <strong class="player-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</strong>
                    ${isHighest ? '<span class="rec-tag" style="margin-left:8px; flex-shrink:0;">Führung</span>' : ''}
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
    document.querySelectorAll(".winner-select-card").forEach(c => c.classList.remove("selected"));
    element.classList.add("selected");
}

async function saveGame() {
    let selectedClass = document.querySelector(".winner-select-card.selected");
    let winnerVal = selectedClass ? selectedClass.getAttribute("data-id") : "Unentschieden";
    let winnerName = "Unentschieden";
    
    let pId = winnerVal !== "Unentschieden" ? Number(winnerVal) : null;
    if(pId !== null) {
        let wObj = currentGame.players.find(x => x.id === pId);
        if(wObj) winnerName = wObj.name;
    }

    currentGame.winner = winnerName;
    currentGame.date = new Date().toLocaleDateString("de-DE");

    if (currentGame.rated !== false) {
        if(pId !== null) {
            players.forEach(p => { if(p.id === pId) p.wins++; });
        }
        currentGame.players.forEach(cp => {
            let p = players.find(x => x.id === cp.id);
            if(p) { p.games++; p.points += cp.total; }
        });
    }

    activeGames = activeGames.filter(x => x.id !== currentGame.id);
    games.push(currentGame);
    
    await apiSave('players', players);
    await apiSave('activeGames', activeGames);
    await apiSave('games', games);
    
    showResult();
}

function showResult() {
    let textModeInfo = currentGame.rated === false ? ' (Freundschaftsspiel)' : '';
    let html = `
        <div class="card" style="text-align:center; padding:24px 16px;">
            <div style="font-size:48px; margin-bottom:4px;">👑</div>
            <div style="font-size:22px; font-weight:850; color:var(--success);">${currentGame.winner}</div>
            <p style="color:var(--muted); font-size:13px; font-weight:600; margin-top:4px;">🎲 ${currentGame.name}${textModeInfo} · 📅 ${currentGame.date}</p>
        </div>

        <div class="card">
            <div class="title">📊 Endresultat</div>`;

    let sortedFinal = [...currentGame.players].sort((a,b) => b.total - a.total);
    sortedFinal.forEach((p, idx) => {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border)">
                <span style="font-weight:600; font-size:14px;">${idx+1}. ${p.name}</span>
                <strong style="color:var(--primary); font-size:15px;">${p.total} Pkt</strong>
            </div>`;
    });

    html += `<button style="margin-top:14px;" onclick="newGame()">Hauptmenü</button></div>`;
    document.getElementById("gameContent").innerHTML = html;
}

async function newGame() {
    currentGame = null;
    isSettingUpGame = false;
    await apiSave('currentGame', {});
    renderGame();
}

// ===============================
// STATS & RANKING
// ===============================
function renderRanking() {
    let box = document.getElementById("ranking");
    if(!box) return; box.innerHTML = "";

    if(players.length === 0) {
        box.innerHTML = `<p style="color:var(--muted); text-align:center; padding:10px;">Keine Daten verfügbar.</p>`;
        return;
    }

    let sorted = [...players].sort((a, b) => b.wins - a.wins);
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

    if(!games || games.length === 0) {
        box.innerHTML = `<p style="text-align:center; color:var(--muted); padding:10px;">Keine Spiele aufgezeichnet.</p>`;
        return;
    }

    let reversedGames = [...games].reverse();
    let gamesToRender = showAllHistory ? reversedGames : reversedGames.slice(0, 5);

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
                        const isWinner = p.name === g.winner;
                        return `<span class="history-player-score ${isWinner ? 'is-winner' : ''}">${p.name}: <strong>${p.total}</strong></span>`;
                    }).join("")}
                </div>
            </div>`;
    });

    if (games.length > 5 && !showAllHistory) {
        box.innerHTML += `
            <button class="secondary" style="margin-top: 10px; height: 40px; font-size: 14px;" onclick="triggerShowAllHistory()">
                📜 Alle anzeigen (${games.length} Spiele)
            </button>`;
    }
}

function triggerShowAllHistory() {
    showAllHistory = true;
    renderHistory();
}

// ===============================
// HISTORY-MODAL VIEW & DELETION SYSTEM
// ===============================
function viewGameDetails(gameId) {
    let g = games.find(x => x.id === gameId);
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
        const isWinner = p.name === g.winner || (g.winner === 'Unentschieden' && p.total === highestScore && anyRoundsPlayed);
        
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
                        let label = g.mode === 'round' ? `<span class="r-num">R${i+1}:</span>` : '';
                        return `
                            <div class="round-pill">
                                ${label}
                                <span class="${cls}">${prefix}${val}</span>
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

let activeHistoryDeleteId = null;
function triggerDeleteHistoryGame(gameId) {
    activeHistoryDeleteId = gameId;
    let g = games.find(x => x.id === gameId);
    closeModal();
    
    setTimeout(() => {
        let body = `<p style="color:var(--muted)">Möchtest du das spiel <strong>${g.name}</strong> wirklich löschen? Alle Siege und Punkte werden restlos aus der Bestenliste abgezogen!</p>`;
        let actions = `<button class="secondary" onclick="closeModal()">Abbrechen</button><button class="red" onclick="submitDeleteHistoryGame()">Definitiv löschen</button>`;
        openModal("⚠️ Spiel unwiderruflich löschen?", body, actions);
    }, 300);
}

async function submitDeleteHistoryGame() {
    if(activeHistoryDeleteId) {
        let g = games.find(x => x.id === activeHistoryDeleteId);
        if(g) {
            if (g.rated !== false) {
                g.players.forEach(cp => {
                    let p = players.find(x => x.id === cp.id);
                    if(p) {
                        p.games = Math.max(0, p.games - 1);
                        p.points = Math.max(0, p.points - cp.total);
                        if(p.name === g.winner) {
                            p.wins = Math.max(0, p.wins - 1);
                        }
                    }
                });
            }
            games = games.filter(x => x.id !== activeHistoryDeleteId);
            
            await apiSave('players', players);
            await apiSave('games', games);
            
            renderRanking();
            renderHistory();
        }
    }
    closeModal();
}

async function initApp() {
    await loadAllFromDb();
    renderGame();
    startLiveSync(); 
}

initApp();