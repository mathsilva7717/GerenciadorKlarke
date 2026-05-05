/**
 * KLARKE AGENT - Monitoramento de Status e Snapshots (V3)
 * 
 * Requisito: FFMPEG instalado e no PATH do Windows.
 * 
 * Uso: node klarke-agent.js <URL_API> <SERIAL_PC> <SERIAL_CAM:RTSP_LINK> ...
 * 
 * Exemplo: node klarke-agent.js https://klarke.com PC-01 CAM-01:rtsp://admin:pass@192.168.1.50:554/stream
 */

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

// Prioridade para variáveis injetadas automaticamente pelo servidor
// Se não existirem, usa os argumentos da linha de comando
const apiUrl = (typeof AUTO_URL !== 'undefined' ? AUTO_URL : args[0] || '').replace(/\/$/, '');
const mySerial = args[0] && args[1] ? args[1] : (typeof AUTO_TOKEN !== 'undefined' ? 'PC-CLIENTE' : args[1]); 
const cameras = (typeof AUTO_URL !== 'undefined') ? args : args.slice(2); 

if (!apiUrl) {
    console.log('Uso: node klarke-agent.js <URL_API> <SERIAL_PC> [SERIAL_CAM:RTSP_LINK ...]');
    process.exit(1);
}

console.log(`🚀 Klarke Agent V3 Iniciado!`);
console.log(`📍 Monitorando PC: ${mySerial}`);
console.log(`📷 Câmeras configuradas: ${cameras.length}`);

function sendHeartbeat(serial, type = 'machine') {
    const data = JSON.stringify({ serial_number: serial, type: type });
    postToApi('/api/monitoring/heartbeat', data);
}

function sendSnapshot(serial, base64Image) {
    const data = JSON.stringify({ serial_number: serial, image: base64Image });
    postToApi('/api/monitoring/snapshot', data);
}

function postToApi(endpoint, jsonData) {
    const url = new URL(`${apiUrl}${endpoint}`);
    const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(jsonData)
        }
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options);
    req.on('error', (e) => console.error(`[API] Erro: ${e.message}`));
    req.write(jsonData);
    req.end();
}

async function takeSnapshot(serial, rtsp) {
    const tempFile = path.join(__dirname, `temp_${serial}.jpg`);
    // Comando FFMPEG para extrair 1 frame
    const cmd = `ffmpeg -y -rtsp_transport tcp -i "${rtsp}" -frames:v 1 -q:v 2 "${tempFile}"`;
    
    return new Promise((resolve) => {
        exec(cmd, (error) => {
            if (error) {
                console.error(`[${serial}] ❌ Falha ao capturar imagem: ${error.message}`);
                resolve(null);
            } else {
                const base64 = fs.readFileSync(tempFile, { encoding: 'base64' });
                fs.unlinkSync(tempFile);
                resolve(base64);
            }
        });
    });
}

async function runMonitor() {
    console.log(`\n[${new Date().toLocaleTimeString()}] 🔄 Ciclo de monitoramento iniciado...`);
    
    // 1. Heartbeat do PC
    sendHeartbeat(mySerial);

    // 2. Processar Câmeras
    for (const cam of cameras) {
        const parts = cam.split('rtsp:'); // Divide mantendo o rtsp:
        const serial = parts[0].replace(':', '');
        const rtsp = 'rtsp:' + parts[1];

        if (!serial || !rtsp) continue;

        console.log(`[${serial}] 📸 Capturando imagem...`);
        const image = await takeSnapshot(serial, rtsp);
        if (image) {
            console.log(`[${serial}] ✅ Imagem capturada. Enviando para VPS...`);
            sendSnapshot(serial, image);
            // Também manda heartbeat pra marcar como online
            sendHeartbeat(serial, 'camera');
        }
    }
}

// Rodar agora
runMonitor();

// Repetir a cada 10 minutos para não sobrecarregar
setInterval(runMonitor, 600000);
