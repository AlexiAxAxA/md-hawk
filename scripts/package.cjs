const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..'), logdir = path.join(root, '.verification'); fs.mkdirSync(logdir, { recursive: true });
const log = fs.openSync(path.join(logdir, 'package.log'), 'w');
const env = { ...process.env, ELECTRON_BUILDER_CACHE: path.join(logdir, 'builder-cache'), electron_config_cache: path.join(logdir, 'electron-cache') };
const command = path.join(root, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
process.env.electron_config_cache = env.electron_config_cache;
const runtime = path.dirname(require('electron'));
// NSIS 3.0.4.1 ships a Hindi string missing its closing quote. Patch only this
// known syntax error in this project's downloaded build cache, never global NSIS.
function repairHindi(directory) {
  if (!fs.existsSync(directory)) return false;
  let repaired = false;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) repaired = repairHindi(file) || repaired;
    else if (entry.isFile() && entry.name === 'Hindi.nsh') {
      const source = fs.readFileSync(file, 'utf8');
      const next = source.replace(/^(.*MULTIUSER_INNERTEXT_INSTALLMODE_CURRENTUSER[^\r\n]*)(\r?\n|$)/m, (line, content, ending) => (content.match(/"/g) || []).length === 1 ? content + '"' + ending : line);
      if (next !== source) { fs.writeFileSync(file, next); repaired = true; }
    }
  }
  return repaired;
}
repairHindi(env.ELECTRON_BUILDER_CACHE);
const build = () => spawnSync(process.execPath, [command, '--win', 'nsis', 'portable', '--config.electronDist=' + runtime], { cwd: root, env, stdio: ['ignore', log, log] });
let result = build();
if (result.status && repairHindi(env.ELECTRON_BUILDER_CACHE)) result = build();
fs.closeSync(log); if (result.error) console.error(result.error); console.log(fs.readFileSync(path.join(logdir, 'package.log'), 'utf8').split('\n').slice(-30).join('\n')); process.exit(result.status || (result.error ? 1 : 0));
