const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'scoreboard.db');
const PRIVATE_FILES = new Set([
    'server.js',
    path.basename(DB_PATH),
    `${path.basename(DB_PATH)}-shm`,
    `${path.basename(DB_PATH)}-wal`
]);

app.disable('x-powered-by');
app.use(express.json());

// Kompatibel mit dem bestehenden NAS- und lokalen Vorschau-Ablauf.
app.use((req, res, next) => {
    if (PRIVATE_FILES.has(path.basename(req.path))) {
        return res.sendStatus(404);
    }
    next();
});
app.use(express.static(__dirname));

// DB liegt direkt neben den Skripten
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) return console.error('SQLite-Verbindung fehlgeschlagen:', err.message);
    console.log('Verbunden mit der SQLite-Datenbank.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, json_data TEXT)`);
});

// Optimierte Get-Funktion: Liefert null für currentGame, falls leer, sonst []
const getStatus = (id, res) => {
    db.get(`SELECT json_data FROM state WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            try {
                return res.json(JSON.parse(row.json_data));
            } catch (parseError) {
                console.error(`Ungültige JSON-Daten für ${id}:`, parseError.message);
                return res.status(500).json({ error: `Gespeicherte Daten für ${id} sind beschädigt.` });
            }
        } else {
            // currentGame erwartet im leeren Zustand null, andere Routen ein Array []
            return res.json(id === 'currentGame' ? null : []);
        }
    });
};

const saveStatus = (id, data, res) => {
    db.run(`INSERT INTO state (id, json_data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json_data = excluded.json_data`, 
        [id, JSON.stringify(data)], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
};

app.get('/api/players', (req, res) => getStatus('players', res));
app.post('/api/players', (req, res) => saveStatus('players', req.body, res));

app.get('/api/games', (req, res) => getStatus('games', res));
app.post('/api/games', (req, res) => saveStatus('games', req.body, res));

app.get('/api/activeGames', (req, res) => getStatus('activeGames', res));
app.post('/api/activeGames', (req, res) => saveStatus('activeGames', req.body, res));

app.get('/api/currentGame', (req, res) => getStatus('currentGame', res));
app.post('/api/currentGame', (req, res) => {
    // Falls ein leeres Objekt {} geschickt wird, wird es als null gespeichert
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    saveStatus('currentGame', data, res);
});

// Lauscht auf 0.0.0.0, damit alle Geräte im WLAN/NAS-Netzwerk zugreifen können
app.listen(PORT, HOST, () => {
    console.log(`Scoreboard-Server läuft auf http://localhost:${PORT}`);
});
