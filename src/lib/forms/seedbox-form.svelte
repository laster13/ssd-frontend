<script lang="ts">
  import { slide } from 'svelte/transition';
  import { page } from '$app/stores';
  import { getContext } from 'svelte';
  import SuperDebug from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { seedboxSettingsSchema, type SeedboxSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import { Loader2, User, Mail, Lock, Globe, Key, TerminalSquare, ShieldCheck } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import RunScript from '../../routes/run-script.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  // props
  export let data: SuperValidated<Infer<SeedboxSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let label = "";
  export let fieldDescription = "";
  export let name;
  export let scriptName: string = 'infos';

  // states
  let isScriptCompleted = false;
  let isSubmitting = false;
  let showSpinner = false;
  let statusMessage = '';
  let showLogs = false;

  const formDebug: boolean = getContext('formDebug');

  // superform
  const form = superForm(data, {
    validators: zodClient(seedboxSettingsSchema),
    dataType: "json",
  });

  const { form: formData, enhance } = form;

  // quand la sauvegarde réussit
  function onSuccess() {
    toast.success('Configuration sauvegardée ✅');

    if (browser) {
      const scriptEvent = new CustomEvent('startScript', { detail: { scriptName, label } });
      window.dispatchEvent(scriptEvent);
    }
  }

  function updateButtonState(event: CustomEvent) {
    const { isSubmitting: submitting, showSpinner: spinner } = event.detail;
    isSubmitting = submitting;
    showSpinner = spinner;
  }

  function updateStatusMessage(event: CustomEvent) {
    statusMessage = event.detail.statusMessage;
  }

  function handleScriptCompleted() {
    isScriptCompleted = true;
    redirectToNextPage();
  }

  function redirectToNextPage() {
    const currentPath = $page.url.pathname;
    if (isScriptCompleted && currentPath === '/onboarding/3') {
      goto('/onboarding/4');
    }
  }
</script>

<!-- 📦 Carte Ultra Premium Responsive + Large -->
<div class="w-full max-w-lg sm:max-w-3xl lg:max-w-4xl mx-auto">
  <div class="p-[2px] rounded-4xl bg-gradient-to-r from-amber-400/50 via-orange-500/50 to-pink-500/50 shadow-[0_8px_60px_-10px_rgba(251,191,36,0.3)]">
    <form 
      method="POST" 
      action={actionUrl} 
      use:enhance={{
        onResult: ({ result }) => {
          if (result.type === "success") onSuccess();
          if (result.type === "failure") {
            toast.error("Impossible d’enregistrer la configuration ❌");
          }
        }
      }}
      class="flex flex-col gap-8 p-6 sm:p-10 rounded-4xl 
             bg-white/70 dark:bg-gray-900/70 
             backdrop-blur-3xl border border-white/10 shadow-2xl"
    >

      <!-- Header -->
      <div class="text-center space-y-2">
        <h2 class="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 bg-clip-text text-transparent">
          Configuration Seedbox
        </h2>
        <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Gérez et synchronisez vos paramètres SSDv2
        </p>
      </div>

      <!-- 📌 Carte cliquable Logs -->
      <div
        role="button"
        tabindex="0"
        aria-pressed={showLogs}
        class="cursor-pointer select-none p-5 rounded-2xl border border-white/10 shadow-inner 
               bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/70 
               transition-all flex flex-col gap-2"
        on:click={() => (showLogs = !showLogs)}
        on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showLogs = !showLogs)}
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <TerminalSquare class="h-5 w-5 text-amber-500" />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">
              Afficher les logs
            </span>
          </div>
          <!-- Toggle -->
          <button
            type="button"
            aria-pressed={showLogs}
            class={`w-10 h-6 flex items-center rounded-full p-1 transition ${showLogs ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            on:click={(e) => {
              e.stopPropagation();
              showLogs = !showLogs;
            }}
          >
            <div class={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${showLogs ? 'translate-x-4' : ''}`}></div>
          </button>
        </div>
        <p class="text-xs text-gray-500">Logs en temps réel.</p>
      </div>

      {#if !showLogs}
        <!-- Champs ultra premium avec icônes -->
        <div class="relative premium-field" transition:slide>
          <User class="h-5 w-5 text-gray-400" />

          <input 
            id="username"
            type="text"
            name="username"
            bind:value={$formData.username}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="username"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Username
          </label>
        </div>

        <div class="relative premium-field" transition:slide>
          <Mail class="h-5 w-5 text-gray-400" />

          <input 
            id="email"
            type="email"
            name="email"
            bind:value={$formData.email}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="email"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Email
          </label>
        </div>

        <div class="relative premium-field" transition:slide>
          <Globe class="h-5 w-5 text-gray-400" />

          <input 
            id="domain"
            type="text"
            name="domain"
            bind:value={$formData.domain}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="domain"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Domaine
          </label>
        </div>

        <div class="relative premium-field" transition:slide>
          <Lock class="h-5 w-5 text-gray-400" />

          <input 
            id="password"
            type="password"
            name="password"
            bind:value={$formData.password}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="password"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Password
          </label>
        </div>

        <div class="relative premium-field" transition:slide>
          <Mail class="h-5 w-5 text-gray-400" />

          <input 
            id="cloudflare_login"
            type="text"
            name="cloudflare_login"
            bind:value={$formData.cloudflare_login}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="cloudflare_login"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Cloudflare Mail
          </label>
        </div>

        <div class="relative premium-field" transition:slide>
          <Key class="h-5 w-5 text-gray-400" />

          <input 
            id="cloudflare_api_key"
            type="password"
            name="cloudflare_api_key"
            bind:value={$formData.cloudflare_api_key}
            placeholder=" "
            class="peer flex-1 bg-transparent outline-none text-sm 
                   text-gray-800 dark:text-gray-100 placeholder-transparent"
          />

          <label 
            for="cloudflare_api_key"
            class="absolute left-11 text-sm transition-all duration-200
                   text-gray-400
                   peer-placeholder-shown:top-3 peer-placeholder-shown:text-gray-400 peer-placeholder-shown:text-sm
                   -top-6 text-xs 
                   peer-focus:text-amber-500 peer-not-placeholder-shown:text-amber-500"
          >
            Cloudflare API Key
          </label>
        </div>

        <!-- 📌 Carte cliquable OAuth -->
        <div
          role="button"
          tabindex="0"
          aria-pressed={$formData.oauth_enabled}
          class="cursor-pointer select-none p-5 rounded-2xl border border-white/10 shadow-inner 
                 bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-700/70 
                 transition-all flex flex-col gap-2"
          on:click={() => ($formData.oauth_enabled = !$formData.oauth_enabled)}
          on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && ($formData.oauth_enabled = !$formData.oauth_enabled)}
          transition:slide
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ShieldCheck class="h-5 w-5 text-emerald-500" />
              <span class="text-sm font-medium text-gray-700 dark:text-gray-200">OAuth</span>
            </div>
            <!-- Toggle -->
            <button
              type="button"
              aria-pressed={$formData.oauth_enabled}
              class={`w-12 h-6 flex items-center rounded-full p-1 transition ${$formData.oauth_enabled ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              on:click={(e) => {
                e.stopPropagation();
                $formData.oauth_enabled = !$formData.oauth_enabled;
              }}
            >
              <div class={`bg-white w-5 h-5 rounded-full shadow-md transform transition ${$formData.oauth_enabled ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>
          <p class="text-xs text-gray-500">Activez OAuth si vous utilisez une authentification externe.</p>
        </div>

        {#if $formData.oauth_enabled}
          <div class="premium-field" transition:slide>
            <Key class="h-5 w-5 text-gray-400" />
            <input type="text" placeholder="OAuth Client" name="oauth_client" bind:value={$formData.oauth_client} />
          </div>

          <div class="premium-field" transition:slide>
            <Lock class="h-5 w-5 text-gray-400" />
            <input type="password" placeholder="OAuth Secret" name="oauth_secret" bind:value={$formData.oauth_secret} />
          </div>

          <div class="premium-field" transition:slide>
            <Mail class="h-5 w-5 text-gray-400" />
            <input type="text" placeholder="OAuth Mail" name="oauth_mail" bind:value={$formData.oauth_mail} />
          </div>
        {/if}

        <Separator class="mt-4 opacity-50" />

        <div class="form-group">
          <label for={name} class="text-sm font-semibold">{label}</label>
          {#if fieldDescription}
            <p class="text-gray-500 text-xs">{fieldDescription}</p>
          {/if}
        </div>
      {/if}

      <!-- Bouton -->
      <div class="flex w-full justify-between items-center">
        {#if statusMessage}
          <p class="text-orange-500 text-sm blinking-message">{statusMessage}</p>
        {/if}

        <div class="ml-auto">
          <Form.Button 
            disabled={isSubmitting} 
            type="submit" 
            size="sm"
            class="relative inline-flex items-center justify-center px-8 py-3 
                   rounded-xl text-sm font-semibold text-white tracking-wide
                   bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500
                   hover:from-orange-500 hover:via-pink-500 hover:to-rose-600
                   focus:ring-2 focus:ring-offset-2 focus:ring-amber-400
                   transition disabled:opacity-60 overflow-hidden group shadow-lg"
          >
            {#if showSpinner}
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
              <span>Soumission...</span>
            {:else}
              Sauvegarder
              <span class="ml-1" class:hidden={$page.url.pathname === '/settings/seedbox'}>
                et continuer →
              </span>
            {/if}
          </Form.Button>
        </div>
      </div>
    </form>
  </div>
</div>

<!-- RunScript -->
<div class="w-full max-w-lg sm:max-w-3xl lg:max-w-4xl mx-auto mt-6">
  <RunScript 
    {scriptName} 
    {label}
    {showLogs} 
    on:buttonStateChange={updateButtonState} 
    on:statusMessageUpdate={updateStatusMessage}
    on:scriptCompleted={handleScriptCompleted}
  />
</div>

{#if formDebug}
	<SuperDebug data={$formData} />
{/if}

<style lang="postcss">
  /* 🎨 Champs ultra premium */
  .premium-field {
    @apply flex items-center gap-3 px-4 py-3 rounded-2xl 
           bg-white/60 dark:bg-gray-800/60 border border-white/20
           shadow-inner backdrop-blur-md transition-all;
  }

  .premium-field input {
    @apply flex-1 bg-transparent outline-none text-sm 
           text-gray-800 dark:text-gray-100 placeholder-gray-400;
  }
</style>
