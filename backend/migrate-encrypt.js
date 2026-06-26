// Migração única: criptografa em AES-256-GCM as senhas em texto plano já existentes.
// Uso: node migrate-encrypt.js   (lê ENCRYPTION_KEY do .env)
// Idempotente: valores já criptografados (prefixo enc:v1:) são ignorados.
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY não definido no .env. Abortando.');
  process.exit(1);
}
const encKey = Buffer.from(ENCRYPTION_KEY, 'base64');
if (encKey.length !== 32) {
  console.error('ENCRYPTION_KEY deve ter 32 bytes em base64.');
  process.exit(1);
}

const ENC_PREFIX = 'enc:v1:';
function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  if (typeof plain === 'string' && plain.startsWith(ENC_PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + iv.toString('base64') + ':' + tag.toString('base64') + ':' + ct.toString('base64');
}

const db = new DatabaseSync(path.join(__dirname, 'database.sqlite'));
const tables = ['credentials', 'machines', 'cameras', 'network_devices', 'voip_extensions'];

let total = 0;
for (const table of tables) {
  let migrated = 0;
  try {
    const rows = db.prepare(`SELECT id, password FROM ${table} WHERE password IS NOT NULL AND password <> ''`).all();
    const update = db.prepare(`UPDATE ${table} SET password = ? WHERE id = ?`);
    for (const row of rows) {
      if (typeof row.password === 'string' && row.password.startsWith(ENC_PREFIX)) continue; // já cifrado
      update.run(encryptSecret(row.password), row.id);
      migrated++;
    }
    console.log(`${table}: ${migrated} senha(s) criptografada(s)`);
    total += migrated;
  } catch (e) {
    console.error(`${table}: erro - ${e.message}`);
  }
}
console.log(`\nConcluído. Total: ${total} registro(s).`);
