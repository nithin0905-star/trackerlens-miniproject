const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

// Folders and files to include in the release extension package
const includeDirs = [
  'background', 'content', 'data', 'detection', 
  'fonts', 'history', 'icons', 'options', 'popup', 'report',
  'scoring', 'shared', 'storage', 'summary'
];
const includeFiles = ['manifest.json'];

// Clean dist
if (fs.existsSync(dist)) {
  fs.rmSync(dist, { recursive: true, force: true });
}
fs.mkdirSync(dist, { recursive: true });

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // Phase 5 Privacy Audit: Ensure test files and demo data are not included
    const excludeFiles = ['demo_data.js', 'mock_data.js'];
    const excludeExts = ['.test.js', '.md', '.py'];
    
    const shouldExclude = excludeFiles.some(f => src.endsWith(f)) || excludeExts.some(ext => src.endsWith(ext));
    if (!shouldExclude) {
      fs.copyFileSync(src, dest);
    }
  }
}

console.log('Building TrackerLens release...');

includeDirs.forEach(dir => {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyRecursiveSync(src, path.join(dist, dir));
    console.log(`Copied ${dir}/`);
  }
});

includeFiles.forEach(file => {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dist, file));
    console.log(`Copied ${file}`);
  }
});

console.log(`\nBuild complete. Release package is ready in ./dist`);
