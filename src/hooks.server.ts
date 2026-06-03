// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
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

	event.locals.backendUrl = config.backendUrl;
	event.locals.apiKey = config.apiKey;

	client.setConfig({
		baseUrl: config.backendUrl,
		headers: { 'x-api-key': config.apiKey }
	});

	try {
		const res = await fetch(`${config.backendUrl}/api/v1/settings/get/all`, {
			headers: { 'x-api-key': config.apiKey }
		});

		if (res.ok) {
			const settings = await res.json();

			const isOnboardingPage = event.url.pathname.startsWith('/onboarding');
			const isOnboardingAction = event.url.searchParams.get('onboarding') === 'true';

			if (settings.firstRun && !isOnboardingPage && !isOnboardingAction) {
				throw redirect(307, '/onboarding');
			}
		}
	} catch (err) {
		if (isRedirect(err)) {
			throw err;
		}

		console.error("❌ Impossible de récupérer firstRun :", err);
	}

	return resolve(event);
};