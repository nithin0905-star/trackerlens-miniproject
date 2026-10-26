const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const extensionPath = path.resolve(__dirname, 'dist');
  
  console.log('Launching browser with TrackerLens installed...');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null, // Let it use the window size
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--start-maximized'
    ]
  });

  // Give the extension a moment to initialize
  await new Promise(r => setTimeout(r, 2000));

  // Find extension ID by looking for the service worker target
  const targets = browser.targets();
  const swTarget = targets.find(t => t.type() === 'service_worker' || t.url().startsWith('chrome-extension://'));
  if (!swTarget) {
    console.error('Could not find extension target. Demo failed.');
    await browser.close();
    return;
  }
  
  const extensionUrl = swTarget.url();
  const match = extensionUrl.match(/chrome-extension:\/\/([a-z]{32})/);
  if (!match) {
    console.error('Could not extract extension ID from URL:', extensionUrl);
    await browser.close();
    return;
  }
  
  const extensionId = match[1];
  console.log(`Found TrackerLens Extension ID: ${extensionId}`);

  // Navigate to a site to gather data
  console.log('Navigating to cnn.com to detect trackers & fingerprinting...');
  const page = await browser.newPage();
  await page.goto('https://www.cnn.com', { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.log('Page loaded (timeout ignored)'));
  
  // Wait a bit for requests and signals to be processed by the extension
  console.log('Waiting 8 seconds for extension to process requests...');
  await new Promise(r => setTimeout(r, 8000));

  // Open Popup
  console.log('Opening TrackerLens Popup...');
  const popupPage = await browser.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Click "Explain Score"
  console.log('Expanding Score Explanation...');
  try {
    await popupPage.waitForSelector('#btnExplain', { timeout: 3000 });
    await popupPage.click('#btnExplain');
  } catch (e) {
    console.log('Could not click explain button', e.message);
  }
  
  await new Promise(r => setTimeout(r, 4000));

  // Open Summary
  console.log('Opening Weekly Summary Report...');
  const summaryPage = await browser.newPage();
  await summaryPage.goto(`chrome-extension://${extensionId}/summary/summary.html`);
  await new Promise(r => setTimeout(r, 4000));

  // Open History
  console.log('Opening Audit History...');
  const historyPage = await browser.newPage();
  await historyPage.goto(`chrome-extension://${extensionId}/history/history.html`);
  await new Promise(r => setTimeout(r, 4000));

  // Open Options
  console.log('Opening Settings...');
  const optionsPage = await browser.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`);
  await new Promise(r => setTimeout(r, 5000));

  console.log('Demo finished. Closing browser in 3 seconds...');
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
