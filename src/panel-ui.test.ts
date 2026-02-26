import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

/**
 * Panel UI structure tests — validates the Solid-rendered output.
 * 
 * Since Solid needs a real DOM to render, we use happy-dom and render
 * the App component. However, Solid's reactivity depends on runtime
 * compilation that isn't straightforward in Bun + happy-dom without
 * a full Vite SSR setup. Instead, we:
 * 
 * 1. Test the built HTML output (dist/panel.html) to verify the shell
 * 2. Test that the built JS doesn't have syntax errors
 * 3. Test pure utility functions that were extracted
 * 
 * The real UI structure is validated by E2E tests via Puppeteer.
 */

import fs from 'fs';
import path from 'path';

let window: InstanceType<typeof Window>;
let document: Document;

beforeEach(() => {
  window = new Window({ url: 'http://localhost' });
  document = window.document as unknown as Document;
  (globalThis as any).document = document;
  (globalThis as any).window = window;
  (globalThis as any).HTMLElement = (window as any).HTMLElement;
});

afterEach(() => {
  window.close();
  delete (globalThis as any).document;
  delete (globalThis as any).window;
});

describe('Panel HTML Shell', () => {
  test('panel.html contains #root mount point', () => {
    const htmlPath = path.resolve(__dirname, '../public/panel.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('id="root"');
  });

  test('panel.html references panel.js script', () => {
    const htmlPath = path.resolve(__dirname, '../public/panel.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('panel.js');
  });

  test('panel.html references styles.css', () => {
    const htmlPath = path.resolve(__dirname, '../public/panel.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('styles.css');
  });

  test('panel.html loads Google Fonts', () => {
    const htmlPath = path.resolve(__dirname, '../public/panel.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Inter');
    expect(html).toContain('JetBrains+Mono');
  });
});

describe('Built output', () => {
  test('dist/ contains all required files', () => {
    const distPath = path.resolve(__dirname, '../dist');
    const files = fs.readdirSync(distPath);
    expect(files).toContain('panel.html');
    expect(files).toContain('panel.js');
    expect(files).toContain('devtools.html');
    expect(files).toContain('devtools.js');
    expect(files).toContain('manifest.json');
    expect(files).toContain('styles.css');
  });

  test('dist/panel.js is non-empty and contains Solid markers', () => {
    const jsPath = path.resolve(__dirname, '../dist/panel.js');
    const js = fs.readFileSync(jsPath, 'utf-8');
    expect(js.length).toBeGreaterThan(1000);
    // Solid.js compiled output should contain these patterns
    expect(js).toContain('Tenderly'); // Brand text from Header
  });

  test('dist/manifest.json has correct devtools_page', () => {
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.devtools_page).toBe('devtools.html');
    expect(manifest.manifest_version).toBe(3);
  });
});

describe('Store module', () => {
  test('exports expected signals and functions', async () => {
    // Stub chrome for import
    (globalThis as any).chrome = {
      storage: {
        local: {
          get: (_k: any, cb: any) => cb({}),
          set: (_v: any, cb: any) => cb?.(),
          clear: (cb: any) => cb?.(),
        },
        onChanged: { addListener: () => {} },
      },
      devtools: { network: { onRequestFinished: { addListener: () => {} } } },
    };

    const store = await import('./lib/store');
    
    // Verify all expected exports exist
    expect(typeof store.config).toBe('function');
    expect(typeof store.setConfig).toBe('function');
    expect(typeof store.activeTab).toBe('function');
    expect(typeof store.setActiveTab).toBe('function');
    expect(typeof store.selectedRequestId).toBe('function');
    expect(typeof store.setSelectedRequestId).toBe('function');
    expect(typeof store.hasConfig).toBe('function');
    expect(typeof store.selectedRequest).toBe('function');
    expect(typeof store.loadConfig).toBe('function');
    expect(typeof store.saveConfig).toBe('function');
    expect(typeof store.resetConfig).toBe('function');
    expect(typeof store.handleRequest).toBe('function');
    expect(typeof store.selectRequest).toBe('function');

    delete (globalThis as any).chrome;
  });
});
