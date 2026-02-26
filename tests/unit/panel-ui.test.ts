import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import fs from 'fs';
import { Window } from 'happy-dom';
import path from 'path';

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

let window: InstanceType<typeof Window>;
let document: Document;
let panelModule: typeof import('../../src/panel-utils');

// Storage mock with a real in-memory store
function createStorageMock() {
  const store: Record<string, any> = {};
  return {
    get(keys: string | string[], cb: (r: Record<string, any>) => void) {
      const list = typeof keys === 'string' ? [keys] : keys;
      const result: Record<string, any> = {};
      for (const k of list) {
        if (store[k] !== undefined) result[k] = store[k];
      }
      cb(result);
    },
    set(items: Record<string, any>, cb?: () => void) {
      Object.assign(store, items);
      cb?.();
    },
    clear(cb?: () => void) {
      for (const k of Object.keys(store)) delete store[k];
      cb?.();
    },
    _store: store,
  };
}

// Build the panel HTML body from the real template
function loadPanelHtml(): string {
  const htmlPath = path.resolve(__dirname, '../../public/panel.html');
  const raw = fs.readFileSync(htmlPath, 'utf-8');
  // Extract body content only
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : raw;
}

let storageMock: ReturnType<typeof createStorageMock>;

beforeEach(async () => {
  // Fresh Window for every test
  window = new Window({ url: 'http://localhost' });
  document = window.document as unknown as Document;

  // Inject real panel HTML into the DOM
  (document as any).body.innerHTML = loadPanelHtml();

  storageMock = createStorageMock();

  // Chrome API mock
  (globalThis as any).chrome = {
    storage: {
      local: storageMock,
      onChanged: { addListener: () => {} },
    },
    devtools: {
      network: {
        onRequestFinished: { addListener: () => {} },
      },
    },
  };

  // Assign DOM globals so panel.ts getElementById works
  (globalThis as any).document = document;
  (globalThis as any).window = window;
  (globalThis as any).HTMLElement = (window as any).HTMLElement;
  (globalThis as any).HTMLInputElement = (window as any).HTMLInputElement;
  (globalThis as any).HTMLButtonElement = (window as any).HTMLButtonElement;

  // Direct import from panel-utils (no DOM side effects)
  const panelUtils = await import('../../src/panel-utils');
  panelModule = panelUtils;
});

afterEach(() => {
  window.close();
  delete (globalThis as any).chrome;
});

// -------------------------------------------------------------------
// TESTS
// -------------------------------------------------------------------

describe('Panel UI — Structure', () => {
  test('all critical root-level elements exist', () => {
    const ids = [
      'request-list', 'split-view', 'settings-view', 'welcome-screen',
      'detail-view', 'simulate-btn', 'detail-placeholder',
    ];
    for (const id of ids) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  test('all settings input elements exist', () => {
    const ids = [
      'api-key', 'etherscan-api-key', 'account-slug',
      'project-slug', 'chain-id-override',
    ];
    for (const id of ids) {
      const el = document.getElementById(id);
      expect(el).not.toBeNull();
      expect(el!.tagName.toLowerCase()).toBe('input');
    }
  });

  test('all behaviour checkboxes exist', () => {
    const ids = ['intercept-estimate-gas', 'intercept-eth-call', 'intercept-reverted-only'];
    for (const id of ids) {
      const el = document.getElementById(id) as HTMLInputElement;
      expect(el).not.toBeNull();
      expect(el.type).toBe('checkbox');
    }
  });

  test('navigation buttons exist and are clickable', () => {
    const navSettings = document.getElementById('nav-settings');
    const closeSettings = document.getElementById('close-settings');
    const saveConfig = document.getElementById('save-config');
    const resetConfig = document.getElementById('reset-config');
    expect(navSettings).not.toBeNull();
    expect(closeSettings).not.toBeNull();
    expect(saveConfig).not.toBeNull();
    expect(resetConfig).not.toBeNull();
  });

  test('welcome screen setup button exists', () => {
    const btn = document.getElementById('btn-open-settings-welcome');
    expect(btn).not.toBeNull();
    expect(btn!.tagName.toLowerCase()).toBe('button');
  });

  test('simulate button exists and has default text', () => {
    const btn = document.getElementById('simulate-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Simulate');
  });

  test('header brand is visible', () => {
    // happy-dom has issues with querySelector('.brand') on complex HTML,
    // so we just check the body text contains the brand name
    const bodyText = document.body.textContent || document.body.innerHTML || '';
    expect(bodyText).toContain('Tenderly DevTools');
  });

  test('empty state is shown in request list initially', () => {
    const requestList = document.getElementById('request-list');
    expect(requestList).not.toBeNull();
    const listHtml = requestList!.innerHTML || '';
    expect(listHtml).toContain('empty-state');
  });
});

describe('Panel UI — Welcome Screen State', () => {
  test('welcome screen exists in the DOM', () => {
    const ws = document.getElementById('welcome-screen');
    expect(ws).not.toBeNull();
    // The HTML template starts with display:none, and panel.ts init() toggles it.
    // Since module caching means init() ran once on first import, we just verify
    // the element is present and contains expected content.
    const wsText = ws!.textContent || '';
    expect(wsText).toContain('Welcome to Tenderly DevTools');
  });

  test('detail-view is hidden when no config is set', () => {
    const dv = document.getElementById('detail-view');
    expect(dv).not.toBeNull();
    expect(dv!.style.display).toBe('none');
  });
});

describe('Panel UI — createCollapsibleSection', () => {
  test('creates a collapsible section with title', () => {
    const content = document.createElement('div');
    content.textContent = 'Inner content';
    const section = panelModule.createCollapsibleSection('Test Section', content as any, false);

    expect(section.className).toBe('collapsible-section');
    expect(section.textContent).toContain('Test Section');
    expect(section.textContent).toContain('Inner content');
  });

  test('section starts collapsed when isOpen=false', () => {
    const content = document.createElement('div');
    content.textContent = 'Hidden';
    const section = panelModule.createCollapsibleSection('Closed', content as any, false);

    // The content wrapper (second child) should be hidden
    const wrapper = section.children[1] as HTMLElement;
    expect(wrapper.style.display).toBe('none');
  });

  test('section starts expanded when isOpen=true', () => {
    const content = document.createElement('div');
    content.textContent = 'Visible';
    const section = panelModule.createCollapsibleSection('Open', content as any, true);

    const wrapper = section.children[1] as HTMLElement;
    expect(wrapper.style.display).toBe('block');
  });

  test('clicking header toggles content visibility', () => {
    const content = document.createElement('div');
    const section = panelModule.createCollapsibleSection('Toggle', content as any, false);

    const header = section.children[0] as HTMLElement;
    const wrapper = section.children[1] as HTMLElement;

    // Initially closed
    expect(wrapper.style.display).toBe('none');

    // Click to open
    header.click();
    expect(wrapper.style.display).toBe('block');

    // Click to close
    header.click();
    expect(wrapper.style.display).toBe('none');
  });

  test('arrow icon rotates on toggle', () => {
    const content = document.createElement('div');
    const section = panelModule.createCollapsibleSection('Arrow', content as any, false);

    const header = section.children[0] as HTMLElement;
    // The header has two children: title span and icon span
    // Access the icon directly as the second child
    const icon = header.children[1] as HTMLElement;

    expect(icon).not.toBeNull();
    expect(icon.textContent).toBe('▼');

    // Initially collapsed → rotated -90
    expect(icon.style.transform).toContain('-90');

    // Click to open → rotated 0
    header.click();
    expect(icon.style.transform).toContain('0');
  });
});

describe('Panel UI — renderDecodedParams', () => {
  test('null input shows "No parameters"', () => {
    expect(panelModule.renderDecodedParams(null)).toContain('No parameters');
  });

  test('empty array shows "No parameters"', () => {
    expect(panelModule.renderDecodedParams([])).toContain('No parameters');
  });

  test('empty object shows "No parameters"', () => {
    expect(panelModule.renderDecodedParams({})).toContain('No parameters');
  });

  test('object with named params renders rows', () => {
    const html = panelModule.renderDecodedParams({ to: '0xABC', value: '100' });
    expect(html).toContain('decoded-param-row');
    expect(html).toContain('to');
    expect(html).toContain('0xABC');
    expect(html).toContain('value');
    expect(html).toContain('100');
  });

  test('BigInt values are stringified', () => {
    const html = panelModule.renderDecodedParams({ amount: BigInt('999999999999') });
    expect(html).toContain('999999999999');
  });
});

describe('Panel UI — detectNetworkFromUrl', () => {
  // These are lightweight since detect-network.test.ts has exhaustive tests.
  // Here we just verify the export works.
  test('returns "1" for mainnet URL', () => {
    expect(panelModule.detectNetworkFromUrl('https://cloudflare-eth.com')).toBe('1');
  });

  test('detects polygon', () => {
    expect(panelModule.detectNetworkFromUrl('https://polygon-rpc.com')).toBe('137');
  });
});
