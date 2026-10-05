const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const vite = spawn(process.execPath, [path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js')], { stdio: 'inherit' });
let electron;
const timer = setInterval(() => {
  const request = http.get('http://127.0.0.1:5178', res => {
    res.resume(); if (res.statusCode !== 200 || electron) return;
    clearInterval(timer); const env = { ...process.env, MD_HAWK_DEV: '1' }; delete env.ELECTRON_RUN_AS_NODE;
    electron = spawn(require('electron'), ['.'], { stdio: 'inherit', env }); electron.on('exit', () => { vite.kill(); process.exit(); });
  }); request.on('error', () => {});
}, 400);
process.on('SIGINT', () => { clearInterval(timer); electron?.kill(); vite.kill(); process.exit(); });
vite.on('exit', code => { if (code) { clearInterval(timer); process.exit(code); } });
