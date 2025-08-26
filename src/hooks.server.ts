// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { client } from '$lib/client/services.gen';
import { promises as fs } from 'fs';
import path from 'path';

// Lecture de servers.json
async function getFrontendConfig() {
  const configPath = path.resolve('config/servers.json');
  const raw = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(raw);
}

export const handle: Handle = async ({ event, resolve }) => {
  const config = await getFrontendConfig();

  client.setConfig({
    baseUrl: config.backendUrl,
    headers: { 'x-api-key': config.apiKey }
  });

  // 🚀 Vérification côté backend
  try {
    const res = await fetch(`${config.backendUrl}/api/v1/settings/get/all`, {
      headers: { 'x-api-key': config.apiKey }
    });

    if (res.ok) {
      const settings = await res.json();

      // Si firstRun = true → on force l’onboarding AVANT toute auth
      if (settings.firstRun && !event.url.pathname.startsWith('/onboarding')) {
        throw redirect(307, '/onboarding');
      }
    }
  } catch (err) {
    console.error("❌ Impossible de récupérer firstRun :", err);
  }

  return resolve(event);
};
