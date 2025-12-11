import { cp } from 'fs/promises';

await Bun.build({
  entrypoints: ['./src/panel.ts', './src/devtools.ts'],
  outdir: './dist',
  target: 'browser',
});

// Copy public assets to dist
await cp('./public', './dist', { recursive: true });

console.log('Build complete!');
