// src/routes/+layout.ts
import type { LayoutLoad } from './$types';
import { auth } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL_HTTPS;

export const load: LayoutLoad = async ({ url, fetch }) => {
  if (!browser) return { user: null };

  // 🔹 Appel direct à /api/v1/settings/get/all
  const res = await fetch(`${BACKEND_URL}/api/v1/settings/get/all`);
  if (!res.ok) {
    console.error("❌ Impossible de récupérer les settings :", res.status);
    return { user: null, settings: null };
  }

  const appSettings = await res.json();

  // 🚀 Si firstRun = true → forcer l’onboarding
  if (appSettings.firstRun) {
    if (!url.pathname.startsWith('/onboarding')) {
      throw redirect(302, '/onboarding');
    }
    return { user: null, settings: appSettings };
  }

  // 🔹 Sinon → logique normale auth
  try {
    const user = await auth.getMe();

    if (url.pathname.startsWith('/login')) {
      throw redirect(302, '/');
    }

    return { user, settings: appSettings };
  } catch {
    if (
      !url.pathname.startsWith('/login') &&
      !url.pathname.startsWith('/register')
    ) {
      throw redirect(302, '/login');
    }

    return { user: null, settings: appSettings };
  }
};
