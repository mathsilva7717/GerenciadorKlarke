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
const logAction = (user, action, details) => {
  db.run("INSERT INTO audit_logs (user, action, details) VALUES (?, ?, ?)", [user || 'Sistema', action, details]);
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
  db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Usuário removido' });
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
      try { logAction(created_by || 'Sistema', 'NOVO EQUIPAMENTO', `Cadastrou máquina: ${name}`); } catch (e) {}
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
      try { logAction(created_by || 'Sistema', 'NOVA CÂMERA', `Cadastrou câmera: ${name}`); } catch (e) {}
      res.status(201).json({ id: this.lastID });
    }
  });
});

app.put('/api/cameras/:id', authenticate, (req, res) => {
  const { name, ip, port, username, password, location, serial_number, rtsp_link } = req.body;
  const sql = `UPDATE cameras SET name = ?, ip = ?, port = ?, username = ?, password = ?, location = ?, serial_number = ?, rtsp_link = ? WHERE id = ?`;
  db.run(sql, [name, ip, port, username, password, location, serial_number, rtsp_link, req.params.id], function (err) {
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
      try { logAction(created_by || 'Sistema', 'NOVA REDE', `Cadastrou dispositivo de rede: ${name}`); } catch (e) {}
      res.status(201).json({ id: this.lastID });
    }
  });
});

app.put('/api/network-devices/:id', authenticate, (req, res) => {
  const { name, type, ip, username, password, location, isp, serial_number } = req.body;
  const sql = `UPDATE network_devices SET name = ?, type = ?, ip = ?, username = ?, password = ?, location = ?, isp = ?, serial_number = ? WHERE id = ?`;
  db.run(sql, [name, type, ip, username, password, location, isp, serial_number, req.params.id], function (err) {
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
  const { is_completed, completed_by } = req.body;
  const completed_at = is_completed ? new Date().toISOString() : null;
  const sql = `UPDATE tasks SET is_completed = ?, completed_by = ?, completed_at = ? WHERE id = ?`;
  db.run(sql, [is_completed ? 1 : 0, is_completed ? completed_by : null, completed_at, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (is_completed) {
      logAction(completed_by, 'TAREFA CONCLUÍDA', `Finalizou tarefa ID #${req.params.id}`);
    }
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
  const { title, type, content } = req.body;
  const filePath = req.file ? req.file.filename : null;
  const fileSize = req.file ? `${(req.file.size / 1024).toFixed(1)} KB` : null;

  db.run(
    "INSERT INTO technical_docs (title, type, content, file_path, file_size) VALUES (?, ?, ?, ?, ?)",
    [title, type || 'Nota', content, filePath, fileSize],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, title, filePath });
    }
  );
});

app.delete('/api/technical-docs/:id', authenticate, (req, res) => {
  db.get("SELECT file_path FROM technical_docs WHERE id = ?", [req.params.id], (err, row) => {
    if (row && row.file_path) {
      const fullPath = path.join(__dirname, 'uploads/docs', row.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    db.run("DELETE FROM technical_docs WHERE id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Documento removido' });
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
