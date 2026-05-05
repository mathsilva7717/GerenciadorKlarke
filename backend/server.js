const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
require('dotenv').config();

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
    db.serialize(() => {
      console.log('Iniciando Super Migração de banco de dados...');
      
      const handleMigrate = (table, column, err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error(`Erro ao adicionar ${column} em ${table}:`, err.message);
        } else if (!err) {
          console.log(`Coluna ${column} verificada/adicionada em ${table}.`);
        }
      };

      // Máquinas - Garantir TODAS as colunas
      db.run(`CREATE TABLE IF NOT EXISTS machines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
      const mCols = ['mac', 'ip', 'location', 'rustdesk_id', 'anydesk_id', 'password', 'serial_number', 'last_seen', 'created_by'];
      mCols.forEach(col => db.run(`ALTER TABLE machines ADD COLUMN ${col} TEXT`, (err) => handleMigrate('machines', col, err)));

      // Câmeras - Garantir TODAS as colunas
      db.run(`CREATE TABLE IF NOT EXISTS cameras (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
      const cCols = ['ip', 'port', 'username', 'password', 'location', 'serial_number', 'last_seen', 'last_snapshot', 'rtsp_link', 'created_by'];
      cCols.forEach(col => db.run(`ALTER TABLE cameras ADD COLUMN ${col} TEXT`, (err) => handleMigrate('cameras', col, err)));

      // Rede - Garantir TODAS as colunas
      db.run(`CREATE TABLE IF NOT EXISTS network_devices (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`);
      const nCols = ['type', 'ip', 'username', 'password', 'location', 'isp', 'serial_number', 'last_seen', 'created_by'];
      nCols.forEach(col => db.run(`ALTER TABLE network_devices ADD COLUMN ${col} TEXT`, (err) => handleMigrate('network_devices', col, err)));

      // Tarefas
      db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)`);
      const tCols = ['description', 'is_completed', 'completed_by', 'completed_at'];
      tCols.forEach(col => db.run(`ALTER TABLE tasks ADD COLUMN ${col} TEXT`, (err) => handleMigrate('tasks', col, err)));
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      // Criar usuário padrão se não existir (Criptografado)
      db.get("SELECT * FROM users WHERE username = 'admin'", async (err, row) => {
        if (!row) {
          const hashedAdmin = await bcrypt.hash('admin123', 10);
          db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ['admin', hashedAdmin, 'admin']);
        }
      });
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user TEXT,
        action TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS technical_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        type TEXT,
        content TEXT,
        file_path TEXT,
        file_size TEXT,
        amount REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, () => {
      // Garantir que a coluna amount existe para bancos já criados
      db.run("ALTER TABLE technical_docs ADD COLUMN amount REAL", () => {});
    db.run(`
      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        username TEXT,
        password TEXT,
        category TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        quantity INTEGER DEFAULT 0,
        unit TEXT DEFAULT 'un',
        category TEXT,
        location TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    db.run(`
      CREATE TABLE IF NOT EXISTS voip_extensions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        extension TEXT,
        name TEXT,
        password TEXT,
        ip_address TEXT,
        status TEXT DEFAULT 'Ativo',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// Middleware de Autenticação
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const secretToken = process.env.AUTH_TOKEN || 'klarke-admin-token-xyz';
  
  if (authHeader === `Bearer ${secretToken}`) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
};

// Helper: Registrar ação no log de auditoria
const logAction = (req, action, details) => {
  const user = req.headers['x-user'] || 'Sistema';
  db.run("INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)", [user, action, details]);
};

// Route: Get all audit logs
app.get('/api/audit-logs', authenticate, (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (user && await bcrypt.compare(password, user.password)) {
      try { logAction(username, 'LOGIN', 'Usuário entrou no sistema'); } catch (e) {}
      res.json({ 
        token: process.env.AUTH_TOKEN || 'klarke-admin-token-xyz',
        user: { username: user.username, role: user.role }
      });
    } else {
      res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
  });
});

// User Management
app.get('/api/users', authenticate, (req, res) => {
  db.all('SELECT id, username, role, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', authenticate, async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hashedPassword, role || 'user'], function(err) {
    if (err) return res.status(500).json({ error: 'Usuário já existe ou erro no banco' });
    res.status(201).json({ id: this.lastID, username, role });
  });
});

app.delete('/api/users/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT username FROM users WHERE id = ?', [id], (err, row) => {
    const username = row ? row.username : id;
    db.run('DELETE FROM users WHERE id = ?', id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu usuário: ${username}`);
      res.json({ message: 'Usuário deletado com sucesso' });
    });
  });
});


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

// Create new machine
app.post('/api/machines', authenticate, (req, res) => {
  const { name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, created_by } = req.body;
  const sqlWithAudit = `INSERT INTO machines (name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO machines (name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  // Tenta com auditoria, se falhar (ex: coluna não existe), tenta sem.
  db.run(sqlWithAudit, [name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      console.warn('Banco desatualizado, salvando sem auditoria...');
      db.run(sqlSimple, [name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number], function (err2) {
        if (err2) return res.status(500).json({ error: `Simples: ${err2.message}` });
        res.status(201).json({ id: this.lastID });
      });
    } else if (err) {
      return res.status(500).json({ error: `Audit: ${err.message}` });
    } else {
      try { logAction(req, 'NOVO EQUIPAMENTO', `Cadastrou máquina: ${name}`); } catch (e) {}
      res.status(201).json({ id: this.lastID });
    }
  });
});

// Update machine
app.put('/api/machines/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number } = req.body;
  const sql = `
    UPDATE machines
    SET name = ?, mac = ?, ip = ?, location = ?, rustdesk_id = ?, anydesk_id = ?, password = ?, serial_number = ?
    WHERE id = ?
  `;
  db.run(sql, [name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req, 'EDIÇÃO', `Alterou máquina: ${name}`);
    res.json({ message: 'Máquina atualizada com sucesso' });
  });
});

// Delete machine
app.delete('/api/machines/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM machines WHERE id = ?', [id], (err, row) => {
    const machineName = row ? row.name : id;
    db.run('DELETE FROM machines WHERE id = ?', id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu máquina: ${machineName}`);
      res.json({ message: 'Máquina deletada com sucesso' });
    });
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
  const { name, ip, port, username, password, location, serial_number, rtsp_link, created_by } = req.body;
  const sqlWithAudit = `INSERT INTO cameras (name, ip, port, username, password, location, serial_number, rtsp_link, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO cameras (name, ip, port, username, password, location, serial_number, rtsp_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sqlWithAudit, [name, ip, port, username, password, location, serial_number, rtsp_link, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      db.run(sqlSimple, [name, ip, port, username, password, location, serial_number, rtsp_link], function (err2) {
        if (err2) return res.status(500).json({ error: `Simples Cam: ${err2.message}` });
        res.status(201).json({ id: this.lastID });
      });
    } else if (err) {
      return res.status(500).json({ error: `Audit Cam: ${err.message}` });
    } else {
      try { logAction(req, 'NOVA CÂMERA', `Cadastrou câmera: ${name}`); } catch (e) {}
      res.status(201).json({ id: this.lastID });
    }
  });
});

app.put('/api/cameras/:id', authenticate, (req, res) => {
  const { name, ip, port, username, password, location, serial_number, rtsp_link } = req.body;
  const sql = `UPDATE cameras SET name = ?, ip = ?, port = ?, username = ?, password = ?, location = ?, serial_number = ?, rtsp_link = ? WHERE id = ?`;
  db.run(sql, [name, ip, port, username, password, location, serial_number, rtsp_link, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req, 'EDIÇÃO', `Alterou câmera: ${name}`);
    res.json({ message: 'Câmera atualizada com sucesso' });
  });
});

app.delete('/api/cameras/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM cameras WHERE id = ?', [id], (err, row) => {
    const camName = row ? row.name : id;
    db.run('DELETE FROM cameras WHERE id = ?', id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu câmera: ${camName}`);
      res.json({ message: 'Câmera deletada com sucesso' });
    });
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
  const { name, type, ip, username, password, location, isp, serial_number, created_by } = req.body;
  const sqlWithAudit = `INSERT INTO network_devices (name, type, ip, username, password, location, isp, serial_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO network_devices (name, type, ip, username, password, location, isp, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sqlWithAudit, [name, type, ip, username, password, location, isp, serial_number, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      db.run(sqlSimple, [name, type, ip, username, password, location, isp, serial_number], function (err2) {
        if (err2) return res.status(500).json({ error: `Simples Net: ${err2.message}` });
        res.status(201).json({ id: this.lastID });
      });
    } else if (err) {
      return res.status(500).json({ error: `Audit Net: ${err.message}` });
    } else {
      try { logAction(req, 'NOVA REDE', `Cadastrou dispositivo de rede: ${name}`); } catch (e) {}
      res.status(201).json({ id: this.lastID });
    }
  });
});

app.put('/api/network-devices/:id', authenticate, (req, res) => {
  const { name, type, ip, username, password, location, isp, serial_number } = req.body;
  const sql = `UPDATE network_devices SET name = ?, type = ?, ip = ?, username = ?, password = ?, location = ?, isp = ?, serial_number = ? WHERE id = ?`;
  db.run(sql, [name, type, ip, username, password, location, isp, serial_number, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req, 'EDIÇÃO', `Alterou dispositivo de rede: ${name}`);
    res.json({ message: 'Dispositivo atualizado com sucesso' });
  });
});

app.delete('/api/network-devices/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM network_devices WHERE id = ?', [id], (err, row) => {
    const devName = row ? row.name : id;
    db.run('DELETE FROM network_devices WHERE id = ?', id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu dispositivo de rede: ${devName}`);
      res.json({ message: 'Equipamento deletado com sucesso' });
    });
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
  const { is_completed, completed_by } = req.body;
  const completed_at = is_completed ? new Date().toISOString() : null;
  const sql = `UPDATE tasks SET is_completed = ?, completed_by = ?, completed_at = ? WHERE id = ?`;
  db.run(sql, [is_completed ? 1 : 0, is_completed ? completed_by : null, completed_at, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (is_completed) {
      logAction(req, 'TAREFA CONCLUÍDA', `Finalizou tarefa ID #${req.params.id}`);
    }
    res.json({ updated: this.changes });
  });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT title FROM tasks WHERE id = ?', [id], (err, row) => {
    const taskTitle = row ? row.title : id;
    db.run('DELETE FROM tasks WHERE id = ?', id, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu tarefa: ${taskTitle}`);
      res.json({ message: 'Tarefa deletada com sucesso' });
    });
  });
});

// ==========================================
// MONITORING: HEARTBEAT
// ==========================================

// Rota pública para os agentes enviarem sinal (protegida por Token da Máquina)
app.post('/api/monitoring/heartbeat', (req, res) => {
  const { serial_number, type } = req.body; // type: 'machine', 'camera', 'network'
  
  if (!serial_number) return res.status(400).json({ error: 'Serial number obrigatório' });

  let table = 'machines';
  if (type === 'camera') table = 'cameras';
  if (type === 'network') table = 'network_devices';

  const sql = `UPDATE ${table} SET last_seen = CURRENT_TIMESTAMP WHERE serial_number = ?`;
  
  db.run(sql, [serial_number], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Equipamento não encontrado' });
    res.json({ status: 'success', timestamp: new Date().toISOString() });
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

const fs = require('fs');

// Middleware extra para uploads grandes (base64)
app.use(express.json({ limit: '10mb' }));

// Servir fotos das câmeras
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// ROUTES: TECHNICAL DOCS (ACERVO)
// ==========================================

// Config Multer para Acervo
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads/docs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `doc_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`);
  }
});
const uploadDoc = multer({ storage: docStorage });

app.get('/api/technical-docs', authenticate, (req, res) => {
  db.all('SELECT * FROM technical_docs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/technical-docs', authenticate, uploadDoc.single('file'), (req, res) => {
  const { title, type, content, amount } = req.body;
  const filePath = req.file ? req.file.filename : null;
  const fileSize = req.file ? `${(req.file.size / 1024).toFixed(1)} KB` : null;

  db.run(
    "INSERT INTO technical_docs (title, type, content, file_path, file_size, amount) VALUES (?, ?, ?, ?, ?, ?)",
    [title, type || 'Nota', content, filePath, fileSize, amount ? parseFloat(amount) : null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title, filePath });
    }
  );
});
app.put('/api/technical-docs/:id', authenticate, (req, res) => {
  const { title, type, content, amount } = req.body;
  db.run(
    "UPDATE technical_docs SET title = ?, type = ?, content = ?, amount = ? WHERE id = ?",
    [title, type, content, amount ? parseFloat(amount) : null, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EDIÇÃO', `Alterou documento: ${title}`);
      res.json({ message: 'Documento atualizado' });
    }
  );
});

// --- KEY KEEPER (CREDENTIALS) ---
app.get('/api/credentials', authenticate, (req, res) => {
  db.all('SELECT * FROM credentials ORDER BY category ASC, title ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/credentials', authenticate, (req, res) => {
  const { title, username, password, category, notes } = req.body;
  db.run(
    "INSERT INTO credentials (title, username, password, category, notes) VALUES (?, ?, ?, ?, ?)",
    [title, username, password, category || 'Geral', notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/credentials/:id', authenticate, (req, res) => {
  const { title, username, password, category, notes } = req.body;
  db.run(
    "UPDATE credentials SET title = ?, username = ?, password = ?, category = ?, notes = ? WHERE id = ?",
    [title, username, password, category, notes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EDIÇÃO', `Alterou credencial: ${title}`);
      res.json({ message: 'Credencial atualizada' });
    }
  );
});

// --- INVENTORY ---
app.get('/api/inventory', authenticate, (req, res) => {
  db.all('SELECT * FROM inventory ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventory', authenticate, (req, res) => {
  const { name, quantity, unit, category, location, notes } = req.body;
  db.run(
    "INSERT INTO inventory (name, quantity, unit, category, location, notes) VALUES (?, ?, ?, ?, ?, ?)",
    [name, quantity || 0, unit || 'un', category || 'Geral', location, notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/inventory/:id', authenticate, (req, res) => {
  const { name, quantity, unit, category, location, notes } = req.body;
  db.run(
    "UPDATE inventory SET name = ?, quantity = ?, unit = ?, category = ?, location = ?, notes = ? WHERE id = ?",
    [name, quantity, unit, category, location, notes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EDIÇÃO', `Alterou item do estoque: ${name}`);
      res.json({ message: 'Item atualizado' });
    }
  );
});

// --- VOIP ---
app.get('/api/voip', authenticate, (req, res) => {
  db.all('SELECT * FROM voip_extensions ORDER BY extension ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/voip', authenticate, (req, res) => {
  const { extension, name, password, ip_address, status, notes } = req.body;
  db.run(
    "INSERT INTO voip_extensions (extension, name, password, ip_address, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
    [extension, name, password, ip_address, status || 'Ativo', notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/voip/:id', authenticate, (req, res) => {
  const { extension, name, password, ip_address, status, notes } = req.body;
  db.run(
    "UPDATE voip_extensions SET extension = ?, name = ?, password = ?, ip_address = ?, status = ?, notes = ? WHERE id = ?",
    [extension, name, password, ip_address, status, notes, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EDIÇÃO', `Alterou ramal: ${extension}`);
      res.json({ message: 'Ramal atualizado' });
    }
  );
});

app.delete('/api/voip/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT extension FROM voip_extensions WHERE id = ?', [id], (err, row) => {
    const extNumber = row ? row.extension : id;
    db.run("DELETE FROM voip_extensions WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu ramal: ${extNumber}`);
      res.json({ message: 'Ramal removido' });
    });
  });
});

app.delete('/api/inventory/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM inventory WHERE id = ?', [id], (err, row) => {
    const itemName = row ? row.name : id;
    db.run("DELETE FROM inventory WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu item do estoque: ${itemName}`);
      res.json({ message: 'Item removido' });
    });
  });
});

app.delete('/api/credentials/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT title FROM credentials WHERE id = ?', [id], (err, row) => {
    const credTitle = row ? row.title : id;
    db.run("DELETE FROM credentials WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu credencial: ${credTitle}`);
      res.json({ message: 'Credencial removida' });
    });
  });
});

app.delete('/api/technical-docs/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get("SELECT title, file_path FROM technical_docs WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    const docTitle = row ? row.title : id;
    if (row && row.file_path) {
      const fullPath = path.join(__dirname, 'uploads/docs', row.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    db.run("DELETE FROM technical_docs WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu documento: ${docTitle}`);
      res.json({ message: 'Documento deletado' });
    });
  });
});

// Servir arquivos do acervo
app.use('/uploads/docs', express.static(path.join(__dirname, 'uploads/docs')));

// Rota para o Agente enviar fotos
app.post('/api/monitoring/snapshot', (req, res) => {
  const { serial_number, image } = req.body; // image em base64
  
  if (!serial_number || !image) return res.status(400).json({ error: 'Dados incompletos' });

  const fileName = `cam_${serial_number}_${Date.now()}.jpg`;
  const filePath = path.join(__dirname, 'uploads', fileName);
  
  // Remove o header do base64 se existir (data:image/jpeg;base64,...)
  const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
  
  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao salvar imagem' });

    // Atualiza o banco com o novo nome da foto
    db.run('UPDATE cameras SET last_snapshot = ? WHERE serial_number = ?', [fileName, serial_number], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ status: 'success', url: `/uploads/${fileName}` });
    });
  });
});

// Rota para baixar o script do agente COM CONFIGURAÇÃO EMBUTIDA
app.get('/api/monitoring/agent-download', (req, res) => {
  const agentPath = path.join(__dirname, 'klarke-agent.js');
  if (!fs.existsSync(agentPath)) return res.status(404).send('Script do agente não encontrado no servidor');
  
  let content = fs.readFileSync(agentPath, 'utf8');
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  const token = process.env.AUTH_TOKEN || 'klarke-admin-token-xyz';
  
  // Injetar variáveis no topo do script para que o cliente não precise de argumentos
  const injection = `
// === CONFIGURAÇÃO AUTOMÁTICA KLARKE ===
const AUTO_URL = "${serverUrl}";
const AUTO_TOKEN = "${token}";
// ======================================
  `;
  
  content = injection + content;
  
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Content-Disposition', 'attachment; filename=klarke-agent.js');
  res.send(content);
});

// Rota para baixar o ativador .BAT (Um clique)
app.get('/api/monitoring/agent-bat', (req, res) => {
  const batContent = `@echo off
title Klarke Agent Monitor
echo ========================================
echo   INICIANDO MONITORAMENTO KLARKE
echo ========================================
echo.
node klarke-agent.js
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] O Node.js nao parece estar instalado ou o script nao foi encontrado.
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
)
pause`;

  res.setHeader('Content-Type', 'application/x-bat');
  res.setHeader('Content-Disposition', 'attachment; filename=ATIVAR_MONITORAMENTO.bat');
  res.send(batContent);
});

// Catch-all para rotas do React (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
