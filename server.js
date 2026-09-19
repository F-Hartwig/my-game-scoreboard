'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const path = require('node:path');
const { createAuth } = require('./auth.js');
const { createCollaboration, migrateCollaboration } = require('./collaboration.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scoreboard.db');
const SCHEMA_VERSION = 7;
const JSON_LIMIT = process.env.JSON_LIMIT || '2mb';
const ENDPOINTS = Object.freeze({
    players: { empty: [], maxItems: 500, adminWrite: false, userStatsOnly: true },
    games: { empty: [], maxItems: 5000, adminWrite: false, userAppendOnly: true },
    activeGames: { empty: [], maxItems: 100, adminWrite: false },
    currentGame: { empty: null, maxItems: 1, adminWrite: false },
    gameNights: { empty: [], maxItems: 200, adminWrite: false }
});
const PUBLIC_FILES = new Set([
    'index.html', 'style.css', 'icon.png', 'app.js', 'api.js', 'auth-client.js', 'state.js',
    'gamesConfig.js', 'security.mjs', 'preview-selection.mjs', 'score-entry-draft.mjs', 'setup-player-order.mjs',
    'personal-stats.mjs'
]);
const WEREWOLF_ROLES = new Set(['villager', 'werewolf', 'seer', 'witch', 'hunter', 'prostitute', 'barkeeper', 'terrorist', 'child', 'priest']);

function validateWerewolfGame(game) {
    if (game?.gameTypeId !== 'werwolf') return;
    if (game.rated !== false || game.mode !== 'assistant') throw new Error('Werwolf ist immer ungewertet und nutzt den Spielleiter-Modus.');
    const state = game.werewolf;
    if (!state || state.version !== 1 || !['night', 'day', 'finished'].includes(state.phase) || !Number.isSafeInteger(state.number) || state.number < 1) throw new Error('Werwolf-Zustand ist ungültig.');
    if (!Array.isArray(state.roles) || state.roles.length !== (game.players || []).length || !Array.isArray(state.events) || state.events.length > 200) throw new Error('Werwolf-Rollen oder Ereignisse sind ungültig.');
    const participantIds = new Set(participantIdsForGame(game));
    const assigned = new Set();
    for (const role of state.roles) {
        if (!participantIds.has(String(role?.playerId)) || assigned.has(String(role.playerId)) || !WEREWOLF_ROLES.has(role.roleId) || !['village', 'wolves'].includes(role.baseTeam) || !['village', 'wolves'].includes(role.currentTeam) || typeof role.alive !== 'boolean') throw new Error('Werwolf-Rolle ist ungültig.');
        assigned.add(String(role.playerId));
    }
}

function participantIdsForGame(game) {
    return (game?.players || []).flatMap(party => party?.playerIds || [party?.id]).map(String);
}

function migrateDatabase(db) {
    db.pragma('busy_timeout = 5000');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    const version = Number(db.pragma('user_version', { simple: true }) || 0);
    if (version > SCHEMA_VERSION) throw new Error(`Datenbankschema ${version} ist neuer als unterstützt (${SCHEMA_VERSION}).`);
    if (version < 1) {
        db.exec(`BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, json_data TEXT NOT NULL);
            PRAGMA user_version = 1; COMMIT;`);
    }
    if (version < 2) db.exec('BEGIN IMMEDIATE; PRAGMA user_version = 2; COMMIT;');
    if (version < 3) {
        db.exec(`BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                player_id TEXT,
                created_at INTEGER NOT NULL
            );
            CREATE UNIQUE INDEX IF NOT EXISTS users_one_player ON users(player_id) WHERE player_id IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS users_one_admin ON users(role) WHERE role = 'admin';
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                csrf_token TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
            CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
            CREATE TABLE IF NOT EXISTS invitations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_hash TEXT NOT NULL UNIQUE,
                player_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                used_at INTEGER,
                revoked_at INTEGER
            );
            CREATE INDEX IF NOT EXISTS invitations_player ON invitations(player_id);
            PRAGMA user_version = 3; COMMIT;`);
    }
    if (version < 4) migrateCollaboration(db);
    if (version < 5) {
        const migrateFavorites = db.transaction(() => {
            db.exec(`CREATE TABLE IF NOT EXISTS user_favorites (
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                player_id TEXT NOT NULL,
                PRIMARY KEY (user_id, player_id)
            );
            CREATE INDEX IF NOT EXISTS user_favorites_player ON user_favorites(player_id);`);
            const playersRow = db.prepare('SELECT json_data FROM state WHERE id = ?').get('players');
            const players = playersRow ? JSON.parse(playersRow.json_data) : [];
            if (!Array.isArray(players)) throw new Error('Gespeicherte Spielerdaten sind beschädigt.');
            const favoritePlayerIds = players.filter(player => player?.favorite).map(player => String(player.id));
            const insertFavorite = db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, player_id) VALUES (?, ?)');
            for (const user of db.prepare('SELECT id FROM users').all()) {
                for (const playerId of favoritePlayerIds) insertFavorite.run(user.id, playerId);
            }
            db.pragma('user_version = 5');
        });
        migrateFavorites.immediate();
    }
    if (version < 6) {
        db.exec(`BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS guest_players (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            PRAGMA user_version = 6; COMMIT;`);
    }
    if (version < 7) {
        db.exec(`BEGIN IMMEDIATE;
            ALTER TABLE guest_players ADD COLUMN game_id TEXT;
            CREATE INDEX IF NOT EXISTS guest_players_game ON guest_players(game_id);
            PRAGMA user_version = 7; COMMIT;`);
    }
    db.prepare('INSERT OR IGNORE INTO state (id, json_data) VALUES (?, ?)').run('gameNights', '[]');
}

function migrateLegacyCurrentGame(db) {
    const read = db.prepare('SELECT json_data FROM state WHERE id = ?');
    const currentRow = read.get('currentGame');
    if (!currentRow) return;
    let current;
    try { current = JSON.parse(currentRow.json_data); } catch { return; }
    if (!current || Array.isArray(current) || typeof current !== 'object' || current.id === undefined) return;
    const activeRow = read.get('activeGames');
    let active = [];
    try { active = activeRow ? JSON.parse(activeRow.json_data) : []; } catch { active = []; }
    if (!Array.isArray(active)) active = [];
    if (!active.some(game => String(game?.id) === String(current.id))) active.push(current);
    const save = db.prepare(`INSERT INTO state (id, json_data) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`);
    db.transaction(() => {
        save.run('activeGames', JSON.stringify(active));
        save.run('currentGame', 'null');
    }).immediate();
}

function isValidId(value) {
    return (Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(value));
}

function gameActivitySnapshot(game) {
    if (!game || typeof game !== 'object' || Array.isArray(game)) return game;
    const { wizardDraft, ...persistentScoreState } = game;
    return persistentScoreState;
}

function validateUserPlayerStatsUpdate(existing, next) {
    if (!Array.isArray(existing) || !Array.isArray(next) || existing.length !== next.length) {
        throw new Error('Nur der Master darf Spieler hinzufügen oder entfernen.');
    }
    for (let index = 0; index < existing.length; index += 1) {
        const before = { ...existing[index] };
        const after = { ...next[index] };
        for (const key of ['favorite', 'wins', 'games', 'points']) {
            delete before[key];
            delete after[key];
        }
        if (JSON.stringify(before) !== JSON.stringify(after)) {
            throw new Error('Nur der Master darf Spielerdaten verwalten.');
        }
        for (const key of ['wins', 'games', 'points']) {
            if (!Number.isFinite(next[index][key])) throw new Error('Ungültige Spielerstatistik.');
        }
    }
}

function validateUserGameAppend(existing, next) {
    if (!Array.isArray(existing) || !Array.isArray(next) || next.length !== existing.length + 1) {
        throw new Error('Benutzer dürfen nur ein beendetes Spiel ergänzen.');
    }
    if (JSON.stringify(next.slice(0, existing.length)) !== JSON.stringify(existing)) {
        throw new Error('Nur der Master darf die Spielhistorie ändern.');
    }
}

function validateTree(value, context = { nodes: 0 }, depth = 0, key = '') {
    context.nodes += 1;
    if (context.nodes > 100000) throw new Error('Payload enthält zu viele Werte.');
    if (depth > 16) throw new Error('Payload ist zu tief verschachtelt.');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error('Ungültige Zahl.');
        return;
    }
    if (typeof value === 'string') {
        const limit = key === 'name' || key === 'winner' ? 80 : 20000;
        if (value.length > limit) throw new Error(`${key || 'Text'} ist zu lang.`);
        if (/\u0000/.test(value)) throw new Error('Text enthält unzulässige Steuerzeichen.');
        return;
    }
    if (Array.isArray(value)) {
        if (value.length > 10000) throw new Error('Array enthält zu viele Einträge.');
        value.forEach(item => validateTree(item, context, depth + 1, key));
        return;
    }
    if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        const entries = Object.entries(value);
        if (entries.length > 100) throw new Error('Objekt enthält zu viele Felder.');
        for (const [childKey, childValue] of entries) {
            const wizardPlayerKey = key === 'wizardDraft' && /^\d+$/.test(childKey);
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(childKey) && !wizardPlayerKey) throw new Error('Ungültiger Feldname.');
            if (childKey === 'id' && !isValidId(childValue)) throw new Error('Ungültige ID.');
            if (childKey === 'gameNightId' && childValue !== null && !isValidId(childValue)) throw new Error('Ungültige ID.');
            validateTree(childValue, context, depth + 1, childKey);
        }
        return;
    }
    throw new Error('Nicht unterstützter Wert im Payload.');
}

function validatePayload(endpoint, payload) {
    const config = ENDPOINTS[endpoint];
    if (!config) throw new Error('Unbekannter Endpunkt.');
    if (endpoint === 'currentGame') {
        if (payload !== null && (Array.isArray(payload) || typeof payload !== 'object')) throw new Error('currentGame muss ein Objekt oder null sein.');
    } else {
        if (!Array.isArray(payload)) throw new Error(`${endpoint} muss ein Array sein.`);
        if (payload.length > config.maxItems) throw new Error(`${endpoint} enthält zu viele Einträge.`);
    }
    validateTree(payload);
    if (endpoint === 'gameNights') {
        for (const night of payload) {
            if (!night || typeof night !== 'object' || Array.isArray(night)) throw new Error('Ungültiger Spieleabend.');
            if (!isValidId(night.id)) throw new Error('Ungültige ID.');
            if (typeof night.name !== 'string' || !night.name.trim()) throw new Error('Name des Spieleabends fehlt.');
            if (!Array.isArray(night.participantIds) || night.participantIds.length < 2 || night.participantIds.length > 100 || night.participantIds.some(id => !isValidId(id))) throw new Error('Teilnehmer sind ungültig.');
            if (!['active', 'completed'].includes(night.status)) throw new Error('Status des Spieleabends ist ungültig.');
            if (typeof night.startedAt !== 'string' || Number.isNaN(Date.parse(night.startedAt))) throw new Error('Startzeit ist ungültig.');
            if (night.endedAt !== null && (typeof night.endedAt !== 'string' || Number.isNaN(Date.parse(night.endedAt)))) throw new Error('Endzeit ist ungültig.');
            if (night.status === 'active' && night.endedAt !== null) throw new Error('Aktiver Spieleabend darf keine Endzeit haben.');
            if (night.status === 'completed' && night.endedAt === null) throw new Error('Abgeschlossener Spieleabend braucht eine Endzeit.');
        }
    }
}

async function createRuntime(options = {}) {
    const db = new Database(options.dbPath || DB_PATH);
    db.pragma('foreign_keys = ON');
    migrateDatabase(db);
    migrateLegacyCurrentGame(db);
    const readState = db.prepare('SELECT json_data FROM state WHERE id = ?');
    const saveState = db.prepare(`INSERT INTO state (id, json_data) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`);
    const readPlayers = () => {
        const row = readState.get('players');
        if (!row) return [];
        try { return JSON.parse(row.json_data); } catch { return []; }
    };
    const readGuests = gameId => db.prepare('SELECT id, name, created_at FROM guest_players WHERE game_id = ? ORDER BY created_at').all(String(gameId))
        .map(guest => ({ id: guest.id, name: guest.name, isGuest: true }));
    const readGuest = id => db.prepare('SELECT id, name, game_id FROM guest_players WHERE id = ?').get(id);
    const participantIds = game => (game?.players || []).flatMap(party => party?.playerIds || [party?.id]).map(String);
    const validateGameParticipants = game => {
        const allowedIds = new Set(readPlayers().map(player => String(player.id)));
        for (const playerId of participantIds(game)) {
            if (allowedIds.has(playerId)) continue;
            const guest = readGuest(Number(playerId));
            if (!guest || String(guest.game_id) !== String(game.id)) {
                throw new Error('Ein Teilnehmer existiert nicht oder gehört nicht zu dieser Partie.');
            }
        }
    };
    const materializeGuestDrafts = game => {
        const { guestDrafts: drafts, ...persistentGame } = game || {};
        if (drafts === undefined) return game;
        if (!Array.isArray(drafts) || drafts.length > 20) throw new Error('Gäste sind ungültig.');
        const temporaryIds = new Set();
        const replacements = new Map();
        const existingIds = new Set(readPlayers().map(player => Number(player.id)));
        for (const draft of drafts) {
            const temporaryId = Number(draft?.id);
            const name = String(draft?.name ?? '').trim();
            if (!Number.isSafeInteger(temporaryId) || temporaryId >= 0 || temporaryIds.has(temporaryId) || !name || name.length > 80 || Object.keys(draft || {}).length !== 2) {
                throw new Error('Gast ist ungültig.');
            }
            temporaryIds.add(temporaryId);
            let id;
            do { id = Date.now() * 1000 + require('node:crypto').randomInt(1000); }
            while (existingIds.has(id) || db.prepare('SELECT 1 FROM guest_players WHERE id = ?').get(id));
            existingIds.add(id);
            db.prepare('INSERT INTO guest_players (id, name, created_at, game_id) VALUES (?, ?, ?, ?)').run(id, name, Date.now(), String(game.id));
            replacements.set(temporaryId, id);
        }
        const replaceId = value => replacements.get(Number(value)) ?? value;
        const players = (game.players || []).map(party => ({ ...party, id: replaceId(party.id), playerIds: (party.playerIds || [party.id]).map(replaceId) }));
        const winnerPartyIds = (game.winnerPartyIds || []).map(replaceId);
        return { ...persistentGame, players, winnerPartyIds };
    };
    const validatePlayerBinding = value => {
        if (value === null || value === undefined || value === '') return null;
        const player = readPlayers().find(item => String(item?.id) === String(value));
        if (!player) throw new Error('Der ausgewählte Spieler existiert nicht.');
        return String(value);
    };
    const handleUserError = (error, res, next) => {
        if (/users\.username|UNIQUE constraint failed: users\.username/.test(error.message)) return res.status(409).json({ error: 'Benutzername ist bereits vergeben.' });
        if (/users\.player_id|UNIQUE constraint failed: users\.player_id/.test(error.message)) return res.status(409).json({ error: 'Dieser Spieler hat bereits ein Konto.' });
        if (error.message?.includes('Passwort') || error.message?.includes('Benutzername') || error.message?.includes('Spieler')) return res.status(400).json({ error: error.message });
        return next(error);
    };

    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', options.trustProxy ?? process.env.TRUST_PROXY === '1');
    app.use(express.json({ limit: JSON_LIMIT, strict: true }));
    const auth = createAuth(db, {
        now: options.now,
        setupToken: options.setupToken,
        allowLocalSetup: options.allowLocalSetup,
        allowPrivateSetup: options.allowPrivateSetup,
        secureCookies: options.secureCookies
    });
    app.use(auth.sessionMiddleware);
    auth.installRoutes(app, {
        validatePlayerBinding,
        handleUserError,
        readPlayers,
        qrCode: QRCode,
        publicBaseUrl: options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? ''
    });

    app.get('/api/health', (req, res) => {
        try {
            db.prepare('SELECT 1 AS ok').get();
            res.json({ status: 'ok', schemaVersion: Number(db.pragma('user_version', { simple: true })) });
        } catch { res.status(503).json({ status: 'error' }); }
    });

    app.get('/api/guests', auth.requireAdmin, (req, res) => {
        const gameId = Number(req.query.gameId);
        if (!Number.isSafeInteger(gameId) || gameId < 0) return res.status(400).json({ error: 'Ungültige Spiel-ID.' });
        return res.set('Cache-Control', 'no-store').json(readGuests(gameId));
    });

    app.post('/api/guests/:id/promote', auth.requireAdmin, auth.requireCsrf, (req, res) => {
        try {
            const guestId = Number(req.params.id);
            if (!Number.isSafeInteger(guestId)) return res.status(400).json({ error: 'Ungültige Gast-ID.' });
            const promote = db.transaction(() => {
                const guest = db.prepare('SELECT id, name, game_id FROM guest_players WHERE id = ?').get(guestId);
                if (!guest) throw Object.assign(new Error('Gast wurde nicht gefunden.'), { status: 404 });
                const players = readPlayers();
                if (players.some(player => String(player.id) === String(guestId))) throw new Error('Die Gast-ID ist bereits vergeben.');
                if (guest.game_id === null) throw new Error('Gast ist keiner Partie zugeordnet.');
                const gamesRow = readState.get('games');
                const games = gamesRow ? JSON.parse(gamesRow.json_data) : [];
                if (!games.some(game => String(game.id) === String(guest.game_id) && participantIds(game).includes(String(guestId)))) {
                    throw new Error('Gast kann erst nach Abschluss seiner Partie übernommen werden.');
                }
                const stats = { games: 0, wins: 0, points: 0 };
                for (const game of games) {
                    if (game?.rated === false) continue;
                    for (const party of game?.players || []) {
                        if (!(party.playerIds || [party.id]).some(id => String(id) === String(guestId))) continue;
                        stats.games += 1;
                        stats.points += Number(party.total) || 0;
                        if ((game.winnerPartyIds || []).some(id => String(id) === String(party.id))) stats.wins += 1;
                    }
                }
                const player = { id: guestId, name: guest.name, favorite: false, ...stats };
                players.push(player);
                saveState.run('players', JSON.stringify(players));
                db.prepare('DELETE FROM guest_players WHERE id = ?').run(guestId);
                return player;
            });
            return res.json(promote.immediate());
        } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
    });

    app.get('/api/preview-qr', auth.requireAdmin, async (req, res) => {
        const host = req.get('host');
        if (!host || !/^[A-Za-z0-9.:[\]-]+$/.test(host)) return res.status(400).json({ error: 'Ungültiger Host.' });
        const previewUrl = `${req.secure ? 'https' : 'http'}://${host}/?preview=1`;
        try {
            const svg = await QRCode.toString(previewUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#172033', light: '#ffffff' } });
            return res.set('Cache-Control', 'no-store').type('image/svg+xml').send(svg);
        } catch { return res.status(500).json({ error: 'QR-Code konnte nicht erstellt werden.' }); }
    });

    const readActiveGames = () => {
        const row = readState.get('activeGames');
        const value = row ? JSON.parse(row.json_data) : [];
        if (!Array.isArray(value)) throw new Error('Aktive Spiele sind beschädigt.');
        return value;
    };
    const gameIdMatches = (game, id) => String(game?.id) === String(id);
    const saveActiveGames = active => saveState.run('activeGames', JSON.stringify(active));
    const collaboration = createCollaboration({
        db,
        auth,
        readActiveGames,
        saveActiveGames,
        now: options.now || Date.now
    });
    collaboration.installRoutes(app);

    app.get('/api/favorites', auth.requireAuth, (req, res) => {
        const rows = db.prepare('SELECT player_id FROM user_favorites WHERE user_id = ? ORDER BY player_id').all(req.auth.user.id);
        return res.set('Cache-Control', 'no-store').json(rows.map(row => row.player_id));
    });

    app.put('/api/favorites/:playerId', auth.requireAuth, auth.requireCsrf, (req, res, next) => {
        try {
            if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || typeof req.body.favorite !== 'boolean' || Object.keys(req.body).length !== 1) {
                return res.status(400).json({ error: 'Favoritenstatus ist ungültig.' });
            }
            const playerId = String(req.params.playerId);
            if (!readPlayers().some(player => String(player.id) === playerId)) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
            if (req.body.favorite) {
                db.prepare('INSERT OR IGNORE INTO user_favorites (user_id, player_id) VALUES (?, ?)').run(req.auth.user.id, playerId);
            } else {
                db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND player_id = ?').run(req.auth.user.id, playerId);
            }
            return res.json({ playerId, favorite: req.body.favorite });
        } catch (error) {
            return next(error);
        }
    });

    app.post('/api/active-games', auth.requireAuth, auth.requireCsrf, (req, res) => {
        try {
            const create = db.transaction(() => {
                const game = materializeGuestDrafts(req.body);
                validatePayload('currentGame', game);
                validateWerewolfGame(game);
                validateGameParticipants(game);
                const active = readActiveGames();
                if (active.some(item => gameIdMatches(item, game.id))) throw Object.assign(new Error('Dieses Spiel existiert bereits.'), { status: 409 });
                active.push(game);
                validatePayload('activeGames', active);
                saveActiveGames(active);
                collaboration.recordCreated(req, game);
                return game;
            });
            return res.status(201).json(create.immediate());
        } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
    });

    app.put('/api/active-games/:id', auth.requireAuth, auth.requireCsrf, (req, res) => {
        try {
            validatePayload('currentGame', req.body);
            validateWerewolfGame(req.body);
            validateGameParticipants(req.body);
            if (!gameIdMatches(req.body, req.params.id)) return res.status(400).json({ error: 'Spiel-ID stimmt nicht überein.' });
            const update = db.transaction(() => {
                const active = readActiveGames();
                const index = active.findIndex(game => gameIdMatches(game, req.params.id));
                if (index < 0) throw Object.assign(new Error('Spiel nicht gefunden.'), { status: 404 });
                const before = active[index];
                active[index] = req.body;
                saveActiveGames(active);
                if (JSON.stringify(gameActivitySnapshot(before)) !== JSON.stringify(gameActivitySnapshot(req.body))) {
                    collaboration.recordUpdated(req, before, req.body);
                }
            });
            update.immediate();
            return res.json(req.body);
        } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
    });

    app.delete('/api/active-games/:id', auth.requireAuth, auth.requireCsrf, (req, res) => {
        try {
            const remove = db.transaction(() => {
                const active = readActiveGames();
                const game = active.find(item => gameIdMatches(item, req.params.id));
                if (!game) throw Object.assign(new Error('Spiel nicht gefunden.'), { status: 404 });
                saveActiveGames(active.filter(item => !gameIdMatches(item, req.params.id)));
                collaboration.recordDeleted(req, game);
            });
            remove.immediate();
            return res.sendStatus(204);
        } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
    });

    app.post('/api/active-games/:id/finish', auth.requireAuth, auth.requireCsrf, (req, res) => {
        try {
            validatePayload('currentGame', req.body);
            validateWerewolfGame(req.body);
            validateGameParticipants(req.body);
            if (!gameIdMatches(req.body, req.params.id)) return res.status(400).json({ error: 'Spiel-ID stimmt nicht überein.' });
            const finish = db.transaction(() => {
                const active = readActiveGames();
                if (!active.some(game => gameIdMatches(game, req.params.id))) throw new Error('Spiel nicht gefunden.');
                const gamesRow = readState.get('games');
                const playersRow = readState.get('players');
                const games = gamesRow ? JSON.parse(gamesRow.json_data) : [];
                const players = playersRow ? JSON.parse(playersRow.json_data) : [];
                if (games.some(game => gameIdMatches(game, req.params.id))) throw new Error('Spiel wurde bereits beendet.');
                if (req.body.rated !== false) {
                    const winnerIds = new Set();
                    for (const party of req.body.players || []) {
                        if ((req.body.winnerPartyIds || []).some(id => String(id) === String(party.id))) {
                            for (const id of party.playerIds || [party.id]) winnerIds.add(String(id));
                        }
                        for (const id of party.playerIds || [party.id]) {
                            const player = players.find(item => String(item.id) === String(id));
                            if (player) {
                                player.games = Number(player.games || 0) + 1;
                                player.points = Number(player.points || 0) + Number(party.total || 0);
                            }
                        }
                    }
                    for (const player of players) if (winnerIds.has(String(player.id))) player.wins = Number(player.wins || 0) + 1;
                }
                games.push(req.body);
                const remaining = active.filter(game => !gameIdMatches(game, req.params.id));
                validatePayload('players', players);
                validatePayload('games', games);
                saveState.run('players', JSON.stringify(players));
                saveState.run('games', JSON.stringify(games));
                saveActiveGames(remaining);
                collaboration.recordFinished(req, req.body);
                return { players, games, activeGames: remaining };
            });
            return res.json(finish.immediate());
        } catch (error) {
            const status = error.message === 'Spiel nicht gefunden.' ? 404 : 400;
            return res.status(status).json({ error: error.message });
        }
    });

    for (const [endpoint, config] of Object.entries(ENDPOINTS)) {
        app.get(`/api/${endpoint}`, (req, res) => {
            if (!req.auth && req.query.preview !== '1') return res.status(401).json({ error: 'Anmeldung erforderlich.' });
            try {
                const row = readState.get(endpoint);
                if (!row) return res.json(config.empty);
                try {
                    const payload = JSON.parse(row.json_data);
                    return res.json(req.query.preview === '1' && endpoint === 'activeGames' && Array.isArray(payload)
                        ? payload.filter(game => game?.gameTypeId !== 'werwolf')
                        : payload);
                }
                catch { return res.status(500).json({ error: `Gespeicherte Daten für ${endpoint} sind beschädigt.` }); }
            } catch { return res.status(500).json({ error: 'Datenbankfehler.' }); }
        });
        app.post(`/api/${endpoint}`, auth.requireAuth, auth.requireCsrf, (req, res) => {
            if (config.adminWrite && req.auth.user.role !== 'admin') return res.status(403).json({ error: 'Nur der Master darf diese Daten verwalten.' });
            const payload = endpoint === 'currentGame' && req.body && !Array.isArray(req.body) && Object.keys(req.body).length === 0 ? null : req.body;
            try {
                validatePayload(endpoint, payload);
                if (req.auth.user.role !== 'admin' && config.userStatsOnly) {
                    const current = readState.get(endpoint);
                    validateUserPlayerStatsUpdate(current ? JSON.parse(current.json_data) : [], payload);
                }
                if (req.auth.user.role !== 'admin' && config.userAppendOnly) {
                    const current = readState.get(endpoint);
                    validateUserGameAppend(current ? JSON.parse(current.json_data) : [], payload);
                }
                if (endpoint === 'players') {
                    const existingPlayers = readPlayers();
                    const persistedPayload = payload.map(player => {
                        const existing = existingPlayers.find(item => String(item.id) === String(player.id));
                        return existing && Object.hasOwn(existing, 'favorite')
                            ? { ...player, favorite: Boolean(existing.favorite) }
                            : player;
                    });
                    const playerIds = new Set(persistedPayload.map(player => String(player.id)));
                    const reconcile = db.transaction(() => {
                        saveState.run(endpoint, JSON.stringify(persistedPayload));
                        db.prepare(`DELETE FROM user_favorites WHERE player_id NOT IN (${playerIds.size ? [...playerIds].map(() => '?').join(',') : "''"})`).run(...playerIds);
                        for (const user of db.prepare('SELECT id, player_id FROM users WHERE player_id IS NOT NULL').all()) {
                            if (!playerIds.has(user.player_id)) db.prepare('UPDATE users SET player_id = NULL WHERE id = ?').run(user.id);
                        }
                        for (const invitation of db.prepare('SELECT id, player_id FROM invitations WHERE used_at IS NULL AND revoked_at IS NULL').all()) {
                            if (!playerIds.has(invitation.player_id)) db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?').run(Date.now(), invitation.id);
                        }
                    });
                    reconcile.immediate();
                } else {
                    saveState.run(endpoint, JSON.stringify(payload));
                }
                return res.json({ success: true });
            } catch (error) {
                if (error.message && !/SQLITE/.test(error.message)) return res.status(400).json({ error: error.message });
                return res.status(500).json({ error: 'Datenbankfehler.' });
            }
        });
    }

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get('/:file', (req, res, next) => PUBLIC_FILES.has(req.params.file) ? res.sendFile(path.join(__dirname, req.params.file)) : next());
    app.use((req, res) => res.sendStatus(404));
    app.use((error, req, res, next) => {
        if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload ist zu groß.' });
        if (error instanceof SyntaxError) return res.status(400).json({ error: 'Ungültiges JSON.' });
        console.error(error);
        return res.status(500).json({ error: 'Interner Serverfehler.' });
    });
    return { app, db, close: async () => db.close() };
}

async function main() {
    const runtime = await createRuntime();
    const server = runtime.app.listen(PORT, HOST, () => console.log(`ScoreBuddy läuft auf http://${HOST}:${PORT}; schema=${SCHEMA_VERSION}`));
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`${signal}: ScoreBuddy wird sauber beendet.`);
        server.close(async () => {
            try { await runtime.close(); process.exit(0); } catch (error) { console.error(error); process.exit(1); }
        });
        setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) main().catch(error => { console.error('ScoreBuddy konnte nicht gestartet werden:', error); process.exit(1); });

module.exports = { SCHEMA_VERSION, createRuntime, migrateDatabase, validatePayload };
