'use strict';

const PRESENCE_TTL_MS = 20000;
const ACTIVITY_LIMIT = 30;

function migrateCollaboration(db) {
    db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT NOT NULL,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            username TEXT NOT NULL,
            action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'finished', 'deleted', 'undo')),
            summary TEXT NOT NULL,
            before_json TEXT,
            after_json TEXT,
            undone_at INTEGER,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS activity_game_created ON activity_log(game_id, created_at DESC);
        PRAGMA user_version = 4;
        COMMIT;`);
}

function sameId(a, b) {
    return String(a) === String(b);
}

function summarizeUpdate(before, after) {
    const changed = [];
    for (const nextParty of after?.players || []) {
        const previousParty = (before?.players || []).find(party => sameId(party.id, nextParty.id));
        if (!previousParty) continue;
        const previousRounds = previousParty.rounds || [];
        const nextRounds = nextParty.rounds || [];
        if (nextRounds.length > previousRounds.length) {
            changed.push({ type: 'added', name: nextParty.name, count: nextRounds.length - previousRounds.length });
        } else if (JSON.stringify(previousRounds) !== JSON.stringify(nextRounds)) {
            changed.push({ type: 'edited', name: nextParty.name });
        }
    }
    if (changed.length && changed.every(item => item.type === 'added')) {
        const maxRound = Math.max(...(after.players || []).map(party => (party.rounds || []).length), 0);
        return changed.length > 1 ? `Runde ${maxRound} eingetragen` : `Punkte für ${changed[0].name} eingetragen`;
    }
    if (changed.some(item => item.type === 'edited')) {
        const names = changed.filter(item => item.type === 'edited').map(item => item.name).join(', ');
        return `Wert für ${names} korrigiert`;
    }
    return 'Spielstand aktualisiert';
}

function createCollaboration({ db, auth, readActiveGames, saveActiveGames, now = Date.now }) {
    const presence = new Map();
    const insertActivity = db.prepare(`INSERT INTO activity_log
        (game_id, user_id, username, action, summary, before_json, after_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const readActivity = db.prepare(`SELECT id, game_id, user_id, username, action, summary,
        before_json, after_json, undone_at, created_at
        FROM activity_log WHERE game_id = ? ORDER BY id DESC LIMIT ?`);
    const readActivityById = db.prepare('SELECT * FROM activity_log WHERE id = ?');
    const readLatestActivity = db.prepare('SELECT id FROM activity_log WHERE game_id = ? ORDER BY id DESC LIMIT 1');
    const markUndone = db.prepare('UPDATE activity_log SET undone_at = ? WHERE id = ? AND undone_at IS NULL');

    function record(req, gameId, action, summary, before = null, after = null) {
        insertActivity.run(
            String(gameId),
            req.auth.user.id,
            req.auth.user.username,
            action,
            summary,
            before === null ? null : JSON.stringify(before),
            after === null ? null : JSON.stringify(after),
            now()
        );
        db.prepare('DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY id DESC LIMIT 2000)').run();
    }

    function recordCreated(req, game) {
        record(req, game.id, 'created', 'Partie erstellt');
    }

    function recordUpdated(req, before, after) {
        record(req, after.id, 'updated', summarizeUpdate(before, after), before, after);
    }

    function recordFinished(req, game) {
        record(req, game.id, 'finished', 'Partie beendet');
    }

    function recordDeleted(req, game) {
        record(req, game.id, 'deleted', 'Partie verworfen');
    }

    function cleanupPresence() {
        const cutoff = now() - PRESENCE_TTL_MS;
        for (const [key, entry] of presence) if (entry.updatedAt < cutoff) presence.delete(key);
    }

    function installRoutes(app) {
        app.post('/api/presence', auth.requireAuth, auth.requireCsrf, (req, res) => {
            cleanupPresence();
            const gameId = req.body?.gameId === null || req.body?.gameId === undefined || req.body?.gameId === ''
                ? null
                : String(req.body.gameId);
            if (gameId && !readActiveGames().some(game => sameId(game.id, gameId))) {
                return res.status(404).json({ error: 'Spiel nicht gefunden.' });
            }
            const page = ['home', 'game', 'stats'].includes(req.body?.page) ? req.body.page : 'home';
            presence.set(req.auth.sessionHash, {
                userId: req.auth.user.id,
                username: req.auth.user.username,
                playerId: req.auth.user.playerId,
                gameId,
                page,
                editing: Boolean(req.body?.editing),
                updatedAt: now()
            });
            return res.json({ success: true });
        });

        app.get('/api/presence', auth.requireAuth, (req, res) => {
            cleanupPresence();
            const gameId = req.query.gameId === undefined || req.query.gameId === '' ? null : String(req.query.gameId);
            const entries = [...presence.entries()]
                .filter(([, entry]) => gameId === null ? entry.gameId === null : entry.gameId === gameId)
                .map(([sessionHash, entry]) => ({ ...entry, self: sessionHash === req.auth.sessionHash }))
                .sort((a, b) => a.username.localeCompare(b.username, 'de'));
            return res.set('Cache-Control', 'no-store').json(entries);
        });

        app.get('/api/active-games/:id/activity', auth.requireAuth, (req, res) => {
            const activeGame = readActiveGames().find(game => sameId(game.id, req.params.id));
            const activeSnapshot = activeGame ? JSON.stringify(activeGame) : null;
            const rows = readActivity.all(String(req.params.id), ACTIVITY_LIMIT);
            return res.set('Cache-Control', 'no-store').json(rows.map((row, index) => ({
                id: row.id,
                username: row.username,
                action: row.action,
                summary: row.summary,
                undoneAt: row.undone_at,
                undone: row.undone_at !== null,
                createdAt: row.created_at,
                canUndo: index === 0 && row.action === 'updated' && row.undone_at === null && row.after_json === activeSnapshot
            })));
        });

        app.post('/api/activity/:id/undo', auth.requireAuth, auth.requireCsrf, (req, res) => {
            try {
                const undo = db.transaction(() => {
                    const event = readActivityById.get(Number(req.params.id));
                    if (!event || event.action !== 'updated' || event.undone_at !== null || !event.before_json || !event.after_json) {
                        throw Object.assign(new Error('Diese Änderung kann nicht rückgängig gemacht werden.'), { status: 409 });
                    }
                    if (readLatestActivity.get(event.game_id)?.id !== event.id) {
                        throw Object.assign(new Error('Nur die letzte Änderung kann rückgängig gemacht werden.'), { status: 409 });
                    }
                    const active = readActiveGames();
                    const index = active.findIndex(game => sameId(game.id, event.game_id));
                    if (index < 0 || JSON.stringify(active[index]) !== event.after_json) {
                        throw Object.assign(new Error('Der Spielstand wurde inzwischen weiter verändert.'), { status: 409 });
                    }
                    const previous = JSON.parse(event.before_json);
                    active[index] = previous;
                    saveActiveGames(active);
                    if (!markUndone.run(now(), event.id).changes) throw Object.assign(new Error('Änderung wurde bereits zurückgenommen.'), { status: 409 });
                    record(req, event.game_id, 'undo', `„${event.summary}“ rückgängig gemacht`);
                    return previous;
                });
                return res.json(undo.immediate());
            } catch (error) {
                return res.status(error.status || 400).json({ error: error.message });
            }
        });
    }

    return { installRoutes, recordCreated, recordUpdated, recordFinished, recordDeleted };
}

module.exports = { migrateCollaboration, createCollaboration, summarizeUpdate };
