const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // Hinzugefügt, um Ordnerstrukturen zu prüfen
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Stellt sicher, dass der "data"-Ordner auf dem NAS existiert, sonst stürzt SQLite ab
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)){
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'scoreboard.db'), (err) => {
    if (err) console.error(err.message);
    console.log('Verbunden mit der zentralen SQLite-Datenbank.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, json_data TEXT)`);
});

// Optimierte Get-Funktion: Liefert null für currentGame, falls leer, sonst []
const getStatus = (id, res) => {
    db.get(`SELECT json_data FROM state WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            return res.json(JSON.parse(row.json_data));
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scoreboard-Server läuft auf http://localhost:${PORT}`);
});