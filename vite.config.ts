// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import path from 'path';

function generateFrontendConfig(mode: string) {
  return {
    name: 'generate-frontend-config',
    buildStart() {
      try {
        // Charger les variables .env (par ex: VITE_BACKEND_URL_HTTPS)
        const env = loadEnv(mode, process.cwd(), '');
        const backendUrl = env.VITE_BACKEND_URL_HTTPS || 'http://localhost:8080';

        // Lecture du settings.json (uniquement pour récupérer l'api_key)
        const settingsPath = path.resolve(__dirname, '../ssd-backend/data/settings.json');
        let apiKey = '';
        if (fs.existsSync(settingsPath)) {
          const raw = fs.readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(raw);
          apiKey = settings.api_key || '';
        }

        // Créer le dossier config si besoin
        const outputDir = path.resolve(__dirname, 'config');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir);
        }

        // Générer le servers.json
        const config = {
          backendUrl,   // 🔥 vient de ton .env
          apiKey,       // récupéré depuis settings.json backend
        };

        fs.writeFileSync(
          path.join(outputDir, 'servers.json'),
          JSON.stringify(config, null, 2)
        );

        console.log('✅ config/servers.json généré avec succès !', config);
      } catch (err) {
        console.error('❌ Impossible de générer config/servers.json:', err);
      }
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    sveltekit({
      onwarn: (warning, handler) => {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        handler(warning);
      }
    }),
    generateFrontendConfig(mode) // 👈 on passe mode pour lire le .env
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    SUPERFORMS_LEGACY: true
  }
}));
