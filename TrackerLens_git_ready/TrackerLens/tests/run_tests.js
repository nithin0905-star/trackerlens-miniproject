const { execSync } = require('child_process');

console.log('Running TrackerLens Test Suite...\n');

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${message}`);
  }
}

// Very basic test suite to verify module syntax and basic sanity
try {
  // Test loading config
  console.log('--- Config Sanity ---');
  const config = require('../shared/config.js');
  // We can't easily require ES modules directly without type="module" or experimental flags in this plain script,
  // but we can at least run syntax checks via node.
  
  console.log('\n--- Syntax Checks ---');
  const files = [
    'background/service_worker.js',
    'background/message_router.js',
    'background/request_monitor.js',
    'content/bridge.js',
    'content/fingerprint/fp_main.js',
    'content/page_observer.js',
    'detection/tracker_detector.js',
    'detection/fingerprint_detector.js',
    'scoring/score_engine.js',
  ];
  
  for (const file of files) {
    try {
      execSync(`node --check ${file}`, { stdio: 'ignore', cwd: require('path').join(__dirname, '..') });
      assert(true, `${file} syntax OK`);
    } catch (e) {
      assert(false, `${file} syntax ERROR`);
    }
  }

} catch (e) {
  console.error(e);
}

console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
