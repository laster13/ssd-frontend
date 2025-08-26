<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { mediaServerSettingsSchema, type MediaServerSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import { Separator } from '$lib/components/ui/separator';
  import { Loader2, CheckCircle2, XCircle } from 'lucide-svelte';
  import RunScript from '../../routes/run-script.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { fade } from 'svelte/transition';
  import { api } from '$lib/api'

  export let data: SuperValidated<Infer<MediaServerSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let scriptName: string = 'requis';

  let fileExists: boolean | null = null;
  let backendUrl: string | undefined;

  const form = superForm(data, { dataType: 'json' });
  const { form: formData, enhance } = form;

  let isSubmitting = false;
  let showSpinner = false;
  let statusMessage = '';
  let showLogs = false;

  if (browser) {
    backendUrl = window.location.protocol === 'https:'
      ? import.meta.env.VITE_BACKEND_URL_HTTPS
      : import.meta.env.VITE_BACKEND_URL_HTTP;
  } else {
    backendUrl = import.meta.env.VITE_BACKEND_URL;
  }

  onMount(() => {
    if (!browser) return;

    // Génère un paramètre unique pour contourner le cache
    const uniqueParam = new Date().getTime();

    // Appelle directement le backend avec ce param
    checkFileStatus(uniqueParam);
  });

  async function checkFileStatus() {
    try {
      const { data } = await api.get('/scripts/check-file');
      fileExists = data.exists;
    } catch (error) {
      console.error('Erreur lors de la vérification du fichier:', error);
      fileExists = false;
    }
  }

  async function handleFormSuccess(event: Event) {
    event.preventDefault();

    isSubmitting = true;
    showSpinner = true;
    statusMessage = "Récupération de la configuration SSDv2...";

    try {
      if (fileExists) {
        const response = await api.post('/scripts/update-config'); // ✅ remplacé

        if (response.status === 200) {
          toast.success('Configuration mise à jour avec succès');
          statusMessage = "";
          setTimeout(() => handleScriptCompleted?.(), 2000);
        } else {
          throw new Error('Erreur lors de la mise à jour');
        }
      } else {
        toast.success('Script déclenché: ' + scriptName);
        if (browser) {
          const scriptEvent = new CustomEvent('startScript', { detail: { scriptName } });
          window.dispatchEvent(scriptEvent);
        }
        statusMessage = "Script déclenché sans SSD.";
      }
    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      toast.error('Échec de la mise à jour de la configuration');
      statusMessage = "Échec de la mise à jour.";
    } finally {
      isSubmitting = false;
      setTimeout(() => {
        showSpinner = false;
      }, 1500);
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

  function handleCheckboxChange(event: Event) {
    showLogs = (event.target as HTMLInputElement).checked;
  }

  function handleScriptCompleted() {
    const currentPath = $page.url.pathname;
    if (currentPath === '/onboarding/1') {
      setTimeout(() => goto('/onboarding/2'), 100);
    }
  }
</script>

<!-- Carte Ultra Premium Responsive (moins large) -->
<div class="w-full max-w-xl mx-auto">
  <div class="p-[2px] rounded-4xl bg-gradient-to-r from-amber-400/40 via-orange-500/40 to-pink-500/40 shadow-[0_8px_60px_-10px_rgba(251,191,36,0.3)]">
    <form 
      method="POST" 
      action={actionUrl} 
      use:enhance 
      class="flex flex-col gap-8 p-6 sm:p-10 rounded-4xl 
             bg-white/80 dark:bg-gray-900/80 
             backdrop-blur-3xl border border-white/10 shadow-2xl"
      on:submit={handleFormSuccess}
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

      <!-- État -->
      <div class="p-4 sm:p-5 rounded-3xl bg-white/60 dark:bg-gray-800/60 border border-white/10 shadow-inner flex items-center justify-between">
        <span class="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200">
          État actuel :
        </span>

        {#if fileExists === null}
          <span class="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs sm:text-sm font-medium">
            <Loader2 class="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> Vérification...
          </span>
        {:else if fileExists}
          <span class="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-medium">
            <CheckCircle2 class="h-4 w-4 sm:h-5 sm:w-5" /> SSDv2 installé
          </span>
        {:else}
          <span class="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium">
            <XCircle class="h-4 w-4 sm:h-5 sm:w-5" /> SSDv2 non installé
          </span>
        {/if}
      </div>

      <Separator class="opacity-40" />

      <!-- Zone centrale -->
      {#if showSpinner}
        <!-- Pendant le spin -->
        <div in:fade out:fade class="flex justify-center">
          <div class="flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl 
                      bg-white/80 dark:bg-gray-800/70 border border-amber-200/30 dark:border-amber-500/20
                      text-amber-700 dark:text-amber-400 text-xs sm:text-sm font-medium 
                      shadow-inner backdrop-blur-lg">
            <Loader2 class="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-amber-500" />
            {statusMessage || 'Synchronisation en cours...'}
          </div>
        </div>
      {:else}
        <!-- Bouton CTA -->
        <div class="flex justify-center">
          <div in:fade out:fade class="w-full sm:w-auto">
            <Form.Button 
              disabled={isSubmitting} 
              type="submit" 
              size="lg"
              class="relative inline-flex items-center justify-center w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 
                     rounded-2xl text-sm sm:text-base font-bold text-white tracking-wide uppercase
                     bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500
                     hover:from-orange-500 hover:via-pink-500 hover:to-rose-600
                     border border-white/20 shadow-[0_10px_40px_-5px_rgba(251,191,36,0.5)]
                     transition disabled:opacity-60 overflow-hidden group"
            >
              <span class="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent 
                           translate-x-[-200%] group-hover:translate-x-[200%] 
                           transition-transform duration-1000 ease-in-out"></span>
              Synchroniser
            </Form.Button>
          </div>
        </div>
      {/if}
    </form>
  </div>
</div>

<!-- RunScript -->
<RunScript 
  {scriptName} 
  {showLogs} 
  on:buttonStateChange={updateButtonState} 
  on:statusMessageUpdate={updateStatusMessage}
  on:scriptCompleted={handleScriptCompleted}
/>
