import type { LayoutLoad } from './$types';
import { auth } from '$lib/api';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const load: LayoutLoad = async ({ url, fetch }) => {
  if (!browser) {
    return { user: null };
  }

  const res = await fetch('/api/v1/settings/get/all');

  if (!res.ok) {
    console.error('❌ Impossible de récupérer les settings :', res.status);
    return { user: null, settings: null, authEnabled: true };
  }

  const appSettings = await res.json();

  if (appSettings.firstRun) {
    if (!url.pathname.startsWith('/onboarding')) {
      throw redirect(302, '/onboarding');
    }

    return {
      user: null,
      settings: appSettings,
      authEnabled: true
    };
  }

  let authEnabled = true;

  try {
    const authStatusRes = await fetch('/api/v1/auth/status');

    if (authStatusRes.ok) {
      const authStatus = await authStatusRes.json();
      authEnabled = authStatus.enabled;
    }
  } catch (error) {
    console.warn('⚠️ Impossible de lire /api/v1/auth/status :', error);
  }

  if (!authEnabled) {
    if (url.pathname.startsWith('/login')) {
      throw redirect(302, '/');
    }

    return {
      user: { username: 'guest', auth_disabled: true },
      settings: appSettings,
      authEnabled: false
    };
  }

  try {
    const user = await auth.getMe();

    if (url.pathname.startsWith('/login')) {
      throw redirect(302, '/');
    }

    return {
      user,
      settings: appSettings,
      authEnabled: true
    };
  } catch {
    if (
      !url.pathname.startsWith('/login') &&
      !url.pathname.startsWith('/register')
    ) {
      throw redirect(302, '/login');
    }

    return {
      user: null,
      settings: appSettings,
      authEnabled: true
    };
  }
};