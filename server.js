const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());

// Liefert HTML, CSS und JS direkt aus dem aktuellen Ordner aus
app.use(express.static(__dirname));

// DB liegt direkt neben den Skripten
const db = new sqlite3.Database(path.join(__dirname, 'scoreboard.db'), (err) => {
    if (err) console.error(err.message);
    console.log('Verbunden mit der SQLite-Datenbank.');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS state (id TEXT PRIMARY KEY, json_data TEXT)`);
});

const getStatus = (id, res) => {
    db.get(`SELECT json_data FROM state WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row ? JSON.parse(row.json_data) : []);
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
    const data = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    saveStatus('currentGame', data, res);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scoreboard-Server läuft auf http://localhost:${PORT}`);
});