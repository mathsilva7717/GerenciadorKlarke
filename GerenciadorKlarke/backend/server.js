const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    db.run(`
      CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        mac TEXT,
        ip TEXT,
        location TEXT,
        rustdesk_id TEXT,
        anydesk_id TEXT,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS cameras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        ip TEXT,
        port TEXT,
        username TEXT,
        password TEXT,
        location TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS network_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type TEXT,
        ip TEXT,
        username TEXT,
        password TEXT,
        location TEXT,
        isp TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        is_completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ token: 'klarke-admin-token-xyz' });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});

// Middleware de Autenticação
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader === 'Bearer klarke-admin-token-xyz') {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
};

// Get all machines
app.get('/api/machines', authenticate, (req, res) => {
  db.all('SELECT * FROM machines', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get machine by id
app.get('/api/machines/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM machines WHERE id = ?', [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Máquina não encontrada' });
      return;
    }
    res.json(row);
  });
});

// Create new machine (Publico se a pessoa logar pode cadastrar, entao proteger tambem)
app.post('/api/machines', authenticate, (req, res) => {
  const { name, mac, ip, location, rustdesk_id, anydesk_id, password } = req.body;
  const sql = `
    INSERT INTO machines (name, mac, ip, location, rustdesk_id, anydesk_id, password)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [name, mac, ip, location, rustdesk_id, anydesk_id, password], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({ id: this.lastID });
  });
});

// Update machine
app.put('/api/machines/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { name, mac, ip, location, rustdesk_id, anydesk_id, password } = req.body;
  const sql = `
    UPDATE machines
    SET name = ?, mac = ?, ip = ?, location = ?, rustdesk_id = ?, anydesk_id = ?, password = ?
    WHERE id = ?
  `;
  db.run(sql, [name, mac, ip, location, rustdesk_id, anydesk_id, password, id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Máquina não encontrada' });
      return;
    }
    res.json({ message: 'Máquina atualizada com sucesso' });
  });
});

// Delete machine
app.delete('/api/machines/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM machines WHERE id = ?', id, function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Máquina não encontrada' });
      return;
    }
    res.json({ message: 'Máquina deletada com sucesso' });
  });
});

// ==========================================
// ROUTES: CAMERAS
// ==========================================

app.get('/api/cameras', authenticate, (req, res) => {
  db.all('SELECT * FROM cameras', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cameras', authenticate, (req, res) => {
  const { name, ip, port, username, password, location } = req.body;
  const sql = `INSERT INTO cameras (name, ip, port, username, password, location) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, ip, port, username, password, location], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/cameras/:id', authenticate, (req, res) => {
  const { name, ip, port, username, password, location } = req.body;
  const sql = `UPDATE cameras SET name = ?, ip = ?, port = ?, username = ?, password = ?, location = ? WHERE id = ?`;
  db.run(sql, [name, ip, port, username, password, location, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Câmera atualizada com sucesso' });
  });
});

app.delete('/api/cameras/:id', authenticate, (req, res) => {
  db.run('DELETE FROM cameras WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Câmera deletada com sucesso' });
  });
});

// ==========================================
// ROUTES: NETWORK DEVICES
// ==========================================

app.get('/api/network-devices', authenticate, (req, res) => {
  db.all('SELECT * FROM network_devices', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/network-devices', authenticate, (req, res) => {
  const { name, type, ip, username, password, location, isp } = req.body;
  const sql = `INSERT INTO network_devices (name, type, ip, username, password, location, isp) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, type, ip, username, password, location, isp], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/network-devices/:id', authenticate, (req, res) => {
  const { name, type, ip, username, password, location, isp } = req.body;
  const sql = `UPDATE network_devices SET name = ?, type = ?, ip = ?, username = ?, password = ?, location = ?, isp = ? WHERE id = ?`;
  db.run(sql, [name, type, ip, username, password, location, isp, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dispositivo atualizado com sucesso' });
  });
});

app.delete('/api/network-devices/:id', authenticate, (req, res) => {
  db.run('DELETE FROM network_devices WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Dispositivo deletado com sucesso' });
  });
});

// ==========================================
// ROUTES: TASKS
// ==========================================

app.get('/api/tasks', authenticate, (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY is_completed ASC, created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tasks', authenticate, (req, res) => {
  const { title, description } = req.body;
  const sql = `INSERT INTO tasks (title, description, is_completed) VALUES (?, ?, 0)`;
  db.run(sql, [title, description], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID });
  });
});

app.put('/api/tasks/:id', authenticate, (req, res) => {
  const { is_completed } = req.body;
  const sql = `UPDATE tasks SET is_completed = ? WHERE id = ?`;
  db.run(sql, [is_completed ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ updated: this.changes });
  });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  db.run(`DELETE FROM tasks WHERE id = ?`, req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// ==========================================
// PRODUCTION & UTILS
// ==========================================

// Servir arquivos estáticos do Frontend (Vite build)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Rota para backup do banco de dados (Download do .sqlite)
app.get('/api/backup', authenticate, (req, res) => {
  res.download(dbPath, 'klarke_backup.sqlite', (err) => {
    if (err) res.status(500).json({ error: 'Erro ao baixar backup' });
  });
});

// Catch-all para rotas do React (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
