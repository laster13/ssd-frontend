<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { NavItem } from '$lib/types';
	import { Mountain, MoreHorizontal } from 'lucide-svelte';
	import ThemeSwitcher from '$lib/components/theme-switcher.svelte';
	import NavigationItem from '$lib/components/header-item.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Drawer from '$lib/components/ui/drawer';

	const navItems: NavItem[] = [
		{ name: 'Accueil', path: '/' },
		{ name: 'Parametres', path: '/settings' }
	];

	let showMenu: Writable<boolean> = getContext('showMenu');

	let applyBackdropBlur = () => {};

	onMount(() => {
		const header = document.getElementById('header');
		applyBackdropBlur = () => {
			if (window.scrollY > 0) {
				header?.classList.remove('p-8');
				header?.classList.add('p-4', 'backdrop-blur-sm');
			} else {
				header?.classList.remove('p-4', 'backdrop-blur-sm');
				header?.classList.add('p-8');
			}
		};
		applyBackdropBlur();
		if (browser) {
			window.addEventListener('scroll', applyBackdropBlur);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('scroll', applyBackdropBlur);
		}
	});
</script>

<!-- HEADER -->
<header
	id="header"
	class="fixed top-0 z-[99] w-full flex items-center justify-between bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white p-8 shadow-sm transition-all duration-300 ease-in-out md:px-24 lg:px-32"
>
	<!-- Logo -->
	<div class="flex items-center gap-2">
		<a href="/" class="flex items-center gap-2">
			<Mountain class="size-6 md:size-8 text-indigo-600 dark:text-indigo-400" />
			<h1 class="text-xl font-semibold md:text-2xl">SSDv2</h1>
		</a>
	</div>

	<!-- Desktop nav -->
	<nav class="hidden md:flex items-center gap-6">
		<div class="flex items-center gap-3">
			{#each navItems as navItem}
				<NavigationItem {navItem} />
			{/each}
		</div>
		<ThemeSwitcher />
	</nav>

	<!-- Mobile nav -->
	<nav class="flex md:hidden items-center gap-2">
		<ThemeSwitcher />
		<Drawer.Root onClose={() => showMenu.set(false)} open={$showMenu}>
			<Drawer.Trigger>
				<Button type="button" size="sm" class="max-w-max">
					<MoreHorizontal class="h-4 w-4" />
				</Button>
			</Drawer.Trigger>
			<Drawer.Content>
				<nav class="my-4 flex w-full flex-col items-center justify-center gap-2">
					{#each navItems as navItem}
						<Drawer.Close asChild let:builder>
							<Button
								on:click={() => goto(navItem.path)}
								builders={[builder]}
								size="sm"
								variant="ghost"
							>
								{navItem.name}
							</Button>
						</Drawer.Close>
					{/each}
				</nav>
			</Drawer.Content>
		</Drawer.Root>
	</nav>
</header>

<style>
	:global(.backdrop) {
		backdrop-filter: blur(4px);
		background-color: rgba(0, 0, 0, 0.5);
	}
</style>
