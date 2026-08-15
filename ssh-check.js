const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  'pm2 status',
  'netstat -tuln | grep -E "80|443|3000|8080|3434"',
  'docker ps',
  'systemctl status nginx --no-pager',
  'ps aux | grep node'
];

conn.on('ready', () => {
  console.log('Client :: ready');
  let cmdIndex = 0;
  
  const runNext = () => {
    if (cmdIndex >= commands.length) {
      conn.end();
      return;
    }
    const cmd = commands[cmdIndex++];
    console.log(`\n=== Running: ${cmd} ===`);
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('Error running cmd:', err);
        runNext();
        return;
      }
      stream.on('close', (code, signal) => {
        runNext();
      }).on('data', (data) => {
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  };
  
  runNext();
}).connect({
  host: '191.252.223.63',
  port: 22,
  username: 'root',
  password: 'Klarke@200818',
  readyTimeout: 10000
});
