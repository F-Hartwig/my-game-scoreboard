'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const path = require('node:path');
const { createAuth } = require('./auth.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scoreboard.db');
const SCHEMA_VERSION = 3;
const JSON_LIMIT = process.env.JSON_LIMIT || '2mb';
const ENDPOINTS = Object.freeze({
    players: { empty: [], maxItems: 500, adminWrite: true },
    games: { empty: [], maxItems: 5000, adminWrite: true },
    activeGames: { empty: [], maxItems: 100, adminWrite: true },
    currentGame: { empty: null, maxItems: 1, adminWrite: false },
    gameNights: { empty: [], maxItems: 200, adminWrite: true }
});
const PUBLIC_FILES = new Set([
    'index.html', 'style.css', 'icon.png', 'app.js', 'api.js', 'auth-client.js', 'state.js',
    'gamesConfig.js', 'security.mjs', 'gameNightRanking.mjs'
]);

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
    db.prepare('INSERT OR IGNORE INTO state (id, json_data) VALUES (?, ?)').run('gameNights', '[]');
}

function isValidId(value) {
    return (Number.isSafeInteger(value) && value >= 0) ||
        (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(value));
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
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(childKey)) throw new Error('Ungültiger Feldname.');
            if ((childKey === 'id' || childKey === 'gameNightId') && !isValidId(childValue)) throw new Error('Ungültige ID.');
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
        const activeNights = payload.filter(night => night && night.status === 'active');
        if (activeNights.length > 1) throw new Error('Höchstens ein Spieleabend darf aktiv sein.');
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
    const readState = db.prepare('SELECT json_data FROM state WHERE id = ?');
    const saveState = db.prepare(`INSERT INTO state (id, json_data) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`);
    const readPlayers = () => {
        const row = readState.get('players');
        if (!row) return [];
        try { return JSON.parse(row.json_data); } catch { return []; }
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

    app.get('/api/preview-qr', auth.requireAdmin, async (req, res) => {
        const host = req.get('host');
        if (!host || !/^[A-Za-z0-9.:[\]-]+$/.test(host)) return res.status(400).json({ error: 'Ungültiger Host.' });
        const previewUrl = `${req.secure ? 'https' : 'http'}://${host}/?preview=1`;
        try {
            const svg = await QRCode.toString(previewUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#172033', light: '#ffffff' } });
            return res.set('Cache-Control', 'no-store').type('image/svg+xml').send(svg);
        } catch { return res.status(500).json({ error: 'QR-Code konnte nicht erstellt werden.' }); }
    });

    for (const [endpoint, config] of Object.entries(ENDPOINTS)) {
        app.get(`/api/${endpoint}`, (req, res) => {
            if (!req.auth && req.query.preview !== '1') return res.status(401).json({ error: 'Anmeldung erforderlich.' });
            try {
                const row = readState.get(endpoint);
                if (!row) return res.json(config.empty);
                try { return res.json(JSON.parse(row.json_data)); }
                catch { return res.status(500).json({ error: `Gespeicherte Daten für ${endpoint} sind beschädigt.` }); }
            } catch { return res.status(500).json({ error: 'Datenbankfehler.' }); }
        });
        app.post(`/api/${endpoint}`, auth.requireAuth, auth.requireCsrf, (req, res) => {
            if (config.adminWrite && req.auth.user.role !== 'admin') return res.status(403).json({ error: 'Nur der Master darf diese Daten verwalten.' });
            const payload = endpoint === 'currentGame' && req.body && !Array.isArray(req.body) && Object.keys(req.body).length === 0 ? null : req.body;
            if (endpoint === 'currentGame' && req.auth.user.role !== 'admin') {
                const current = readState.get(endpoint);
                let existing = null;
                try { existing = current ? JSON.parse(current.json_data) : null; } catch { /* handled below */ }
                if (!existing || !payload || String(existing.id) !== String(payload.id)) return res.status(403).json({ error: 'Benutzer dürfen nur ein bereits laufendes Spiel bedienen.' });
            }
            try {
                validatePayload(endpoint, payload);
                if (endpoint === 'players') {
                    const playerIds = new Set(payload.map(player => String(player.id)));
                    const reconcile = db.transaction(() => {
                        saveState.run(endpoint, JSON.stringify(payload));
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
