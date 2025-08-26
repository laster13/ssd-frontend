<script lang="ts">
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { sonarr } from '$lib/api/sonarr';
  import { Separator } from '$lib/components/ui/separator';
  import { getContext } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { Progress } from '$lib/components/ui/progress';
  import { goto } from '$app/navigation';

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL_HTTPS;

  const formProgress = getContext<Writable<number>>('formProgress');
  formProgress.set(3);

  let name = '';
  let url = '';
  let api_key = '';
  let loading = false;
  let error = '';
  let testingConnection = false;
  let testResult: { success: boolean; message: string } | null = null;
  let clearTimer: any = null;

  function sanitizeUrl(inputUrl: string) {
    if (import.meta.env.PROD) {
      return inputUrl.replace(/^http:\/\//, 'https://');
    }
    return inputUrl;
  }

  function resetForm() {
    name = '';
    url = '';
    api_key = '';
    error = '';
    testResult = null;
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
  }

  function autoClearTestResult() {
    if (!browser) return;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      testResult = null;
      clearTimer = null;
    }, 5000);
  }

  // 🔹 Bouton "Tester la connexion"
  async function handleTestConnection() {
    if (!url.trim() || !api_key.trim()) {
      error = 'URL et clé API requises pour le test';
      return;
    }
    error = '';
    testResult = null;
    testingConnection = true;

    try {
      const resp = await sonarr.testConnection({
        name: name?.trim() || 'Test Instance',
        url: sanitizeUrl(url.trim()),
        api_key: api_key.trim()
      });

      if (resp?.data?.success) {
        testResult = { success: true, message: 'Connexion réussie !' };
      } else {
        testResult = { success: false, message: 'Échec de la connexion' };
      }

    } catch (e) {
      console.error('Erreur test connexion:', e);
      testResult = { success: false, message: 'Erreur lors du test de connexion' };
    } finally {
      testingConnection = false;
      autoClearTestResult();
    }
  }

  // 🔹 Bouton "Ajouter l’instance" (soumission form)
  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await sonarr.createInstance({
        name: name.trim(),
        url: sanitizeUrl(url.trim()),
        api_key: api_key.trim()
      });

      // marque onboarding terminé
      await fetch(`${BACKEND_URL}/api/v1/settings/complete-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      resetForm();

      // 🚀 Redirection accueil
      goto('/');
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Impossible d’ajouter Sonarr';
      error = detail;
    } finally {
      loading = false;
    }
  }

  onDestroy(() => {
    if (clearTimer) clearTimeout(clearTimer);
  });
</script>

<div class="flex h-full w-full flex-col items-center overflow-x-hidden p-8 py-32 md:px-24 lg:px-32">
  <!-- En-tête -->
  <div class="flex w-full max-w-3xl flex-col items-start">
    <Progress class="mb-2 w-full" max={4} value={$formProgress} />

    <!-- ✅ on garde ton style dégradé existant -->
    <h1 class="mb-2 text-2xl font-bold md:text-3xl lg:text-4xl 
               bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500 
               bg-clip-text text-transparent">
      Étape 4/4
    </h1>

    <p class="text-base md:text-lg text-gray-600 dark:text-gray-300">
      Ajoutez une instance <span class="font-semibold">Sonarr</span> en renseignant l’URL et la clé API.
    </p>
  </div>

  <!-- Formulaire dans une card -->
  <div class="mt-6 w-full max-w-3xl">
    <div class="rounded-2xl bg-white dark:bg-gray-900 shadow-lg p-8 border border-gray-200 dark:border-gray-700">
      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <!-- Nom -->
        <div class="flex flex-col gap-2">
          <label for="sonarr-name" class="text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
          <input
            id="sonarr-name"
            class="h-11 rounded-xl px-3 py-2 text-sm
                   bg-gray-50 dark:bg-gray-800
                   border border-gray-300 dark:border-gray-600
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            type="text"
            placeholder="ex. Sonarr principal"
            bind:value={name}
            required
          />
        </div>

        <!-- URL -->
        <div class="flex flex-col gap-2">
          <label for="sonarr-url" class="text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
          <input
            id="sonarr-url"
            class="h-11 rounded-xl px-3 py-2 text-sm
                   bg-gray-50 dark:bg-gray-800
                   border border-gray-300 dark:border-gray-600
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            type="url"
            placeholder="https://sonarr.mondomaine.fr"
            bind:value={url}
            required
          />
        </div>

        <!-- Clé API -->
        <div class="flex flex-col gap-2">
          <label for="sonarr-api" class="text-sm font-medium text-gray-700 dark:text-gray-300">Clé API</label>
          <input
            id="sonarr-api"
            class="h-11 rounded-xl px-3 py-2 text-sm
                   bg-gray-50 dark:bg-gray-800
                   border border-gray-300 dark:border-gray-600
                   placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:ring-2 focus:ring-indigo-400"
            type="text"
            placeholder="Votre clé API Sonarr"
            bind:value={api_key}
            required
          />
        </div>

        <!-- Erreur -->
        {#if error}
          <div class="flex items-center gap-2 text-sm 
                      text-red-600 dark:text-red-400 
                      bg-red-50 dark:bg-red-900/20 
                      border border-red-300 dark:border-red-700 
                      rounded-lg px-3 py-2">
            ⚠️ {error}
          </div>
        {/if}

        <!-- Résultat du test -->
        {#if testResult}
          <div class={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border
            ${testResult.success
              ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
              : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'}`}>
            {testResult.success ? '✅' : '⚠️'} {testResult.message}
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            class="px-4 h-11 rounded-lg text-sm font-medium
                   bg-indigo-600 hover:bg-indigo-500
                   text-white disabled:opacity-50"
            on:click={handleTestConnection}
            disabled={loading || testingConnection}
          >
            {testingConnection ? 'Test en cours...' : 'Tester la connexion'}
          </button>

          <button
            type="submit"
            class="px-4 h-11 rounded-lg text-sm font-medium
                   bg-emerald-600 hover:bg-emerald-500
                   text-white disabled:opacity-50"
            disabled={loading || testingConnection}
          >
            {loading ? 'Ajout en cours...' : 'Ajouter l’instance'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
