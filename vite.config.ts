import { cpSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solidPlugin(),
    {
      name: 'copy-public-assets',
      closeBundle() {
        // Copy static assets that the extension needs
        cpSync('public/manifest.json', 'dist/manifest.json');
        cpSync('public/devtools.html', 'dist/devtools.html');
        cpSync('public/panel.html', 'dist/panel.html');
        cpSync('public/styles.css', 'dist/styles.css');
        // devtools.ts is a tiny Chrome API script with no imports — copy as-is
        cpSync('src/devtools.ts', 'dist/devtools.js');
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: false, // easier to debug in DevTools
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/index.tsx'),
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'src'),
    },
  },
});
