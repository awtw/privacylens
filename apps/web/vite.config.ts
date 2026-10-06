import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Emits precache.json listing every hashed build asset so the PWA can cache them all for offline use. */
function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    generateBundle(_, bundle) {
      const urls = Object.keys(bundle).map((f) => `assets/${f.replace(/^assets\//, '')}`);
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(urls) });
    },
  };
}

export default defineConfig({ plugins: [react(), precacheManifest()] });
