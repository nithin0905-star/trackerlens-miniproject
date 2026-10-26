const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname);

// 1. Validate manifest JSON
const manifestPath = path.join(base, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log('✅ MANIFEST VALID:');
console.log('   Name:', manifest.name);
console.log('   Version:', manifest.version);
console.log('   Service Worker:', manifest.background?.service_worker);

// 2. Check all manifest-referenced files exist
console.log('\n--- Checking Manifest References ---');
const refs = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
];
for (const script of manifest.content_scripts || []) {
  refs.push(...(script.js || []));
}
for (const icon of Object.values(manifest.icons || {})) {
  refs.push(icon);
}

let allExist = true;
for (const ref of refs) {
  if (!ref) continue;
  const full = path.join(base, ref.replace(/^\//, ''));
  if (fs.existsSync(full)) {
    console.log(`   OK: ${ref}`);
  } else {
    console.error(`   MISSING: ${ref}`);
    allExist = false;
  }
}

// 3. Check for eval()
console.log('\n--- Checking for eval() calls ---');
let evalFound = false;
function checkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'archive'].includes(entry.name)) continue;
      checkDir(full);
    } else if (entry.name.endsWith('.js') && entry.name !== 'validate.js') {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const stripped = line.trim();
        if (/\beval\s*\(/.test(stripped) && !stripped.startsWith('//')) {
          console.error(`   FOUND eval() in ${path.relative(base, full)}:${idx + 1}`);
          evalFound = true;
        }
      });
    }
  }
}
checkDir(base);
if (!evalFound) {
  console.log('   OK: No eval() found in codebase.');
}

console.log(`\nValidation complete: ${allExist && !evalFound ? 'ALL CHECKS PASSED ✅' : 'FAILED ❌'}`);
if (!allExist || evalFound) process.exit(1);
