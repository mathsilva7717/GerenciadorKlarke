const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const tables = ['machines', 'cameras', 'network_devices'];

db.serialize(() => {
  tables.forEach(table => {
    db.run(`ALTER TABLE ${table} ADD COLUMN last_seen DATETIME`, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log(`Coluna last_seen já existe em ${table}`);
        } else {
          console.error(`Erro ao alterar tabela ${table}:`, err.message);
        }
      } else {
        console.log(`Coluna last_seen adicionada com sucesso em ${table}`);
      }
    });
  });
});

db.close();
