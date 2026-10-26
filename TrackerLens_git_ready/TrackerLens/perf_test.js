const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TESTS = [
  'https://www.cnn.com',
  'https://www.theverge.com',
  'https://www.wikipedia.org'
];

async function measurePageLoad(browser, url) {
  const page = await browser.newPage();
  
  const metrics = {
    url,
    success: false,
    error: null,
    domContentLoaded: -1,
    loadEvent: -1
  };
  
  try {
    const start = Date.now();
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    const end = Date.now();
    
    // Get navigation timing
    const timing = await page.evaluate(() => JSON.stringify(window.performance.timing));
    const t = JSON.parse(timing);
    
    metrics.success = true;
    metrics.domContentLoaded = t.domContentLoadedEventEnd - t.navigationStart;
    metrics.loadEvent = t.loadEventEnd - t.navigationStart;
    
  } catch (err) {
    metrics.error = err.message;
  } finally {
    await page.close();
  }
  
  return metrics;
}

async function runTests(withExtension) {
  const extensionPath = path.resolve(__dirname, 'dist');
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu' // to reduce noise
  ];
  
  if (withExtension) {
    args.push(`--disable-extensions-except=${extensionPath}`);
    args.push(`--load-extension=${extensionPath}`);
  }
  
  console.log(`\n=== Running tests ${withExtension ? 'WITH' : 'WITHOUT'} TrackerLens ===`);
  const browser = await puppeteer.launch({ headless: 'new', args });
  
  const results = [];
  for (const url of TESTS) {
    console.log(`Testing ${url}...`);
    const metrics = await measurePageLoad(browser, url);
    results.push(metrics);
    console.log(`  - DCL: ${metrics.domContentLoaded}ms, Load: ${metrics.loadEvent}ms`);
  }
  
  await browser.close();
  return results;
}

(async () => {
  try {
    const withoutExt = await runTests(false);
    const withExt = await runTests(true);
    
    console.log('\n=== RESULTS SUMMARY ===');
    console.log('Site | DCL Without | DCL With | Diff | Load Without | Load With | Diff');
    for (let i = 0; i < TESTS.length; i++) {
      const site = TESTS[i].replace('https://www.', '').substring(0, 10);
      const wOut = withoutExt[i];
      const wExt = withExt[i];
      
      const dclDiff = wExt.domContentLoaded - wOut.domContentLoaded;
      const loadDiff = wExt.loadEvent - wOut.loadEvent;
      
      console.log(`${site.padEnd(10)} | ${wOut.domContentLoaded.toString().padStart(11)} | ${wExt.domContentLoaded.toString().padStart(8)} | ${dclDiff.toString().padStart(4)} | ${wOut.loadEvent.toString().padStart(12)} | ${wExt.loadEvent.toString().padStart(9)} | ${loadDiff}`);
    }
  } catch (err) {
    console.error('Test script failed:', err);
  }
})();
