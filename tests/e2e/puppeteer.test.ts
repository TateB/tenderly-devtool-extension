import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer, { type Browser, type Frame, type Page } from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionPath = path.resolve(__dirname, '../../dist');
const testPagePath = path.resolve(__dirname, '../test.html');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tenderly-puppeteer-'));

// --- Test Fixtures ---

let browser: Browser;
let extensionId: string;
let mainPage: Page;
let devtoolsPage: Page;
let panelFrame: Frame | null = null;
let testServer: any;

async function discoverExtensionId(browser: Browser): Promise<string> {
  const session = await browser.target().createCDPSession();
  await session.send('Target.setDiscoverTargets', { discover: true });

  let extId: string | undefined = undefined;

  // Extensions might take a moment to initialize in a clean profile
  for (let i = 0; i < 50; i++) {
    const { targetInfos } = await session.send('Target.getTargets');
    for (const t of targetInfos) {
        if (!t.url) continue;
        const match = t.url.match(/chrome-extension:\/\/([a-z]+)/);
        if (match) {
            extId = match[1];
            break;
        }
    }
    if (extId) break;
    await new Promise(r => setTimeout(r, 100)); // Wait 100ms
  }

  await session.detach();

  if (!extId) {
    throw new Error('Could not extract extension ID from CDP targets');
  }
  return extId;
}

async function getDevToolsPage(browser: Browser): Promise<Page> {
  const targets = await browser.targets();
  const devtoolsTarget = targets.find(t => t.url().includes('devtools://devtools'));
  if (!devtoolsTarget) {
    throw new Error('DevTools target not found');
  }
  const page = await devtoolsTarget.page();
  if (!page) {
    throw new Error('Could not get page for DevTools target');
  }
  return page;
}

async function activateExtensionPanel(devtoolsPage: Page): Promise<void> {
  const isMac = process.platform === 'darwin';
  const modifier = isMac ? 'Meta' : 'Control';

  // Make sure we click in the DevTools window to focus it before sending keys
  await devtoolsPage.bringToFront();
  await devtoolsPage.mouse.click(100, 100);
  await new Promise(r => setTimeout(r, 100)); // brief wait for focus

  console.log('Cycling through DevTools tabs until Tenderly panel appears...');

  for (let i = 0; i < 30; i++) {
     await devtoolsPage.keyboard.down(modifier);
     await devtoolsPage.keyboard.press(']');
     await devtoolsPage.keyboard.up(modifier);

     // Quick poll for up to 100ms per tab
     for (let j = 0; j < 4; j++) {
         await new Promise(r => setTimeout(r, 25));
         const frames = devtoolsPage.frames();
         const pframe = frames.find(f => f.url().includes('panel.html'));
         if (pframe) {
             console.log(`Found Tenderly panel iframe after ${i + 1} tab switches!`);
             return; // Success!
         }
     }
  }

  throw new Error('Could not find Tenderly panel running after cycling all DevTools tabs');
}

async function getPanelFrame(devtoolsPage: Page): Promise<Frame> {
    const frames = devtoolsPage.frames();
    const panelFrames = frames.filter(f => f.url().includes('panel.html'));
    if (panelFrames.length === 0) {
        throw new Error('Panel frame not found');
    }
    // Return the last one created as devtoolsPage.reload() sometimes leaves zombie frames in Puppeteer's array
    return panelFrames[panelFrames.length - 1]!;
}

/**
 * Ensures we have a stable reference to the panel frame.
 * If DevTools reloaded the iframe (e.g. on navigation), this re-fetches it.
 */
async function ensurePanelFrame(devtoolsPage: Page): Promise<Frame> {
  for (let i = 0; i < 10; i++) {
     try {
         const frame = await getPanelFrame(devtoolsPage);
         // Verify it's actually alive by evaluating something small
         await frame.evaluate('document.body.tagName');
         panelFrame = frame;
         return frame;
     } catch (e) {
         await new Promise(r => setTimeout(r, 200));
     }
  }
  throw new Error('Could not acquire stable panel frame');
}

/**
 * Wait for the Solid app to mount after a page load or reload.
 * The entry point sets data-ready="true" on #root after render().
 */
async function waitForAppReady(timeoutMs = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const frame = await ensurePanelFrame(devtoolsPage);
            const ready = await frame.evaluate(() =>
                document.getElementById('root')?.getAttribute('data-ready') === 'true'
            );
            if (ready) return;
        } catch {
            // Frame may be detached during reload; retry
        }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('Timeout waiting for Solid app to mount');
}

/**
 * Resilient waiter that survives frame detachments by re-acquiring the frame and retrying.
 */
async function safeWaitForSelectorCount(selector: string, minCount: number, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    let lastFrame: Frame | null = null;
    while (Date.now() - start < timeoutMs) {
        try {
            const frame = await ensurePanelFrame(devtoolsPage);
            lastFrame = frame;
            const count = await frame.$$eval(selector, els => els.length);
            if (count >= minCount) return;
        } catch (e) {
            // Ignore detached errors and retry
        }
        await new Promise(r => setTimeout(r, 250));
    }

    // Dump HTML on timeout for debugging
    if (lastFrame) {
        try {
            const html = await lastFrame.content();
            fs.writeFileSync('/tmp/devtools-dump.html', html);
            console.error(`Dumped panel HTML to /tmp/devtools-dump.html`);
        } catch(e) {}
    }

    throw new Error(`Timeout waiting for ${minCount} of ${selector} to appear`);
}

async function safeWaitForCondition(evaluateFn: () => boolean | null | undefined, timeoutMs = 5000): Promise<void> {
    const start = Date.now();
    const fnString = evaluateFn.toString();
    while (Date.now() - start < timeoutMs) {
        try {
            const frame = await ensurePanelFrame(devtoolsPage);
            // We pass the function as a string to evaluate to avoid serialization issues
            const result = await frame.evaluate(`(${fnString})()`);
            if (result) return;
        } catch (e) {
            // Ignore detached errors and retry
        }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`Timeout waiting for condition to be true`);
}

async function clearExtensionStorage(): Promise<void> {
  if (!panelFrame) return;
  await panelFrame.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.clear(() => resolve());
    });
  });
  // Wait a tiny bit for storage clear to register globally before reloading the panel
  await new Promise(r => setTimeout(r, 50));
}

/**
 * Utility to reload the DevTools panel to apply fresh storage state.
 */
async function resetPanelState() {
    await clearExtensionStorage();
    await reloadPanel();
}

async function reloadPanel() {
    if (panelFrame) {
         try {
             // Reload just the panel iframe instead of entire DevTools window
             await panelFrame.evaluate(() => window.location.reload());
             await new Promise(r => setTimeout(r, 300));
             await waitForAppReady();
         } catch(e) {
             console.log('Error reloading panel iframe:', e);
         }
    }
}

/**
 * Navigate to the settings tab and wait for the settings view to mount.
 * With Solid's <Show>, the settings DOM is created/destroyed on tab switch.
 */
async function openSettings(): Promise<void> {
    await safeWaitForCondition(() => {
        document.getElementById('nav-settings')?.click();
        return !!document.getElementById('settings-view');
    }, 5000);
}

/**
 * Close settings and wait for the requests tab to show.
 */
async function closeSettings(): Promise<void> {
    await safeWaitForCondition(() => {
        document.getElementById('close-settings')?.click();
        return !!document.getElementById('split-view');
    }, 5000);
}


// --- Test Suite ---

const {
  TENDERLY_API_KEY,
  TENDERLY_ACCOUNT_SLUG,
  TENDERLY_PROJECT_SLUG,
  ETHERSCAN_API_KEY
} = process.env;

if (!TENDERLY_API_KEY || !TENDERLY_ACCOUNT_SLUG || !TENDERLY_PROJECT_SLUG || !ETHERSCAN_API_KEY) {
  throw new Error('E2E tests require TENDERLY_API_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG, and ETHERSCAN_API_KEY to be set in the environment (e.g., .env.test.local).');
}

describe('Tenderly DevTools Extension', () => {

  beforeAll(async () => {
    // Launch browser with extension and DevTools enabled
    browser = await puppeteer.launch({
      headless: true,
      devtools: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        `--window-size=1920,1080`
      ],
      defaultViewport: null
    });

    // Discover extension ID
    extensionId = await discoverExtensionId(browser);
    console.log('Extension loaded with ID:', extensionId);

    // Get/create a page and navigate to trigger DevTools via localhost instead of file://
    const pages = await browser.pages();
    mainPage = pages[0] || await browser.newPage();

    testServer = Bun.serve({
      port: 3000,
      fetch() {
        return new Response(Bun.file(testPagePath));
      }
    });

    await mainPage.goto(`http://localhost:3000`);

    // Wait for DevTools and extension to fully initialize
    await new Promise(r => setTimeout(r, 500));

    // Get the DevTools window Page
    devtoolsPage = await getDevToolsPage(browser);

    // Activate the Tenderly panel so the iframe is mounted
    await activateExtensionPanel(devtoolsPage);

    // Attach to the iframe inside DevTools and wait for Solid to render
    panelFrame = await getPanelFrame(devtoolsPage);
    await waitForAppReady();

  }, 30000); // 30s timeout for setup

  afterAll(async () => {
    await browser?.close();
    testServer?.stop();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up user data dir:', e);
    }
  });

  // --- Test: Extension loads and panel is accessible ---

  test('extension loads and panel is accessible', async () => {
    expect(extensionId).toBeTruthy();
    expect(panelFrame).not.toBeNull();

    // Verify the panel loads with Solid-rendered content
    const bodyText = await panelFrame!.$eval('body', el => el.textContent);
    expect(bodyText).toContain('Tenderly');
  });

  // --- Test: Panel UI structure is correct ---

  test('panel UI structure is correct', async () => {
    // On the default "requests" tab, split-view and its children should exist
    const requestList = await panelFrame!.$('#request-list');
    const splitView = await panelFrame!.$('#split-view');
    const navSettings = await panelFrame!.$('#nav-settings');

    expect(requestList).not.toBeNull();
    expect(splitView).not.toBeNull();
    expect(navSettings).not.toBeNull();

    // Settings view is conditionally rendered — only exists when on settings tab
    // Verify it doesn't exist on the requests tab
    const settingsView = await panelFrame!.$('#settings-view');
    expect(settingsView).toBeNull();
  });

  // --- Test: Settings panel can be opened ---

  test('settings panel can be opened', async () => {
    await resetPanelState();

    // Open settings — Solid's <Show> will mount the settings DOM
    await openSettings();

    // Check form elements exist
    const apiKeyInput = await panelFrame!.$('#api-key');
    const etherscanApiKeyInput = await panelFrame!.$('#etherscan-api-key');
    const accountSlugInput = await panelFrame!.$('#account-slug');
    const projectSlugInput = await panelFrame!.$('#project-slug');

    expect(apiKeyInput).not.toBeNull();
    expect(etherscanApiKeyInput).not.toBeNull();
    expect(accountSlugInput).not.toBeNull();
    expect(projectSlugInput).not.toBeNull();

    // Close settings — Solid's <Show> will unmount settings and mount split-view
    await closeSettings();

    // Verify we're back on requests tab
    const splitView = await panelFrame!.$('#split-view');
    expect(splitView).not.toBeNull();
  }, 15000);

  // --- Test: Settings can be saved and persisted ---

  test('settings can be saved and persisted', async () => {
    await resetPanelState();

    // Open settings
    await openSettings();

    // Fill in test values
    await panelFrame!.type('#api-key', TENDERLY_API_KEY);
    await panelFrame!.type('#account-slug', TENDERLY_ACCOUNT_SLUG);
    await panelFrame!.type('#project-slug', TENDERLY_PROJECT_SLUG);

    // Save settings
    await panelFrame!.$eval('#save-config', el => (el as HTMLElement).click());

    // Wait for the save-status toast to appear
    await safeWaitForCondition(() => {
        const el = document.getElementById('save-status');
        return el && window.getComputedStyle(el).opacity === '1';
    }, 5000);

    // Force reload panel to verify persistence across loads
    await reloadPanel();

    // Open settings again
    await openSettings();

    // Check values are persisted
    const apiKeyValue = await panelFrame!.$eval('#api-key', (el) => (el as HTMLInputElement).value);
    const accountSlugValue = await panelFrame!.$eval('#account-slug', (el) => (el as HTMLInputElement).value);
    const projectSlugValue = await panelFrame!.$eval('#project-slug', (el) => (el as HTMLInputElement).value);

    expect(apiKeyValue).toBe(TENDERLY_API_KEY);
    expect(accountSlugValue).toBe(TENDERLY_ACCOUNT_SLUG);
    expect(projectSlugValue).toBe(TENDERLY_PROJECT_SLUG);

    await closeSettings();
  }, 15000);

  // --- Test: Welcome screen shows when config is missing ---

  test('welcome screen shows when config is missing', async () => {
    await resetPanelState();

    // Welcome screen should be visible (when no config is set)
    const welcomeScreen = await panelFrame!.$('#welcome-screen');
    expect(welcomeScreen).not.toBeNull();

    const welcomeVisible = await panelFrame!.$eval('#welcome-screen', (el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    expect(welcomeVisible).toBe(true);
  }, 15000);



  // --- Test: Network interception captures JSON-RPC requests ---

  test('network interception captures JSON-RPC requests via DevTools API', async () => {
    // Setup valid config so we aren't stuck on the welcome screen
    await resetPanelState();

    await openSettings();

    await panelFrame!.type('#api-key', TENDERLY_API_KEY);
    await panelFrame!.type('#account-slug', TENDERLY_ACCOUNT_SLUG);
    await panelFrame!.type('#project-slug', TENDERLY_PROJECT_SLUG);

    // Enable eth_call interception
    await panelFrame!.$eval('#intercept-eth-call', el => {
        if (!(el as HTMLInputElement).checked) {
             (el as HTMLElement).click();
        }
    });

    await panelFrame!.$eval('#save-config', el => (el as HTMLElement).click());
    await safeWaitForCondition(() => {
        const el = document.getElementById('save-status');
        return el && window.getComputedStyle(el).opacity === '1';
    }, 2000);

    await closeSettings();

    // Trigger a JSON-RPC request from the main page
    await mainPage.bringToFront();
    await mainPage.click('#sendRequest');
    await new Promise(r => setTimeout(r, 1000));
    await devtoolsPage.bringToFront();

    // Wait for the DevTools network event to fire and the panel to render it
    await safeWaitForSelectorCount('.request-item', 1, 5000);

    // Verify the request appeared IN THE UI
    const requestItemsCount = await panelFrame!.$eval('#request-list', (el) => {
        return el.querySelectorAll('.request-item').length;
    });

    expect(requestItemsCount).toBeGreaterThan(0);

    const methodTagVisible = await panelFrame!.$eval('.method-tag', el => el.textContent);
    expect(methodTagVisible).toBe('eth_estimateGas');

  }, 20000); // 20s timeout for network test

  // --- Test: Viewing Request Details (Split View) ---

  test('request details populate when a request is selected', async () => {
    panelFrame = await ensurePanelFrame(devtoolsPage);

    // We already have a request from the previous test. Click it using Native JS click
    await safeWaitForSelectorCount('.request-item', 1, 5000);

    await panelFrame!.$$eval('.request-item', els => {
         if (els.length > 0) (els[0] as HTMLElement).click();
    });

    // Wait for the detail view to mount (Solid's <Show> creates it when a request is selected)
    await safeWaitForCondition(() => {
         return !!document.getElementById('detail-view');
    }, 2000);

    // Verify detail contents
    const detailMethod = await panelFrame!.$eval('#detail-method', el => el.textContent);
    expect(detailMethod).toBe('eth_estimateGas');

    // Check if request params are rendered inside the Request Params collapsible
    const paramsContentExists = await panelFrame!.$eval('.detail-body', el => el.textContent?.includes('eth_estimateGas'));
    expect(paramsContentExists).toBe(true);

    // Check if simulate button exists
    const simulateBtnExists = await panelFrame!.$eval('#simulate-btn', el => el !== null).catch(() => false);
    expect(simulateBtnExists).toBe(true);
  });

  // --- Test: Multicall Detection ---
  test('multicall detection rendering and expansion', async () => {
    panelFrame = await ensurePanelFrame(devtoolsPage);

    // Ensure we trigger a multicall request from the page
    await mainPage.bringToFront();
    await mainPage.click('#sendMulticallRequest');
    await new Promise(r => setTimeout(r, 1000));
    await devtoolsPage.bringToFront();

    // Wait for multi-tag to appear on the new item
    // Note: total requests is now 2
    await safeWaitForSelectorCount('.request-item', 2, 5000);
    await safeWaitForCondition(() => {
        return document.querySelector('.method-tag.multi') !== null;
    }, 5000);

    // Sub-items are always visible (no expand icon needed)
    await safeWaitForCondition(() => {
        return !!document.querySelector('.sub-request-list');
    }, 2000);

    // Select the sub request
    const subItemExists = await panelFrame!.$eval('.sub-item', el => el !== null).catch(() => false);
    expect(subItemExists).toBe(true);
    await panelFrame!.$eval('.sub-item', el => (el as HTMLElement).click());

    // Assert detail pane updates with Sub info
    await safeWaitForCondition(() => {
        const el = document.getElementById('detail-method');
        return el && el.textContent === 'ETH_CALL (Sub)';
    }, 2000);

    const detailMethod = await panelFrame!.$eval('#detail-method', el => el.textContent);
    expect(detailMethod).toBe('ETH_CALL (Sub)');
  });

  // --- Test: Etherscan ABI Decoding ---
  test('etherscan ABI decoding fetches and renders decoded inputs', async () => {
    panelFrame = await ensurePanelFrame(devtoolsPage);

    // Set Etherscan API Key from env
    await openSettings();

    if (process.env.ETHERSCAN_API_KEY) {
        await panelFrame!.type('#etherscan-api-key', process.env.ETHERSCAN_API_KEY);
        // Enable eth_estimateGas and eth_call just in case
        await panelFrame!.$eval('#intercept-eth-call', el => {
            if (!(el as HTMLInputElement).checked) (el as HTMLElement).click();
        });
        await panelFrame!.$eval('#save-config', el => (el as HTMLElement).click());
        await safeWaitForCondition(() => {
            const el = document.getElementById('save-status');
            return el && window.getComputedStyle(el).opacity === '1';
        }, 2000);
    }
    await closeSettings();

    // Send a call to WETH deposit `0xd0e30db0`
    await mainPage.bringToFront();
    await mainPage.click('#sendWethDeposit');
    // Wait for the fetch to complete before switching back
    await new Promise(r => setTimeout(r, 1000));
    await devtoolsPage.bringToFront();

    // Wait for the new request to render. (Total should be 3 main requests, but could be sub-items too)
    await safeWaitForSelectorCount('.request-item', 3, 5000);

    // Click the new request (newest request is prepended, so first in the list)
    await panelFrame!.$$eval('.request-item', els => {
         if (els.length > 0) (els[0] as HTMLElement).click();
    });

    // The ABI decoding happens asynchronously in the background. Wait for the function name to replace the selector.
    // Selector is `0xd0e30db0`, function name is `deposit`.
    await safeWaitForCondition(() => {
        const headerMethod = document.getElementById('detail-method');
        return headerMethod && headerMethod.textContent === 'deposit';
    }, 10000);

    const decodedMethodName = await panelFrame!.$eval('#detail-method', el => el.textContent);
    expect(decodedMethodName).toBe('deposit');

    // Check if contract name resolves
    const contractName = await panelFrame!.$eval('#detail-contract-name .contract-name', el => el.textContent);
    expect(contractName).toBe('WETH9');
  }, 30000);

  // --- Test: Simulate Transaction Flow ---
  test('simulate transaction triggers API request and handles error state', async () => {
     // Re-acquire the panel frame as it sometimes detaches across test boundaries
     panelFrame = await ensurePanelFrame(devtoolsPage);

     // We should already have a request selected from the previous test (WETH deposit)

     // Set Real API key so the UI allows simulation
     await openSettings();

     if (process.env.TENDERLY_API_KEY) {
         // Clear existing dummy keys first
         await panelFrame!.$eval('#api-key', el => (el as HTMLInputElement).value = '');
         await panelFrame!.$eval('#account-slug', el => (el as HTMLInputElement).value = '');
         await panelFrame!.$eval('#project-slug', el => (el as HTMLInputElement).value = '');

         await panelFrame!.type('#api-key', process.env.TENDERLY_API_KEY);
         await panelFrame!.type('#account-slug', process.env.TENDERLY_ACCOUNT_SLUG || '');
         await panelFrame!.type('#project-slug', process.env.TENDERLY_PROJECT_SLUG || '');
         await safeWaitForCondition(() => {
             document.getElementById('save-config')?.click();
             const el = document.getElementById('save-status');
             return el && window.getComputedStyle(el).opacity === '1';
         }, 3000);
     }
     await closeSettings();

     // Reselect the first request to ensure the view is active.
     await panelFrame!.$$eval('.request-item', els => {
         if (els.length > 0) (els[0] as HTMLElement).click();
    });

     // Wait for detail view and simulate button to mount
     await safeWaitForCondition(() => {
         return !!document.getElementById('simulate-btn');
     }, 3000);

     const simulateBtnExists = await panelFrame!.$eval('#simulate-btn', el => el !== null).catch(() => false);
     expect(simulateBtnExists).toBe(true);

     // Click the button using JS click
     await panelFrame!.$eval('#simulate-btn', el => (el as HTMLElement).click());

     // Assert button state changes to "Simulating..."

     const btnTextDuring = await panelFrame!.$eval('#simulate-btn', el => el.textContent);
     expect(btnTextDuring).toBe('Simulating...');

     // Because we have real API keys now, Tenderly should successfully simulate this request.
     // Wait for the badge.
     await safeWaitForCondition(() => {
         const badge = document.querySelector('.sim-badge.success');
         return badge !== null && badge.textContent === 'Success';
     }, 15000);

     const badgeText = await panelFrame!.$eval('.sim-badge.success', el => el.textContent);
     expect(badgeText).toBe('Success');

     // Note: we don't need to wait for the button to reset, test is done.
  }, 30000);

});
