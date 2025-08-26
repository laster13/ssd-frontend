<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type { NavItem } from '$lib/types';
  import { LogOut, User, Database, Tv, Grid, Link as LinkIcon, Save } from 'lucide-svelte';
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte';
  import * as Dropdown from '$lib/components/ui/dropdown-menu';
  import { page } from '$app/stores';

  const navItems: NavItem[] = [
    { name: 'Accueil', path: '/' },
    { name: 'Sauvegardes', path: '/settings/sauvegarde' },
    { name: 'Symlinks', path: '/settings/symlinks' },
    { name: 'Paramètres', path: '/settings' }
  ];

  const settingsItems = [
    { name: 'Import', desc: 'Connectez vos anciennes configs', path: '/settings/test', icon: Database },
    { name: 'Perso', desc: 'Gérez votre seedbox', path: '/settings/seedbox', icon: User },
    { name: 'Medias', desc: 'Plex, Jellyfin, Emby…', path: '/settings/mediaserver', icon: Tv },
    { name: 'Apps', desc: 'Vos applications', path: '/settings/applications', icon: Grid },
    { name: 'Symlinks', desc: 'Simplifiez vos liens', path: '/settings/symlinks', icon: LinkIcon },
    { name: 'Backup', desc: 'Protégez vos données', path: '/settings/sauvegarde', icon: Save }
  ];

  let showMenu: Writable<boolean> = getContext('showMenu');
  let lastScrollY = 0;

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
      const res = await fetch("/api/v1/logout", {
        method: "POST",
        credentials: "include" // 👈 pour inclure le cookie
      });

      if (res.ok) {
        console.log("Déconnecté !");
      } else {
        console.error("Erreur logout :", await res.text());
      }
    } catch (err) {
      console.error("Erreur réseau :", err);
    } finally {
      goto("/login");
    }
  }

  onMount(() => {
    if (!browser) return;
    window.addEventListener('scroll', onScroll);
  });

  onDestroy(() => {
    if (browser) window.removeEventListener('scroll', onScroll);
  });
</script>

<!-- HEADER (unique pour desktop et mobile) -->
<header
  id="header"
  class="fixed top-0 z-[99] flex w-full items-center justify-between
         px-6 md:px-24 lg:px-32 py-4 md:py-6
         bg-white/70 dark:bg-gray-900/70 backdrop-blur-md shadow-sm
         transform transition-all duration-500 ease-in-out"
>
  <!-- Logo -->
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

  <!-- Desktop nav -->
  <nav class="hidden md:flex items-center gap-8 tracking-wide">
    {#each navItems as navItem}
      {#if navItem.name === 'Paramètres'}
        <!-- Dropdown mega-menu -->
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

            <!-- Items -->
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

            <!-- Déconnexion -->
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

  <!-- Mobile nav (uniquement logo + ThemeSwitcher) -->
  <div class="flex md:hidden items-center gap-4">
    <ThemeSwitcher />
  </div>
</header>

<!-- 📱 BOTTOM NAV MOBILE -->
<nav
  class="fixed bottom-0 left-0 right-0 z-[99] flex justify-around items-center 
         bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-t border-gray-200 dark:border-gray-700
         py-2 md:hidden"
>
  {#each settingsItems as item}
    <button
      on:click={() => goto(item.path)}
      class="flex flex-col items-center justify-center gap-1 px-2 text-xs 
             text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400"
    >
      <svelte:component this={item.icon} class="w-5 h-5" />
      {item.name}
    </button>
  {/each}

  <!-- Déconnexion -->
  <button
    on:click={logout}
    class="flex flex-col items-center justify-center gap-1 px-2 text-xs 
           text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
  >
    <LogOut class="w-5 h-5" />
    Déco
  </button>
</nav>
