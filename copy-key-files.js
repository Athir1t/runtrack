const fs = require('fs');
const path = require('path');

const src = __dirname;
const dst = 'C:\\Users\\User\\OneDrive\\Documents\\Project\\run_track';

const filesToCopy = [
  'package.json',
  'public/index.html',
  'src/data/program.json',
  'src/data/athletes.json'
];

for (const rel of filesToCopy) {
  try {
    const srcPath = path.join(src, rel);
    const dstPath = path.join(dst, rel);
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.writeFileSync(dstPath, fs.readFileSync(srcPath));
    console.log('Copied to run_track:', rel);
  } catch (e) {
    console.error('Error copying', rel, e.message);
  }
}
