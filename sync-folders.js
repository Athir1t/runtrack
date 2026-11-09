const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const dstDir = 'C:\\Users\\User\\OneDrive\\Documents\\Project\\run_track';

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (file === 'node_modules' || file === '.git' || file === '.next') continue;
      copyRecursive(path.join(src, file), path.join(dst, file));
    }
  } else {
    const parent = path.dirname(dst);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

try {
  copyRecursive(srcDir, dstDir);
  console.log('Successfully mirrored all files to run_track');
} catch (e) {
  console.error('Mirror error:', e.message);
}
