const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scoreboard.db');
const SCHEMA_VERSION = 1;
const JSON_LIMIT = process.env.JSON_LIMIT || '2mb';
const ENDPOINTS = Object.freeze({
    players: { empty: [], maxItems: 500 },
    games: { empty: [], maxItems: 5000 },
    activeGames: { empty: [], maxItems: 100 },
    currentGame: { empty: null, maxItems: 1 }
});
const PUBLIC_FILES = new Set([
    'index.html', 'style.css', 'icon.png', 'app.js', 'api.js', 'state.js',
    'gamesConfig.js', 'security.mjs'
]);

function migrateDatabase(db) {
    db.pragma('busy_timeout = 5000');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    const version = Number(db.pragma('user_version', { simple: true }) || 0);
    if (version > SCHEMA_VERSION) {
        throw new Error(`Datenbankschema ${version} ist neuer als unterstützt (${SCHEMA_VERSION}).`);
    }
    if (version < 1) {
        db.exec(`
            BEGIN IMMEDIATE;
            CREATE TABLE IF NOT EXISTS state (
                id TEXT PRIMARY KEY,
                json_data TEXT NOT NULL
            );
            PRAGMA user_version = 1;
            COMMIT;
        `);
    }
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
            if (childKey === 'id' && !isValidId(childValue)) throw new Error('Ungültige ID.');
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
        if (payload !== null && (Array.isArray(payload) || typeof payload !== 'object')) {
            throw new Error('currentGame muss ein Objekt oder null sein.');
        }
    } else {
        if (!Array.isArray(payload)) throw new Error(`${endpoint} muss ein Array sein.`);
        if (payload.length > config.maxItems) throw new Error(`${endpoint} enthält zu viele Einträge.`);
    }
    validateTree(payload);
}

async function createRuntime(options = {}) {
    const db = new Database(options.dbPath || DB_PATH);
    migrateDatabase(db);
    const readState = db.prepare('SELECT json_data FROM state WHERE id = ?');
    const saveState = db.prepare(`INSERT INTO state (id, json_data) VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`);

    const app = express();
    app.disable('x-powered-by');
    app.use(express.json({ limit: JSON_LIMIT, strict: true }));

    app.get('/api/health', (req, res) => {
        try {
            db.prepare('SELECT 1 AS ok').get();
            res.json({ status: 'ok', schemaVersion: Number(db.pragma('user_version', { simple: true })) });
        } catch (error) {
            res.status(503).json({ status: 'error' });
        }
    });

    for (const [endpoint, config] of Object.entries(ENDPOINTS)) {
        app.get(`/api/${endpoint}`, (req, res) => {
            try {
                const row = readState.get(endpoint);
                if (!row) return res.json(config.empty);
                try { return res.json(JSON.parse(row.json_data)); }
                catch { return res.status(500).json({ error: `Gespeicherte Daten für ${endpoint} sind beschädigt.` }); }
            } catch (error) {
                return res.status(500).json({ error: 'Datenbankfehler.' });
            }
        });
        app.post(`/api/${endpoint}`, (req, res) => {
            const payload = endpoint === 'currentGame' && req.body &&
                !Array.isArray(req.body) && Object.keys(req.body).length === 0 ? null : req.body;
            try {
                validatePayload(endpoint, payload);
                saveState.run(endpoint, JSON.stringify(payload));
                return res.json({ success: true });
            } catch (error) {
                if (error.message && !/SQLITE/.test(error.message)) return res.status(400).json({ error: error.message });
                return res.status(500).json({ error: 'Datenbankfehler.' });
            }
        });
    }

    app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
    app.get('/:file', (req, res, next) => {
        if (!PUBLIC_FILES.has(req.params.file)) return next();
        return res.sendFile(path.join(__dirname, req.params.file));
    });
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
    const server = runtime.app.listen(PORT, HOST, () => {
        console.log(`ScoreBuddy läuft auf http://${HOST}:${PORT}; DB=${DB_PATH}; schema=${SCHEMA_VERSION}`);
    });
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`${signal}: ScoreBuddy wird sauber beendet.`);
        server.close(async () => {
            try { await runtime.close(); process.exit(0); }
            catch (error) { console.error(error); process.exit(1); }
        });
        setTimeout(() => process.exit(1), 10000).unref();
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
    main().catch(error => {
        console.error('ScoreBuddy konnte nicht gestartet werden:', error);
        process.exit(1);
    });
}

module.exports = { SCHEMA_VERSION, createRuntime, validatePayload };
