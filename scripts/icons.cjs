const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
(async () => {
  const dir = path.join(__dirname, '..', 'assets');
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'));
  const png = await sharp(svg).resize(512, 512).png().toBuffer(); fs.writeFileSync(path.join(dir, 'icon.png'), png);
  const small = await sharp(svg).resize(256, 256).png().toBuffer();
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(small.length, 14); header.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(dir, 'icon.ico'), Buffer.concat([header, small]));
})();
