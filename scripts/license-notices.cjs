const fs = require('node:fs');
const path = require('node:path');
const seen = new Set(), notices = [];
function visit(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory)) {
    if (entry.startsWith('.')) continue;
    const folder = path.join(directory, entry);
    if (entry.startsWith('@')) { visit(folder); continue; }
    const manifest = path.join(folder, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')), key = pkg.name + '@' + pkg.version;
    if (!seen.has(key)) {
      seen.add(key);
      const texts = fs.readdirSync(folder).filter(name => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name)).filter(name => fs.statSync(path.join(folder, name)).isFile()).map(name => name + '\n' + fs.readFileSync(path.join(folder, name), 'utf8'));
      notices.push(key + '\nLicense: ' + JSON.stringify(pkg.license || pkg.licenses || 'See package source') + '\n' + texts.join('\n\n'));
    }
    visit(path.join(folder, 'node_modules'));
  }
}
visit('node_modules');
fs.writeFileSync('THIRD-PARTY-NOTICES.txt', 'MD Hawk third-party notices\nIncludes build tools and runtime dependencies. Electron/Chromium notices also ship with the executable.\n\n' + notices.sort().join('\n\n' + '='.repeat(72) + '\n\n') + '\n');
console.log('Generated notices for ' + seen.size + ' packages');
