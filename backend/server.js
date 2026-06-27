const express = require('express');
const cors = require('cors');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
  console.error('FATAL: a variável de ambiente SECRET_KEY não está definida. Defina-a no arquivo .env antes de iniciar o servidor.');
  process.exit(1);
}

// Token compartilhado usado pelos agentes de monitoramento (heartbeat/snapshot)
const MONITORING_TOKEN = process.env.MONITORING_TOKEN;
if (!MONITORING_TOKEN) {
  console.warn('AVISO: MONITORING_TOKEN não definido. As rotas de monitoramento ficarão indisponíveis até que seja configurado.');
}

// --- Criptografia de senhas em repouso (AES-256-GCM) ---
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
let encKey = null;
if (ENCRYPTION_KEY) {
  encKey = Buffer.from(ENCRYPTION_KEY, 'base64');
  if (encKey.length !== 32) {
    console.error('FATAL: ENCRYPTION_KEY deve ter 32 bytes em base64 (use crypto.randomBytes(32)).');
    process.exit(1);
  }
} else {
  console.warn('AVISO: ENCRYPTION_KEY não definido. Senhas serão armazenadas em texto plano. Defina a chave e rode migrate-encrypt.js.');
}

const ENC_PREFIX = 'enc:v1:';

// Criptografa um valor. Idempotente: se já estiver criptografado, retorna como está.
function encryptSecret(plain) {
  if (plain == null || plain === '' || !encKey) return plain;
  if (typeof plain === 'string' && plain.startsWith(ENC_PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

// Descriptografa. Valores legados (sem prefixo) são retornados como estão.
function decryptSecret(value) {
  if (value == null || value === '' || typeof value !== 'string') return value;
  if (!value.startsWith(ENC_PREFIX) || !encKey) return value;
  try {
    const [ivB64, tagB64, ctB64] = value.slice(ENC_PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch (e) {
    return value; // falha silenciosa: não derruba a listagem
  }
}

// Descriptografa o campo 'password' (ou outros) em uma linha ou lista de linhas.
function decryptRows(data, fields = ['password']) {
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    if (!row) continue;
    for (const f of fields) {
      if (row[f] != null) row[f] = decryptSecret(row[f]);
    }
  }
  return data;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS restrito: defina ALLOWED_ORIGINS no .env (lista separada por vírgula).
// Se não for definido, mantém o comportamento aberto mas registra um aviso.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn('AVISO: ALLOWED_ORIGINS não definido. O CORS está aberto a qualquer origem. Defina os domínios da aplicação em produção.');
}
app.use(cors({
  origin: (origin, cb) => {
    // Permite chamadas sem origin (apps nativos, curl) e as origens da allowlist.
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Origem não permitida pelo CORS'));
  },
}));

// Cabeçalhos de segurança básicos (equivalente enxuto ao helmet, sem dependência extra)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  // CSP afinada ao que o frontend usa: Google Fonts + html5-qrcode (unpkg) + uploads/base64.
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
  ].join('; '));
  next();
});

app.use(express.json({ limit: '10mb' }));

// Database setup
const dbPath = path.join(__dirname, 'database.sqlite');
const _db = new DatabaseSync(dbPath);
console.log('Conectado ao banco de dados SQLite nativo (Node 24).');

// Adaptador de compatibilidade para não quebrar o código legado
const db = {
  run: (sql, params, callback) => {
    try {
      if (typeof params === 'function') { callback = params; params = []; }
      const stmt = _db.prepare(sql);
      const bindParams = (Array.isArray(params) ? params : [params]).map((p) => p === undefined ? null : p);
      const info = stmt.run(...bindParams);
      // better-sqlite3 retorna lastInsertRowid como BigInt, mas precisamos converter para número ou usar como number se vier como BigInt
      const lastID = typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid;
      if (callback) callback.call({ lastID, changes: info.changes }, null);
    } catch (err) {
      if (callback) callback(err);
    }
  },
  get: (sql, params, callback) => {
    try {
      if (typeof params === 'function') { callback = params; params = []; }
      const stmt = _db.prepare(sql);
      const bindParams = (Array.isArray(params) ? params : [params]).map((p) => p === undefined ? null : p);
      const row = stmt.get(...bindParams);
      if (callback) callback(null, row);
    } catch (err) {
      if (callback) callback(err);
    }
  },
  all: (sql, params, callback) => {
    try {
      if (typeof params === 'function') { callback = params; params = []; }
      const stmt = _db.prepare(sql);
      const bindParams = (Array.isArray(params) ? params : [params]).map((p) => p === undefined ? null : p);
      const rows = stmt.all(...bindParams);
      if (callback) callback(null, rows);
    } catch (err) {
      if (callback) callback(err);
    }
  },
  exec: (sql) => _db.exec(sql),
  prepare: (sql) => _db.prepare(sql)
};

// --- DATABASE TABLES ---
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, mac TEXT, ip TEXT, location TEXT, 
    rustdesk_id TEXT, anydesk_id TEXT, password TEXT, 
    serial_number TEXT, last_seen TEXT, created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, ip TEXT, port TEXT, username TEXT, password TEXT, 
    location TEXT, serial_number TEXT, last_seen TEXT, last_snapshot TEXT, 
    rtsp_link TEXT, created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS network_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    name TEXT, type TEXT, ip TEXT, username TEXT, password TEXT, 
    location TEXT, isp TEXT, serial_number TEXT, created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    must_change_password INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT, action TEXT, details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT, 
    description TEXT, 
    is_completed INTEGER DEFAULT 0,
    completed_by TEXT,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS technical_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    content TEXT,
    file_path TEXT,
    file_size TEXT,
    amount REAL,
    folder_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vault_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    username TEXT,
    password TEXT,
    category TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    quantity REAL,
    unit TEXT,
    category TEXT,
    location TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS voip_extensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extension TEXT,
    name TEXT,
    password TEXT,
    ip_address TEXT,
    pabx_ip TEXT,
    status TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS network_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester TEXT,
    title TEXT,
    category TEXT,
    priority TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pendente',
    photo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS managed_sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    ip TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.get("SELECT COUNT(*) as count FROM managed_sites", [], (err, row) => {
    if (!err && (!row || row.count === 0)) {
      db.run("INSERT INTO managed_sites (label, ip) VALUES (?, ?)", ['Local Principal', '45.161.6.51']);
    }
  });
} catch (e) {
  console.error("Erro ao inicializar managed_sites:", e.message);
}

// Migrations rápidas para colunas novas
try { db.exec("ALTER TABLE tickets ADD COLUMN photo TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN comments TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tickets ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN completed_by TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN completed_at DATETIME"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN assigned_to TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE machines ADD COLUMN created_by TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE machines ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
try { db.exec("ALTER TABLE cameras ADD COLUMN created_by TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE cameras ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
try { db.exec("ALTER TABLE network_devices ADD COLUMN created_by TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE network_devices ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}

// Criar admin se não existir
db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
  if (!row) {
    const hashedAdmin = bcrypt.hashSync('admin123', 10);
    // Admin novo já nasce obrigado a trocar a senha padrão no primeiro acesso.
    db.run("INSERT INTO users (username, password, role, must_change_password) VALUES (?, ?, ?, 1)", ['admin', hashedAdmin, 'admin']);
  } else if (row.must_change_password !== 1 && bcrypt.compareSync('admin123', row.password)) {
    // Admin existente ainda usa a senha padrão: força a troca no próximo login.
    db.run("UPDATE users SET must_change_password = 1 WHERE id = ?", [row.id]);
  }
});

// Middleware de Autenticação
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autorizado' });
  
  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Middleware: exige que o usuário autenticado seja admin
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  next();
};

// Middleware: valida o token compartilhado dos agentes de monitoramento
const verifyMonitoringToken = (req, res, next) => {
  if (!MONITORING_TOKEN) {
    return res.status(503).json({ error: 'Monitoramento não configurado no servidor' });
  }
  const provided = req.headers['x-monitor-token'];
  if (!provided || provided !== MONITORING_TOKEN) {
    return res.status(401).json({ error: 'Token de monitoramento inválido' });
  }
  next();
};

// Rate limiter simples em memória para o login (proteção contra brute force)
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const LOGIN_MAX_ATTEMPTS = 10;
const loginRateLimit = (req, res, next) => {
  const key = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now - entry.start > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, start: now });
    return next();
  }

  entry.count += 1;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const retryInSec = Math.ceil((LOGIN_WINDOW_MS - (now - entry.start)) / 1000);
    res.setHeader('Retry-After', String(retryInSec));
    return res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente mais tarde.' });
  }
  next();
};

// Limpeza periódica das janelas expiradas para não vazar memória
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.start > LOGIN_WINDOW_MS) loginAttempts.delete(key);
  }
}, LOGIN_WINDOW_MS).unref();

// Helper: Registrar ação no log de auditoria
const logAction = (req, action, details) => {
  // Usa sempre a identidade do JWT verificado, nunca um header controlado pelo cliente.
  const user = (req.user && req.user.username) ? req.user.username : 'Sistema';
  db.run("INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)", [user, action, details]);
};

// Route: Get all audit logs
app.get('/api/audit-logs', authenticate, (req, res) => {
  db.all('SELECT * FROM audit_logs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Routes

// Login
app.post('/api/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    if (user && await bcrypt.compare(password, user.password)) {
      // Login válido: zera o contador de tentativas deste IP
      loginAttempts.delete(req.ip || req.connection?.remoteAddress || 'unknown');
      db.run("INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)", [username, 'LOGIN', 'Usuário entrou no sistema']);
      
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '8h' }
      );
      res.json({ token, user: { username: user.username, role: user.role, mustChangePassword: user.must_change_password } });
    } else {
      res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
  });
});

// Route: Change Password
app.post('/api/change-password', authenticate, async (req, res) => {
  const { newPassword } = req.body;
  const username = req.user.username;
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  db.run(
    "UPDATE users SET password = ?, must_change_password = 0 WHERE username = ?",
    [hashedPassword, username],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar senha' });
      db.run("INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)", [username, 'TROCA_SENHA', 'Alterou a senha no primeiro acesso']);
      res.json({ message: 'Senha alterada com sucesso' });
    }
  );
});

// User Management
app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  db.all('SELECT id, username, role, must_change_password, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.run(
    'INSERT INTO users (username, password, role, must_change_password) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, role || 'user', 1],
    function(err) {
      if (err) return res.status(400).json({ error: 'Usuário já existe' });
      logAction(req, 'USUÁRIO', `Criou novo usuário: ${username}`);
      res.status(201).json({ id: this.lastID, message: 'Usuário criado com sucesso' });
    }
  );
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
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

app.post('/api/users/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  // Gera uma senha temporária aleatória, exibida uma única vez na resposta.
  const tempPassword = crypto.randomBytes(6).toString('base64url'); // ~8 chars
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  db.run(
    "UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
    [hashedPassword, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Erro ao resetar senha' });
      logAction(req, 'RESET_PASSWORD', `Resetou senha do ID ${req.params.id}`);
      res.json({ message: 'Senha temporária gerada. Anote, ela não será exibida novamente.', tempPassword });
    }
  );
});


// Get all machines
app.get('/api/machines', authenticate, (req, res) => {
  db.all('SELECT * FROM machines', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(decryptRows(rows));
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
    res.json(decryptRows(row));
  });
});

// Create new machine
app.post('/api/machines', authenticate, (req, res) => {
  const { name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, created_by } = req.body;
  const encPwd = encryptSecret(password);
  const sqlWithAudit = `INSERT INTO machines (name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO machines (name, mac, ip, location, rustdesk_id, anydesk_id, password, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  // Tenta com auditoria, se falhar (ex: coluna não existe), tenta sem.
  db.run(sqlWithAudit, [name, mac, ip, location, rustdesk_id, anydesk_id, encPwd, serial_number, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      console.warn('Banco desatualizado, salvando sem auditoria...');
      db.run(sqlSimple, [name, mac, ip, location, rustdesk_id, anydesk_id, encPwd, serial_number], function (err2) {
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
  db.run(sql, [name, mac, ip, location, rustdesk_id, anydesk_id, encryptSecret(password), serial_number, id], function (err) {
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
    res.json(decryptRows(rows));
  });
});

app.post('/api/cameras', authenticate, (req, res) => {
  const { name, ip, port, username, password, location, serial_number, rtsp_link, created_by } = req.body;
  const encPwd = encryptSecret(password);
  const sqlWithAudit = `INSERT INTO cameras (name, ip, port, username, password, location, serial_number, rtsp_link, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO cameras (name, ip, port, username, password, location, serial_number, rtsp_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sqlWithAudit, [name, ip, port, username, encPwd, location, serial_number, rtsp_link, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      db.run(sqlSimple, [name, ip, port, username, encPwd, location, serial_number, rtsp_link], function (err2) {
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
  db.run(sql, [name, ip, port, username, encryptSecret(password), location, serial_number, rtsp_link, req.params.id], function (err) {
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
    res.json(decryptRows(rows));
  });
});

app.post('/api/network-devices', authenticate, (req, res) => {
  const { name, type, ip, username, password, location, isp, serial_number, created_by } = req.body;
  const encPwd = encryptSecret(password);
  const sqlWithAudit = `INSERT INTO network_devices (name, type, ip, username, password, location, isp, serial_number, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const sqlSimple = `INSERT INTO network_devices (name, type, ip, username, password, location, isp, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(sqlWithAudit, [name, type, ip, username, encPwd, location, isp, serial_number, created_by || 'Sistema'], function (err) {
    if (err && (err.message.includes('no such column') || err.message.includes('has no column'))) {
      db.run(sqlSimple, [name, type, ip, username, encPwd, location, isp, serial_number], function (err2) {
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
  db.run(sql, [name, type, ip, username, encryptSecret(password), location, isp, serial_number, req.params.id], function (err) {
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
  const { title, description, assigned_to } = req.body;
  const sql = `INSERT INTO tasks (title, description, is_completed, assigned_to) VALUES (?, ?, 0, ?)`;
  db.run(sql, [title, description, assigned_to || null], function(err) {
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
// ROUTES: NETWORK LOCATIONS
// ==========================================

app.get('/api/network-locations', authenticate, (req, res) => {
  db.all('SELECT * FROM network_locations ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/network-locations', authenticate, (req, res) => {
  const { name, icon } = req.body;
  db.run(
    "INSERT INTO network_locations (name, icon) VALUES (?, ?)",
    [name, icon || 'building'],
    function(err) {
      if (err) return res.status(400).json({ error: 'Local já cadastrado ou erro ao salvar' });
      logAction(req, 'MAPA REDE', `Cadastrou local: ${name}`);
      res.status(201).json({ id: this.lastID, name, icon });
    }
  );
});

app.delete('/api/network-locations/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM network_locations WHERE id = ?', [id], (err, row) => {
    const locName = row ? row.name : id;
    db.run("DELETE FROM network_locations WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'EXCLUSÃO', `Removeu local do mapa: ${locName}`);
      res.json({ message: 'Local removido' });
    });
  });
});

// ==========================================
// MONITORING: HEARTBEAT
// ==========================================

// Rota pública para os agentes enviarem sinal (protegida por Token da Máquina)
app.post('/api/monitoring/heartbeat', verifyMonitoringToken, (req, res) => {
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
app.get('/api/backup', authenticate, requireAdmin, (req, res) => {
  res.download(dbPath, 'klarke_backup.sqlite', (err) => {
    if (err) {
      console.error('Erro no download do backup:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao baixar backup' });
      }
    }
  });
});


// Servir arquivos estáticos (Snapshots e Documentos)
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
// Bloqueia extensões executáveis/scripts que poderiam ser servidas pelo /uploads
const BLOCKED_EXT = new Set([
  '.php', '.phtml', '.html', '.htm', '.js', '.mjs', '.exe', '.sh', '.bat',
  '.cmd', '.com', '.cgi', '.pl', '.py', '.jsp', '.asp', '.aspx', '.svg'
]);
const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXT.has(ext)) {
      return cb(new Error('Tipo de arquivo não permitido'));
    }
    cb(null, true);
  },
});

app.get('/api/technical-docs', authenticate, (req, res) => {
  db.all('SELECT * FROM technical_docs ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/technical-docs', authenticate, uploadDoc.single('file'), (req, res) => {
  const { title, type, content, amount, folder_id } = req.body;
  const filePath = req.file ? req.file.filename : null;
  const fileSize = req.file ? `${(req.file.size / 1024).toFixed(1)} KB` : null;

  db.run(
    "INSERT INTO technical_docs (title, type, content, file_path, file_size, amount, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [title, type || 'Nota', content, filePath, fileSize, amount ? parseFloat(amount) : null, folder_id || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title, filePath });
    }
  );
});
app.put('/api/technical-docs/:id', authenticate, (req, res) => {
  const { title, type, content, amount, folder_id } = req.body;
  db.run(
    "UPDATE technical_docs SET title = ?, type = ?, content = ?, amount = ?, folder_id = ? WHERE id = ?",
    [title, type, content, amount ? parseFloat(amount) : null, folder_id || null, req.params.id],
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
    res.json(decryptRows(rows));
  });
});

app.post('/api/credentials', authenticate, (req, res) => {
  const { title, username, password, category, notes } = req.body;
  db.run(
    "INSERT INTO credentials (title, username, password, category, notes) VALUES (?, ?, ?, ?, ?)",
    [title, username, encryptSecret(password), category || 'Geral', notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'CREDENCIAIS', `Adicionou nova credencial: ${title}`);
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/credentials/:id', authenticate, (req, res) => {
  const { title, username, password, category, notes } = req.body;
  db.run(
    "UPDATE credentials SET title = ?, username = ?, password = ?, category = ?, notes = ? WHERE id = ?",
    [title, username, encryptSecret(password), category, notes, req.params.id],
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
      logAction(req, 'ESTOQUE', `Adicionou item: ${name} (${quantity} ${unit})`);
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
    res.json(decryptRows(rows));
  });
});

app.post('/api/voip', authenticate, (req, res) => {
  const { extension, name, password, ip_address, pabx_ip, status, notes } = req.body;
  db.run(
    "INSERT INTO voip_extensions (extension, name, password, ip_address, pabx_ip, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [extension, name, encryptSecret(password), ip_address, pabx_ip, status || 'Ativo', notes],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'VOIP', `Cadastrou ramal: ${extension} - ${name}`);
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.put('/api/voip/:id', authenticate, (req, res) => {
  const { extension, name, password, ip_address, pabx_ip, status, notes } = req.body;
  db.run(
    "UPDATE voip_extensions SET extension = ?, name = ?, password = ?, ip_address = ?, pabx_ip = ?, status = ?, notes = ? WHERE id = ?",
    [extension, name, encryptSecret(password), ip_address, pabx_ip, status, notes, req.params.id],
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

// --- VAULT FOLDERS ---
app.get('/api/vault-folders', authenticate, (req, res) => {
  db.all('SELECT * FROM vault_folders ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/vault-folders', authenticate, (req, res) => {
  const { name, parent_id } = req.body;
  db.run("INSERT INTO vault_folders (name, parent_id) VALUES (?, ?)", [name, parent_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req, 'CRIAÇÃO', `Criou pasta: ${name}`);
    res.json({ id: this.lastID, name, parent_id });
  });
});

app.delete('/api/vault-folders/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT name FROM vault_folders WHERE id = ?', [id], (err, row) => {
    const folderName = row ? row.name : id;
    db.run("DELETE FROM vault_folders WHERE id = ?", [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      // Opcional: Mover arquivos da pasta para o root ou deletar? 
      // Por segurança, vamos apenas desvincular os arquivos
      db.run("UPDATE technical_docs SET folder_id = NULL WHERE folder_id = ?", [id]);
      logAction(req, 'EXCLUSÃO', `Removeu pasta: ${folderName}`);
      res.json({ message: 'Pasta removida' });
    });
  });
});

// Rota para o Agente enviar fotos
app.post('/api/monitoring/snapshot', verifyMonitoringToken, (req, res) => {
  const { serial_number, image } = req.body; // image em base64

  if (!serial_number || !image) return res.status(400).json({ error: 'Dados incompletos' });

  // Sanitiza o serial para evitar path traversal no nome do arquivo
  const safeSerial = String(serial_number).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeSerial) return res.status(400).json({ error: 'Serial inválido' });

  const fileName = `cam_${safeSerial}_${Date.now()}.jpg`;
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
// Rota para baixar o Klarke Repair (app Electron portable, distribuído como .zip)
app.get('/api/monitoring/repair-download', (req, res) => {
  const repairPath = path.join(__dirname, '../repair-tool/Klarke Repair.zip');
  if (!fs.existsSync(repairPath)) {
    return res.status(404).send('Ferramenta de reparo não encontrada no servidor');
  }
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="Klarke Repair.zip"');
  res.sendFile(repairPath);
});



// --- ROTAS DE SUPORTE (TICKETS) ---

// Criar chamado (Público para qualquer dispositivo da rede da empresa)
app.post('/api/tickets', (req, res) => {
  const { requester, title, category, priority, description, image } = req.body;
  if (!requester || !title || !category || !priority || !description) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  let photoFieldValue = null;
  if (image) {
    try {
      const imagesToProcess = Array.isArray(image) ? image : [image];
      const photoFilesList = [];
      
      const dir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      imagesToProcess.forEach((imgBase64, index) => {
        if (!imgBase64) return;
        const base64Data = imgBase64.replace(/^data:image\/\w+;base64,/, "");
        const fileName = `ticket_${Date.now()}_${index}.jpg`;
        const filePath = path.join(__dirname, 'uploads', fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');
        photoFilesList.push(fileName);
      });

      if (photoFilesList.length > 0) {
        // Se for enviado apenas uma imagem no formato antigo, ou se for uma lista, salvamos como array em JSON
        photoFieldValue = JSON.stringify(photoFilesList);
      }
    } catch (e) {
      console.error('Erro ao salvar imagens do chamado:', e);
      photoFieldValue = null;
    }
  }
  
  db.run(
    'INSERT INTO tickets (requester, title, category, priority, description, photo) VALUES (?, ?, ?, ?, ?, ?)',
    [requester, title, category, priority, description, photoFieldValue],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      try {
        db.run(
          "INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)",
          [requester, 'CHAMADO_ABERTO', `Abriu chamado #${this.lastID}: ${title}`]
        );
      } catch (e) {}
      
      res.status(201).json({ id: this.lastID, message: 'Chamado aberto com sucesso!' });
    }
  );
});

// Consultar status de chamados específicos por IDs (Público para o PWA móvel)
app.get('/api/tickets/status-check', (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) return res.json([]);
  
  const ids = idsParam.split(',').map(Number).filter(Boolean);
  if (ids.length === 0) return res.json([]);
  
  const placeholders = ids.map(() => '?').join(',');
  db.all(
    `SELECT id, requester, title, category, priority, status, created_at FROM tickets WHERE id IN (${placeholders}) ORDER BY created_at DESC`,
    ids,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Listar todos os chamados (Autenticado)
app.get('/api/tickets', authenticate, (req, res) => {
  db.all('SELECT * FROM tickets ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Atualizar status do chamado (Autenticado)
app.put('/api/tickets/:id', authenticate, (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  
  db.run(
    'UPDATE tickets SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logAction(req, 'CHAMADO_STATUS', `Alterou status do chamado #${id} para: ${status}`);
      res.json({ message: 'Chamado atualizado com sucesso' });
    }
  );
});

// Deletar/Arquivar chamado (Autenticado)
app.delete('/api/tickets/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM tickets WHERE id = ?', id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logAction(req, 'CHAMADO_EXCLUIR', `Excluiu chamado #${id}`);
    res.json({ message: 'Chamado removido com sucesso' });
  });
});

// Adicionar comentário/anotação ao chamado (Autenticado)
app.post('/api/tickets/:id/comments', authenticate, (req, res) => {
  const { id } = req.params;
  const { text, image } = req.body;
  
  if (!text && !image) {
    return res.status(400).json({ error: 'Comentário ou imagem é obrigatório' });
  }

  db.get('SELECT comments FROM tickets WHERE id = ?', [id], (err, ticket) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!ticket) return res.status(404).json({ error: 'Chamado não encontrado' });

    let commentsList = [];
    try {
      if (ticket.comments) {
        commentsList = JSON.parse(ticket.comments);
      }
    } catch (e) {
      commentsList = [];
    }

    let commentImageName = null;
    if (image) {
      try {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        commentImageName = `comment_${id}_${Date.now()}.jpg`;
        const filePath = path.join(__dirname, 'uploads', commentImageName);
        
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, base64Data, 'base64');
      } catch (e) {
        console.error('Erro ao salvar imagem do comentário:', e);
      }
    }

    const newComment = {
      id: Date.now(),
      author: req.user?.username || 'Suporte',
      text: text || '',
      image: commentImageName,
      created_at: new Date().toISOString()
    };

    commentsList.push(newComment);
    const commentsJSON = JSON.stringify(commentsList);

    db.run(
      'UPDATE tickets SET comments = ? WHERE id = ?',
      [commentsJSON, id],
      function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        logAction(req, 'CHAMADO_COMENTARIO', `Adicionou comentário no chamado #${id}`);
        res.json({ message: 'Comentário adicionado com sucesso', comments: commentsList });
      }
    );
  });
});

// ==========================================
// MONITORAMENTO DE LOCAIS (PING DE IPs PÚBLICOS)
// ==========================================
const { exec } = require('child_process');

// Cache em memória para latência e status online de todos os IPs públicos monitorados
const pingCache = new Map(); // ip -> { online: boolean, latency: number, lastCheck: string }

function pingHost(ip) {
  return new Promise((resolve) => {
    // Sanitização defensiva: só hostnames/IPs válidos (evita injeção de shell no exec).
    if (!/^[a-zA-Z0-9.:_-]{1,253}$/.test(ip)) {
      return resolve({ online: false, latency: 0 });
    }
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `ping -n 1 -w 2000 ${ip}` : `ping -c 1 -W 2 ${ip}`;
    const start = Date.now();
    exec(cmd, { timeout: 4000 }, (err, stdout) => {
      if (err) return resolve({ online: false, latency: 0 });
      // Extrai a latência real do output ("time=12.3 ms" / "tempo=12ms"); fallback: tempo decorrido.
      const m = (stdout || '').match(/(?:time|tempo)[=<]\s*([\d.,]+)\s*ms/i);
      const latency = m ? Math.round(parseFloat(m[1].replace(',', '.'))) : (Date.now() - start);
      resolve({ online: true, latency });
    });
  });
}

// Helper para limitar concorrência
async function limitConcurrency(tasks, limit) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    p.then(() => executing.delete(p));
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

async function pollSites() {
  try {
    const sites = await new Promise((resolve) => {
      db.all('SELECT ip FROM managed_sites', [], (err, rows) => resolve(rows || []));
    });

    const ipList = new Set();
    sites.forEach(s => { if (s.ip) ipList.add(s.ip.trim()); });

    const ipArray = Array.from(ipList);
    const limit = 10;
    const tasks = ipArray.map(ip => async () => {
      const res = await pingHost(ip);
      pingCache.set(ip, { ...res, lastCheck: new Date().toISOString() });
    });

    await limitConcurrency(tasks, limit);
  } catch (e) {
    console.error("Erro no pollSites:", e.message);
  }
}

// Primeira coleta + polling contínuo a cada 60s.
pollSites().catch(() => {});
setInterval(() => pollSites().catch(() => {}), 60 * 1000);

// Endpoint dedicado para obter locais gerenciados com status de ping
app.get('/api/monitoring/sites', authenticate, (req, res) => {
  db.all('SELECT * FROM managed_sites ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const sites = (rows || []).map(row => {
      const ip = (row.ip || '').trim();
      const cached = pingCache.get(ip) || { online: false, latency: 0, lastCheck: null };
      return {
        ...row,
        online: cached.online,
        latency: cached.latency,
        lastCheck: cached.lastCheck
      };
    });
    const onlineSites = sites.filter(s => s.online);
    const avgLatency = onlineSites.length
      ? Math.round(onlineSites.reduce((a, b) => a + (b.latency || 0), 0) / onlineSites.length)
      : 0;
    res.json({ sites, sitesOnline: onlineSites.length, sitesTotal: sites.length, avgLatency });
  });
});

// Adicionar local gerenciado
app.post('/api/monitoring/sites', authenticate, (req, res) => {
  const { label, ip } = req.body;
  if (!label || !ip) {
    return res.status(400).json({ error: 'Nome e IP são obrigatórios' });
  }
  if (!/^[a-zA-Z0-9.:_-]{1,253}$/.test(ip)) {
    return res.status(400).json({ error: 'Formato de IP/Host inválido' });
  }
  db.run('INSERT INTO managed_sites (label, ip) VALUES (?, ?)', [label, ip], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Este IP já está sendo monitorado' });
      }
      return res.status(500).json({ error: err.message });
    }
    try { logAction(req, 'MONITORAMENTO', `Adicionou local para ping: ${label} (${ip})`); } catch (e) {}
    res.status(201).json({ id: this.lastID, label, ip });
    pollSites().catch(() => {});
  });
});

// Remover local gerenciado
app.delete('/api/monitoring/sites/:id', authenticate, (req, res) => {
  const { id } = req.params;
  db.get('SELECT label, ip FROM managed_sites WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Local não encontrado' });
    db.run('DELETE FROM managed_sites WHERE id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      try { logAction(req, 'EXCLUSÃO', `Removeu local de ping: ${row.label} (${row.ip})`); } catch (e) {}
      pingCache.delete((row.ip || '').trim());
      res.json({ message: 'Local removido com sucesso' });
    });
  });
});

// Rota de status do sistema (Disco + Latência dos locais gerenciados).
app.get('/api/system-status', authenticate, (req, res) => {
  db.all('SELECT * FROM managed_sites', [], (errSites, rowsSites) => {
    exec('df -h / --output=size,used,avail,pcent | tail -1', (errDisk, stdout) => {
      let disk = { size: '0', used: '0', avail: '0', percent: '0%' };
      if (!errDisk) {
        const parts = stdout.trim().split(/\s+/).filter(Boolean);
        if (parts.length >= 4) {
          disk = { size: parts[0], used: parts[1], avail: parts[2], percent: parts[3] };
        }
      }

      const sites = (rowsSites || []).map(row => {
        const ip = (row.ip || '').trim();
        const cached = pingCache.get(ip) || { online: false, latency: 0, lastCheck: null };
        return {
          ...row,
          online: cached.online,
          latency: cached.latency,
          lastCheck: cached.lastCheck
        };
      });

      const onlineSites = sites.filter(s => s.online);
      const avgLatency = onlineSites.length
        ? Math.round(onlineSites.reduce((a, b) => a + (b.latency || 0), 0) / onlineSites.length)
        : 0;

      res.json({
        disk,
        latency: avgLatency,
        sites,
        sitesOnline: onlineSites.length,
        sitesTotal: sites.length
      });
    });
  });
});

// Catch-all para rotas do React (SPA)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
