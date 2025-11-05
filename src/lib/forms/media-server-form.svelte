<script lang="ts">
	import { slide } from 'svelte/transition';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import SuperDebug from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
	import * as Form from '$lib/components/ui/form';
	import { mediaServerSettingsSchema, type MediaServerSettingsSchema } from '$lib/forms/helpers';
	import { toast } from 'svelte-sonner';
	import TextField from './components/text-field.svelte';
	import NumberField from './components/number-field.svelte';
	import { Loader2 } from 'lucide-svelte';
	import { Separator } from '$lib/components/ui/separator';
	import { v4 as uuidv4 } from 'uuid';
	import { Button } from '$lib/components/ui/button';
	import CheckboxField from './components/checkbox-field.svelte';
	import GroupCheckboxField from './components/group-checkbox-field.svelte';

	export let data: SuperValidated<Infer<MediaServerSettingsSchema>>;
	export let actionUrl: string = '?/default';

	const formDebug: boolean = getContext('formDebug');

	const form = superForm(data, {
		validators: zodClient(mediaServerSettingsSchema),
		onError(event) {
			toast.error(event.result.error.message);
		}
	});

        const { form: formData, enhance, message, delayed } = form;

        // Active automatiquement les services configurés dans le JSON
        $: {
            if ($formData.plex_token || $formData.plex_login) {
                $formData.plex_enabled = true;
            }
            if ($formData.jellyfin_token) {
                $formData.jellyfin_enabled = true;
            }
            if ($formData.emby_token) {
                $formData.emby_enabled = true;
            }
        }


	$: if ($message && $page.status === 200) {
		toast.success($message);
	} else if ($message) {
		toast.error($message);
	}

	let ongoingAuth: boolean = false;
	let clientIdentifier: string;
	let genClientIdentifier = () => {
		clientIdentifier = uuidv4();
		return clientIdentifier;
	};
	let appName = 'SSD';
	let plexId: string;
	let plexCode: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let pollingInterval: any;

	async function genPlexPin() {
		let data = await fetch('https://plex.tv/api/v2/pins?strong=true', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Plex-Product': appName,
				code: plexCode,
				'X-Plex-Client-Identifier': genClientIdentifier()
			}
		});

		return await data.json();
	}

	async function pollPlexPin() {
		let data = await fetch(`https://plex.tv/api/v2/pins/${plexId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Plex-Product': appName,
				'X-Plex-Client-Identifier': clientIdentifier
			}
		});

		let json = await data.json();
		if ('errors' in json) {
			toast.error(json.errors[0].message);
			ongoingAuth = false;
			clearInterval(pollingInterval);
		}

		if (json.authToken) {
			$formData.plex_token = json.authToken;
			clearInterval(pollingInterval);
			ongoingAuth = false;
		}
	}

	async function startLogin(): Promise<void> {
		ongoingAuth = true;
		try {
			const pin = await genPlexPin();
			if ('errors' in pin) {
				toast.error(pin.errors[0].message);
				ongoingAuth = false;
				return;
			}
			plexId = pin.id;
			plexCode = pin.code;

			window.open(
				`https://app.plex.tv/auth#?clientID=${clientIdentifier}&code=${plexCode}&context%5Bdevice%5D%5Bproduct%5D=${appName}`
			);

			pollingInterval = setInterval(pollPlexPin, 2000);
		} catch (e) {
			toast.error('An error occurred while trying to authenticate with Plex');
			alert(e);
			ongoingAuth = false;
		}
	}
</script>

<form method="POST" action={actionUrl} use:enhance class="my-8 space-y-6">

  <!-- Plex -->
  <div
    class="card stack select-none
           bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
           border border-gray-200 dark:border-gray-700 
           shadow-md hover:shadow-lg transition-shadow
           rounded-2xl p-6 space-y-4 mb-6"
  >
    <!-- Header cliquable -->
    <div
      class="flex items-center justify-between cursor-pointer"
      role="button"
      tabindex="0"
      aria-pressed={$formData.plex_enabled}
      on:click={() => $formData.plex_enabled = !$formData.plex_enabled}
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && ($formData.plex_enabled = !$formData.plex_enabled)}
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-xl 
                    bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          🎬
        </div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Plex</h3>
      </div>

      <!-- Toggle -->
      <button
        type="button"
        class="relative inline-flex items-center"
        on:click={(e) => {
          e.stopPropagation();
          $formData.plex_enabled = !$formData.plex_enabled;
        }}
        aria-pressed={$formData.plex_enabled}
      >
        <span
          class="w-11 h-6 rounded-full transition-colors duration-300
                 { $formData.plex_enabled 
                    ? 'bg-amber-500' 
                    : 'bg-amber-100 dark:bg-amber-900/30'}"
        ></span>
        <span
          class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow
                 transition-transform duration-300 
                 { $formData.plex_enabled ? 'translate-x-5' : '' }"
        ></span>
      </button>
    </div>

    {#if $formData.plex_enabled}
      <div transition:slide|local class="space-y-4">
        <!-- Login -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <label for="plex_login" class="w-40 text-sm font-medium text-gray-700 dark:text-gray-200">
            Login
          </label>
          <input
            id="plex_login"
            name="plex_login"
            type="text"
            bind:value={$formData.plex_login}
            placeholder="Votre identifiant"
            class="flex-1 h-11 px-4 rounded-xl border border-gray-300 bg-white shadow-sm
                   focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                   dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 
                   dark:focus:border-amber-400 dark:focus:ring-amber-500 transition"
          />
        </div>

        <!-- Password -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <label for="plex_password" class="w-40 text-sm font-medium text-gray-700 dark:text-gray-200">
            Password
          </label>
          <input
            id="plex_password"
            name="plex_password"
            type="password"
            bind:value={$formData.plex_password}
            placeholder="••••••••"
            class="flex-1 h-11 px-4 rounded-xl border border-gray-300 bg-white shadow-sm
                   focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                   dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 
                   dark:focus:border-amber-400 dark:focus:ring-amber-500 transition"
          />
        </div>

        <!-- Token -->
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <label for="plex_token" class="w-40 text-sm font-medium text-gray-700 dark:text-gray-200">
            Token
          </label>
          <input type="hidden" id="plex_token" name="plex_token" value={$formData.plex_token} />
          <Button
            type="button"
            disabled={ongoingAuth}
            variant="outline"
            size="sm"
            class="rounded-xl border border-amber-400 text-amber-600 
                   dark:border-amber-500 dark:text-amber-400
                   hover:bg-amber-50 dark:hover:bg-amber-900/30 transition"
            on:click={async () => await startLogin()}
          >
            {#if ongoingAuth}
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {/if}
            {#if $formData.plex_token.length > 0}
              Reauthenticate
              <span class="ml-1">({$formData.plex_token.slice(0, 5)}...)</span>
            {:else}
              Authenticate with Plex
            {/if}
          </Button>
        </div>
      </div>
    {/if}
  </div>


  <!-- Jellyfin -->
  <div
    class="card stack select-none
           bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
           border border-gray-200 dark:border-gray-700 
           shadow-md hover:shadow-lg transition-shadow
           rounded-2xl p-6 space-y-4 mb-6"
  >
    <!-- Header cliquable -->
    <div
      class="flex items-center justify-between cursor-pointer"
      role="button"
      tabindex="0"
      aria-pressed={$formData.jellyfin_enabled}
      on:click={() => $formData.jellyfin_enabled = !$formData.jellyfin_enabled}
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && ($formData.jellyfin_enabled = !$formData.jellyfin_enabled)}
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-xl 
                    bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          🎞️
        </div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Jellyfin</h3>
      </div>

      <!-- Toggle -->
      <button
        type="button"
        class="relative inline-flex items-center"
        on:click={(e) => {
          e.stopPropagation();
          $formData.jellyfin_enabled = !$formData.jellyfin_enabled;
        }}
        aria-pressed={$formData.jellyfin_enabled}
      >
        <span
          class="w-11 h-6 rounded-full transition-colors duration-300
                 { $formData.jellyfin_enabled 
                    ? 'bg-amber-500' 
                    : 'bg-amber-100 dark:bg-amber-900/30'}"
        ></span>
        <span
          class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow
                 transition-transform duration-300 
                 { $formData.jellyfin_enabled ? 'translate-x-5' : '' }"
        ></span>
      </button>
    </div>

    {#if $formData.jellyfin_enabled}
      <div transition:slide|local class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <label for="jellyfin_token" class="w-40 text-sm font-medium text-gray-700 dark:text-gray-200">
            Token
          </label>
          <input
            id="jellyfin_token"
            name="jellyfin_token"
            type="password"
            bind:value={$formData.jellyfin_token}
            placeholder="••••••••"
            class="flex-1 h-11 px-4 rounded-xl border border-gray-300 bg-white shadow-sm
                   focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                   dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 
                   dark:focus:border-amber-400 dark:focus:ring-amber-500 transition"
          />
        </div>
      </div>
    {/if}
  </div>


  <!-- Emby -->
  <div
    class="card stack select-none
           bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800
           border border-gray-200 dark:border-gray-700 
           shadow-md hover:shadow-lg transition-shadow
           rounded-2xl p-6 space-y-4"
  >
    <!-- Header cliquable -->
    <div
      class="flex items-center justify-between cursor-pointer"
      role="button"
      tabindex="0"
      aria-pressed={$formData.emby_enabled}
      on:click={() => $formData.emby_enabled = !$formData.emby_enabled}
      on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && ($formData.emby_enabled = !$formData.emby_enabled)}
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-9 h-9 rounded-xl 
                    bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          📺
        </div>
        <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100">Emby</h3>
      </div>

      <!-- Toggle -->
      <button
        type="button"
        class="relative inline-flex items-center"
        on:click={(e) => {
          e.stopPropagation();
          $formData.emby_enabled = !$formData.emby_enabled;
        }}
        aria-pressed={$formData.emby_enabled}
      >
        <span
          class="w-11 h-6 rounded-full transition-colors duration-300
                 { $formData.emby_enabled 
                    ? 'bg-amber-500' 
                    : 'bg-amber-100 dark:bg-amber-900/30'}"
        ></span>
        <span
          class="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow
                 transition-transform duration-300 
                 { $formData.emby_enabled ? 'translate-x-5' : '' }"
        ></span>
      </button>
    </div>

    {#if $formData.emby_enabled}
      <div transition:slide|local class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-2 max-w-2xl">
          <label for="emby_token" class="w-40 text-sm font-medium text-gray-700 dark:text-gray-200">
            Token
          </label>
          <input
            id="emby_token"
            name="emby_token"
            type="password"
            bind:value={$formData.emby_token}
            placeholder="••••••••"
            class="flex-1 h-11 px-4 rounded-xl border border-gray-300 bg-white shadow-sm
                   focus:border-amber-400 focus:ring-2 focus:ring-amber-300 focus:outline-none
                   dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 
                   dark:focus:border-amber-400 dark:focus:ring-amber-500 transition"
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Submit -->
  <div class="flex w-full justify-end">
    <Form.Button
      disabled={$delayed}
      type="submit"
      size="sm"
      class="w-full lg:max-w-max 
             rounded-xl px-6 py-2 bg-amber-500 text-white font-medium
             hover:bg-amber-600 active:scale-95 transition-all shadow-md"
    >
      {#if $delayed}
        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
      {/if}
      Sauvegarder
      <span class="ml-1" class:hidden={$page.url.pathname === '/settings/mediaserver'}>
        and continue
      </span>
    </Form.Button>
  </div>
</form>

{#if formDebug}
  <SuperDebug data={$formData} />
{/if}
