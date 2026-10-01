import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Lit public/_headers pour que `npm run preview` serve exactement
// les memes en-tetes de securite que la production (CSP comprise).
function productionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  let inGlobalBlock = false;
  for (const line of readFileSync('public/_headers', 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      inGlobalBlock = line.trim() === '/*';
      continue;
    }
    if (!inGlobalBlock) continue;
    const i = line.indexOf(':');
    headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  // En local on sert en HTTP : ces deux en-tetes n'ont pas de sens ici.
  delete headers['Strict-Transport-Security'];
  headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
  return headers;
}

export default defineConfig({
  build: {
    target: 'es2022',
    // Aucun asset converti en data: URI, tout reste un fichier servi par 'self'.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
  preview: {
    headers: productionHeaders(),
  },
});
