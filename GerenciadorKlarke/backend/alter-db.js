const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("ALTER TABLE machines ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
    if (err) console.log("machines err:", err.message);
    else console.log("machines altered");
  });
  db.run("ALTER TABLE cameras ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
    if (err) console.log("cameras err:", err.message);
    else console.log("cameras altered");
  });
  db.run("ALTER TABLE network_devices ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (err) => {
    if (err) console.log("network_devices err:", err.message);
    else console.log("network_devices altered");
  });
});
