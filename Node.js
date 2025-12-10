// server.js
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// База данных
const db = new sqlite3.Database('./nexus.db');

// Создаём таблицы
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        balance REAL DEFAULT 0,
        wallet TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        amount REAL,
        type TEXT,
        status TEXT DEFAULT 'pending',
        tx_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        username TEXT,
        message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
});

// API endpoints
app.get('/stats', (req, res) => {
    db.get(`SELECT 
        COUNT(*) as total_users,
        SUM(balance) as total_drc
        FROM users`, (err, row) => {
        res.json({
            total_users: row.total_users || 0,
            total_drc: row.total_drc || 0,
            drc_price: 0.001,
            price_history: [
                { timestamp: Date.now() - 86400000, price: 0.0009 },
                { timestamp: Date.now(), price: 0.001 }
            ]
        });
    });
});

app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
        if (row) {
            res.json(row);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

app.post('/game/reward', (req, res) => {
    const { user_id, game, amount } = req.body;
    
    db.run(`UPDATE users SET balance = balance + ? WHERE id = ?`, 
        [amount, user_id], 
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ reward: amount, new_balance: 0 }); // TODO: Получить новый баланс
            }
        }
    );
});

// WebSocket сервер для чата
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'register') {
            ws.userId = data.user_id;
            ws.username = data.username;
        } else if (data.type === 'message') {
            // Сохраняем сообщение в БД
            db.run(`INSERT INTO chat_messages (user_id, username, message) VALUES (?, ?, ?)`,
                [data.user_id, data.username, data.message]);
            
            // Рассылаем всем
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket disconnected');
    });
});

// Старт сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`API сервер запущен на порту ${PORT}`);
});
