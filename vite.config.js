import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

const apiPort = process.env.PORT || 3001;

/**
 * Version affichée en pied de page : le commit compilé (fourni par Cloudflare lors du build,
 * sinon lu dans git) et la date du build. Permet de vérifier d'un coup d'œil ce qui est en ligne.
 */
function buildVersion() {
  let sha = process.env.WORKERS_CI_COMMIT_SHA || '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = '';
    }
  }
  return { commit: sha.slice(0, 7) || 'local', builtAt: new Date().toISOString() };
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
  server: {
    port: 5173,
    // En développement, Vite redirige /api vers le serveur Express (évite CORS)
    proxy: {
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
