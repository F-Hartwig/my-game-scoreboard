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

// Navigation zwischen den Tabs
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

// Modal Verwaltung
function openModal(title, bodyHtml, actionHtml) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    document.getElementById("modalActions").innerHTML = actionHtml;
    document.getElementById("appModal").classList.add("open");
}

function closeModal() {
    document.getElementById("appModal").classList.remove("open");
    activeEditPlayerId = null;
}

// Spieler-Maske
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

// Drag & Drop & Setup Rendering
function startSetup() {
    if(players.length < 2) { alert("Bitte lege zuerst mindestens 2 Spieler an!"); return; }
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
        <div class="title">🎲 3. Spiel-Typ wählen</div>
        <select id="predefinedGameSelect" onchange="handleGameTemplateChange()" style="margin-bottom: 20px;">
            <option value="custom">-- Eigener Modus (Custom) --</option>
            <option value="cabo">Cabo (Niedrige Punkte, Limit 101, Reset bei 100)</option>
        </select>
        <div id="customGameConfigSection">
            <div class="title">📝 4. Name des Spiels</div>
            <input id="gameNameInput" placeholder="z.B. Kniffel, Scrabble, Rommé... (optional)" style="margin-bottom: 20px;">
            <div class="title">⚙️ 5. Eingabe-Modus wählen</div>
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
            <div class="title">🏆 6. Gewinnbedingung</div>
            <select id="winCondition" style="margin-bottom: 20px;">
                <option value="high">Höchste Punktzahl gewinnt</option>
                <option value="low">Niedrigste Punktzahl gewinnt</option>
            </select>
        </div>
        <button onclick="createGame()">Spiel starten 🚀</button>
        <button class="secondary" style="margin-top:8px;" onclick="cancelSetup()">Abbrechen</button>
    </div>`;

    document.getElementById("gameContent").innerHTML = html;
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
        dragBox.innerHTML = ""; dragBox.appendChild(placeholder); return;
    }
    if(placeholder) placeholder.remove();
    
    const currentOrderIds = [...dragBox.querySelectorAll(".drag-card")].map(c => Number(c.dataset.id));
    const selectedIds = checkedBoxes.map(b => Number(b.value));
    dragBox.innerHTML = "";
    
    const finalIds = currentOrderIds.filter(id => selectedIds.includes(id));
    selectedIds.forEach(id => { if(!finalIds.includes(id)) finalIds.push(id); });
    
    finalIds.forEach(id => {
        let p = players.find(x => x.id === id); if(!p) return;
        let card = document.createElement("div");
        card.className = "drag-card"; card.draggable = true; card.dataset.id = p.id;
        card.innerHTML = `<div class="player-left"><span style="color:var(--muted); font-size:14px; margin-right:4px;">↕️</span><div class="avatar" style="width:28px; height:28px; font-size:10px;">${p.name.substring(0,2).toUpperCase()}</div><strong>${p.name}</strong></div>`;
            
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('touchstart', (e) => { card.classList.add('dragging'); card.style.opacity = '0.5'; }, { passive: true });
        card.addEventListener('touchmove', (e) => {
            const dragging = document.querySelector('.dragging'); if (!dragging) return; e.preventDefault(); 
            const touch = e.touches[0]; const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
            const closestItem = targetElement ? targetElement.closest('.drag-card') : null;
            if (closestItem && closestItem !== dragging) {
                const bounding = closestItem.getBoundingClientRect();
                if (touch.clientY - bounding.top - bounding.height / 2 > 0) dragBox.insertBefore(dragging, closestItem.nextSibling); else dragBox.insertBefore(dragging, closestItem);
            }
        }, { passive: false });
        card.addEventListener('touchend', () => { card.classList.remove('dragging'); card.style.opacity = '1'; });
        dragBox.appendChild(card);
    });
}

// Spielfeld-Rendering
function renderGame(isSyncUpdate = false) {
    if (isSettingUpGame) return; 
    let contentBox = document.getElementById("gameContent");
    if(!currentGame) {
        lastRenderedGameId = null;
        let html = `<div class="card"><div class="title">🎮 Neues Spiel starten</div><p style="color: var(--muted); margin-bottom: 16px;">Aktuell läuft kein Spiel.</p><button onclick="startSetup()">✨ Neues Spiel anlegen</button></div>`;
        if(activeGames && activeGames.length > 0) {
            html += `<div class="title" style="margin-top:20px; padding:0 4px;">⏳ Pausierte Spiele (${activeGames.length})</div>`;
            activeGames.forEach(ag => {
                html += `<div class="active-game-card"><div class="active-game-card-top"><div class="active-game-meta"><strong>🎲 ${ag.name}</strong></div></div><div class="active-game-actions"><button class="resume-btn" onclick="resumeGame(${ag.id})">▶ Weiter</button></div></div>`;
            });
        }
        contentBox.innerHTML = html; return;
    }

    let maxRounds = Math.max(...currentGame.players.map(p => p.rounds.length), 0);
    let bestScore = currentGame.winCondition === 'low' ? Math.min(...currentGame.players.map(p => p.total)) : Math.max(...currentGame.players.map(p => p.total));
    let leadsCount = currentGame.players.filter(p => p.total === bestScore).length;
    let anyRoundsPlayed = currentGame.players.some(p => p.rounds.length > 0);
    let statusText = `${currentGame.name} · Runde ${maxRounds + 1}`;

    if (lastRenderedGameId === currentGame.id && document.getElementById("gameStatusLabel")) {
        document.getElementById("gameStatusLabel").innerText = `⚡ ${statusText}`;
        currentGame.players.forEach(p => {
            const isLeading = p.total === bestScore && anyRoundsPlayed && leadsCount === 1;
            if(document.getElementById(`meta_${p.id}`)) document.getElementById(`meta_${p.id}`).innerHTML = `<span>${p.name}</span>${isLeading ? '<span>👑</span>' : ''}`;
            if(document.getElementById(`total_${p.id}`)) document.getElementById(`total_${p.id}`).innerText = `${p.total} Pkt`;
            let scrollBox = document.getElementById(`scroll_${p.id}`);
            if (scrollBox && scrollBox.dataset.len != p.rounds.length) {
                scrollBox.innerHTML = p.rounds.map((val, i) => `<div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, ${val})"><span class="r-num">R${i+1}:</span><span>${val}</span></div>`).join("");
                scrollBox.dataset.len = p.rounds.length; instantScrollToContainerEnd(scrollBox);
            }
        });
        return; 
    }

    lastRenderedGameId = currentGame.id;
    let html = `<div class="card" style="padding: 12px 16px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><span id="gameStatusLabel" style="font-weight:700;">⚡ ${statusText}</span><button class="secondary" style="width:40px; height:32px; padding:0;" onclick="pauseCurrentGame()">⏸</button></div><div class="card" style="padding: 14px 12px;"><div class="scoreboard-list">`;

    currentGame.players.forEach(p => {
        const isLeading = p.total === bestScore && anyRoundsPlayed && leadsCount === 1;
        html += `<div class="scoreboard-row"><div class="scoreboard-player-header"><div class="player-meta" id="meta_${p.id}"><span>${p.name}</span>${isLeading ? '<span>👑</span>' : ''}</div><div class="total-badge" id="total_${p.id}">${p.total} Pkt</div></div><div class="history-scroll" id="scroll_${p.id}" data-len="${p.rounds.length}">` + 
        p.rounds.map((val, i) => `<div class="round-pill" onclick="triggerEditRound(${p.id}, ${i}, ${val})"><span class="r-num">R${i+1}:</span><span>${val}</span></div>`).join("") + `</div></div>`;
    });

    html += `</div></div><div class="card" id="inputCardAnchor"><div class="title">➕ Runde eintragen</div><div class="round-grid" id="roundInputs">`;
    currentGame.players.forEach((p, idx) => {
        html += `<div class="round-player-row"><span class="player-name">${p.name}</span><button id="sign_${p.id}" onclick="toggleSign(${p.id})">+</button><input type="text" inputmode="numeric" id="inp_${p.id}" placeholder="0" onkeydown="handleRoundEnter(event, ${idx})"></div>`;
    });
    html += `</div><button onclick="addRoundRow()">Runde speichern ✓</button><button class="green" style="margin-top: 8px;" onclick="finishGame()">🏆 Beenden</button></div>`;
    contentBox.innerHTML = html;
}

// Statistiken & Historie
function renderRanking() {
    let box = document.getElementById("ranking"); if(!box) return; box.innerHTML = "";
    if(players.length === 0) { box.innerHTML = `<p style="color:var(--muted); text-align:center;">Keine Daten.</p>`; return; }
    let sorted = [...players].sort((a, b) => b.wins - a.wins);
    sorted.forEach((p, i) => {
        let badge = ["🥇", "🥈", "🥉"][i] || "🏅";
        box.innerHTML += `<div class="rank-card"><div class="rank-card-header"><span>${badge}</span><span>${p.name}</span></div><div class="stat-grid"><div><strong>${p.wins}</strong><span>Siege</span></div><div><strong>${p.games}</strong><span>Spiele</span></div></div></div>`;
    });
}

function renderHistory() {
    let box = document.getElementById("history"); if(!box) return; box.innerHTML = "";
    if(!games || games.length === 0) { box.innerHTML = `<p style="color:var(--muted); text-align:center;">Keine Matches.</p>`; return; }
    let gamesToRender = showAllHistory ? [...games].reverse() : [...games].reverse().slice(0, 5);
    gamesToRender.forEach(g => {
        box.innerHTML += `<div class="history-card" onclick="viewGameDetails(${g.id})"><div class="history-card-top"><div class="history-card-date">🎲 ${g.name}</div><div class="winner-badge">🏆 ${g.winner}</div></div></div>`;
    });
}

// App-Initialisierung
async function initApp() {
    await loadAllFromDb(); renderGame(); startLiveSync(); 
}
initApp();