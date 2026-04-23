<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { NavItem } from '$lib/types';
  import {
    LogOut,
    User,
    Database,
    Tv,
    Grid,
    Link as LinkIcon,
    Save,
    Home,
    PanelBottom,
    Menu,
    X,
    Activity,
    RefreshCw
  } from 'lucide-svelte';
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte';
  import * as Dropdown from '$lib/components/ui/dropdown-menu';
  import { page } from '$app/stores';
  import { auth } from '$lib/api';

  const navItems: NavItem[] = [
    { name: 'Accueil', path: '/' },
    { name: 'Sauvegardes', path: '/settings/sauvegarde' },
    { name: 'Symlinks', path: '/settings/symlinks' },
    { name: 'Rapport Activité', path: '/settings/activity' },
    { name: 'Seasonarr', path: '/season/dashboard' },
    { name: 'Paramètres', path: '/settings' },
    { name: 'Mises à Jour', path: '/settings/update' }
  ];

  const settingsItems = [
    { name: 'Import', desc: 'Connectez vos anciennes configs', path: '/settings/test', icon: Database },
    { name: 'Perso', desc: 'Gérez votre seedbox', path: '/settings/seedbox', icon: User },
    { name: 'Medias', desc: 'Plex, Jellyfin, Emby…', path: '/settings/mediaserver', icon: Tv },
    { name: 'Apps', desc: 'Vos applications', path: '/settings/applications', icon: Grid },
    { name: 'Symlinks', desc: 'Simplifiez vos liens', path: '/settings/symlinks', icon: LinkIcon },
    { name: 'Backup', desc: 'Protégez vos données', path: '/settings/sauvegarde', icon: Save },
    { name: 'Update', desc: 'Gardez SSDv2 à jour', path: '/settings/update', icon: RefreshCw }
  ];

  const mobileMainItems = [
    { name: 'Accueil', path: '/', icon: Home },
    { name: 'Seasonarr', path: '/season/dashboard', icon: PanelBottom },
    { name: 'Paramètres', path: '/settings', icon: User },
    { name: 'Plus', path: '#', icon: Menu }
  ];

  const mobileMoreItems = [
    { name: 'Sauvegardes', path: '/settings/sauvegarde', icon: Save },
    { name: 'Symlinks', path: '/settings/symlinks', icon: LinkIcon },
    { name: 'Activité', path: '/settings/activity', icon: Activity },
    { name: 'Import', path: '/settings/test', icon: Database },
    { name: 'Perso', path: '/settings/seedbox', icon: User },
    { name: 'Medias', path: '/settings/mediaserver', icon: Tv },
    { name: 'Apps', path: '/settings/applications', icon: Grid },
    { name: 'Mises à jour', path: '/settings/update', icon: RefreshCw }
  ];

  let showMenu: Writable<boolean> = getContext('showMenu');
  let lastScrollY = 0;
  let authEnabled = true;
  let authLoading = false;
  let mobileMoreOpen = false;

  function onScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    if (window.scrollY > lastScrollY && window.scrollY > 60) {
      header.classList.add('-translate-y-full', 'opacity-0');
    } else {
      header.classList.remove('-translate-y-full', 'opacity-0');
    }

    lastScrollY = window.scrollY;
  }

  async function logout() {
    try {
      const res = await fetch('/api/v1/logout', {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        console.error('Erreur logout :', await res.text());
      }
    } catch (err) {
      console.error('Erreur réseau :', err);
    } finally {
      mobileMoreOpen = false;
      goto('/login');
    }
  }

  async function toggleAuth() {
    if (authLoading) return;

    authLoading = true;
    const nextValue = !authEnabled;

    try {
      const result = await auth.setAuthStatus(nextValue);
      authEnabled = result.enabled;

      if (!authEnabled && $page.url.pathname === '/login') {
        goto('/');
      }
    } catch (e) {
      console.error("Impossible de modifier l'état de l'auth :", e);
    } finally {
      authLoading = false;
    }
  }

  function handleMobileNavClick(item: { name: string; path: string }) {
    if (item.name === 'Plus') {
      mobileMoreOpen = true;
      return;
    }

    mobileMoreOpen = false;
    goto(item.path);
  }

  function closeMobileMore() {
    mobileMoreOpen = false;
  }

  onMount(async () => {
    if (!browser) return;

    window.addEventListener('scroll', onScroll);

    try {
      const status = await auth.getAuthStatus();
      authEnabled = status.enabled;
    } catch (e) {
      console.error("Impossible de récupérer l'état de l'auth :", e);
    }
  });

  onDestroy(() => {
    if (browser) window.removeEventListener('scroll', onScroll);
  });
</script>

<header
  id="header"
  class="fixed top-0 z-[99] flex w-full items-center justify-between
         px-6 md:px-24 lg:px-32 py-4 md:py-6
         bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-sm
         transform transition-all duration-500 ease-in-out"
>
  <button
    class="flex items-center gap-3 group focus:outline-none"
    on:click={() => (window.location.href = `/`)}
  >
    <div class="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-rose-500 to-amber-400 shadow group-hover:scale-105 transition">
      <svg viewBox="0 0 24 24" class="h-5 w-5 text-white">
        <path fill="currentColor" d="M12 2s5 3.5 5 8.5S15 20 12 22c-3-2-5-5-5-9.5S12 2 12 2z" />
      </svg>
    </div>
    <div
      class="text-xl md:text-2xl font-extrabold tracking-wide 
             bg-gradient-to-r from-red-500 via-orange-400 to-green-400 
             bg-clip-text text-transparent"
    >
      SSDv2
    </div>
  </button>

  <nav class="hidden md:flex items-center gap-8 tracking-wide">
    {#each navItems as navItem}
      {#if navItem.name === 'Paramètres'}
        <Dropdown.Root>
          <Dropdown.Trigger>
            <span
              class="cursor-pointer text-sm font-medium uppercase tracking-widest 
                     text-gray-800 dark:text-gray-300 hover:text-black dark:hover:text-white transition"
            >
              Paramètres
            </span>
          </Dropdown.Trigger>

          <Dropdown.Content
            class="mt-4 w-[600px] p-6 rounded-2xl bg-white/90 dark:bg-gray-900/90 
                   backdrop-blur-xl shadow-2xl border border-gray-200 dark:border-gray-700
                   grid grid-cols-2 gap-4 animate-in fade-in zoom-in"
          >
            {#each settingsItems as item}
              <Dropdown.Item asChild>
                <a
                  href={item.path}
                  class="flex flex-col gap-1 rounded-lg p-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 
                         transition shadow-sm hover:shadow-md"
                >
                  <div class="flex items-center gap-2">
                    <svelte:component this={item.icon} class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span class="font-medium text-sm text-gray-800 dark:text-gray-200">{item.name}</span>
                  </div>
                  <span class="text-xs text-gray-600 dark:text-gray-400">{item.desc}</span>
                </a>
              </Dropdown.Item>
            {/each}

            <div
              class="col-span-2 mt-2 flex items-center justify-between rounded-lg p-3
                     bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700"
            >
              <div class="flex flex-col">
                <span class="font-medium text-sm text-gray-800 dark:text-gray-200">
                  Page de connexion
                </span>
                <span class="text-xs text-gray-600 dark:text-gray-400">
                  {authEnabled ? 'Activée' : 'Désactivée'}
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={authEnabled}
                aria-label="Activer ou désactiver la page de connexion"
                on:click={toggleAuth}
                disabled={authLoading}
                class={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
                  authEnabled
                    ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                    : 'bg-gray-300 dark:bg-gray-700'
                } ${authLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  class={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                    authEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {#if authEnabled}
              <Dropdown.Item>
                <button
                  on:click={logout}
                  class="col-span-2 mt-2 flex items-center gap-2 rounded-lg p-3 
                         text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition w-full text-left"
                >
                  <LogOut class="h-4 w-4" />
                  <span class="font-medium text-sm">Déconnexion</span>
                </button>
              </Dropdown.Item>
            {/if}
          </Dropdown.Content>
        </Dropdown.Root>
      {:else}
        <a
          href={navItem.path}
          class="relative text-sm font-medium uppercase tracking-widest group
                 transition duration-300
                 { $page.url.pathname === navItem.path
                   ? 'font-semibold bg-gradient-to-r from-red-500 via-orange-400 to-green-500 bg-clip-text text-transparent'
                   : 'text-gray-800 dark:text-gray-300 hover:text-black dark:hover:text-white' }"
        >
          {navItem.name}
          <span
            class="absolute bottom-[-6px] left-0 h-[2px] w-0 rounded-full
                   bg-gradient-to-r from-red-500 via-orange-400 to-green-500
                   transition-all duration-300 group-hover:w-full"
          ></span>
        </a>
      {/if}
    {/each}
    <ThemeSwitcher />
  </nav>

  <div class="flex md:hidden items-center gap-4">
    <ThemeSwitcher />
  </div>
</header>

{#if mobileMoreOpen}
  <button
    class="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px] md:hidden"
    aria-label="Fermer le panneau mobile"
    on:click={closeMobileMore}
  ></button>

  <div
    class="fixed inset-x-0 bottom-0 z-[130] md:hidden rounded-t-3xl
           bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl
           border-t border-gray-200 dark:border-gray-700
           shadow-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
  >
    <div class="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300 dark:bg-gray-700"></div>

    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Plus d’options</h3>
        <p class="text-xs text-gray-600 dark:text-gray-400">Accès rapide aux réglages et actions</p>
      </div>

      <button
        class="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        on:click={closeMobileMore}
      >
        <X class="h-5 w-5" />
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3">
      {#each mobileMoreItems as item}
        <button
          on:click={() => {
            mobileMoreOpen = false;
            goto(item.path);
          }}
          class="flex flex-col items-start gap-2 rounded-2xl border border-gray-200 dark:border-gray-700
                 bg-white dark:bg-gray-800/70 p-4 text-left shadow-sm
                 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
        >
          <svelte:component this={item.icon} class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span class="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
        </button>
      {/each}
    </div>

    <div class="mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col">
          <span class="text-sm font-medium text-gray-800 dark:text-gray-200">Page de connexion</span>
          <span class="text-xs text-gray-600 dark:text-gray-400">
            {authEnabled ? 'Activée' : 'Désactivée'}
          </span>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={authEnabled}
          aria-label="Activer ou désactiver la page de connexion"
          on:click={toggleAuth}
          disabled={authLoading}
          class={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 ${
            authEnabled
              ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
              : 'bg-gray-300 dark:bg-gray-700'
          } ${authLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            class={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
              authEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>

    {#if authEnabled}
      <button
        on:click={logout}
        class="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl p-4
               text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20
               hover:bg-red-100 dark:hover:bg-red-900/30 transition"
      >
        <LogOut class="h-5 w-5" />
        <span class="font-medium">Déconnexion</span>
      </button>
    {/if}
  </div>
{/if}

<nav
  class="fixed bottom-0 left-0 right-0 z-[99] flex justify-around items-center
         bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700
         py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
>
  {#each mobileMainItems as item}
    <button
      on:click={() => handleMobileNavClick(item)}
      class={`flex min-w-[72px] flex-col items-center justify-center gap-1 px-2 text-xs transition ${
        item.name !== 'Plus' && $page.url.pathname === item.path
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400'
      }`}
    >
      <svelte:component this={item.icon} class="w-5 h-5" />
      {item.name}
    </button>
  {/each}
</nav>