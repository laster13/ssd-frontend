<script lang="ts">
  import { page } from '$app/stores';
  import { getContext, onMount } from 'svelte';
  import SuperDebug from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { mediaServerSettingsSchema, type MediaServerSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import { Separator } from '$lib/components/ui/separator';
  import CheckboxField from './components/checkbox-field.svelte';
  import { Loader2 } from 'lucide-svelte';
  import RunScript from '../../routes/run-script.svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  export let data: SuperValidated<Infer<MediaServerSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let scriptName: string = 'requis';

  let fileExists: boolean | null = null;
  let backendUrl: string | undefined;

  const form = superForm(data, { dataType: 'json' });
  const { form: formData, enhance, message, delayed } = form;

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

    const uniqueParam = new Date().getTime();
    const currentUrl = window.location.href;

    if (!currentUrl.includes('nocache')) {
      window.location.href = `${currentUrl}?nocache=${uniqueParam}`;
    } else {
      checkFileStatus();
    }
  });

  async function checkFileStatus() {
    try {
      const response = await fetch(`${backendUrl}/api/v1/scripts/check-file`);
      const result = await response.json();
      fileExists = result.exists;
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
        const response = await fetch(`${backendUrl}/api/v1/scripts/update-config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const result = await response.json();
          toast.success('Configuration mise à jour avec succès');
          statusMessage = "Mise à jour avec succès.";

          setTimeout(() => {
            if (typeof handleScriptCompleted === 'function') {
              handleScriptCompleted();
            } else {
              console.error('handleScriptCompleted n\'est pas une fonction');
            }
            statusMessage = "";
          }, 2000);
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
      showSpinner = false;
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
      setTimeout(() => {
        goto('/onboarding/2');
      }, 100);
    }
  }
</script>
<!-- Formulaire pour soumettre les données -->
<form method="POST" action={actionUrl} use:enhance class="my-8 flex flex-col gap-2" on:submit={handleFormSuccess}>

    <!-- Logs en temps réel avec case à cocher -->
    <div class="flex flex-col items-start">
        <div class="flex items-center">
            <span for="showLogs" class="flex items-center font-medium text-sm">Afficher les logs</span>
            <input type="checkbox" bind:checked={showLogs} class="ml-9" id="showLogs" />
        </div>
        <p class="text-gray-500 text-sm mt-1">Logs en temps réel</p>
    </div>

    <!-- Affichage en fonction de l'existence du fichier avec un label -->
    <div class="flex items-center space-x-4">
        <span class="font-medium text-sm">État de la seedbox :</span>
        {#if fileExists === null}
            <p style="font-size: 14px; color: orange;">Vérification de l'état de la seedbox en cours...</p>
        {:else if fileExists}
            <div class="py-1 px-2 bg-green-500 text-black rounded">
                <p class="text-sm">SSDv2 installé</p>
            </div>
        {:else}
            <div class="py-1 px-2 bg-red-500 text-black rounded">
                <p class="text-sm">SSDv2 non installé</p>
            </div>
        {/if}
    </div>

    <!-- Séparateur -->
    <Separator class="mt-4" />

    <!-- Bouton d'enregistrement des modifications -->
    <div class="flex w-full justify-between items-center">
        <!-- Affichage du message d'état si présent -->
        {#if statusMessage}
            <p class="text-orange-500 text-sm blinking-message">{statusMessage}</p>
        {/if}

        <!-- Bouton de soumission avec gestion du spinner -->
        <div class="ml-auto">
            <Form.Button disabled={isSubmitting} type="submit" size="sm" class="w-full lg:max-w-max">
                {#if showSpinner}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    <p class="text-sm text-gray-500">Soumission en cours...</p>
                {:else}
                    Sauvegarder
                    <span class="ml-1" class:hidden={$page.url.pathname === '/settings/test'}>
                        et continuer
                    </span>
                {/if}
            </Form.Button>
        </div>
    </div>

</form>

<!-- Composant RunScript pour exécuter le script et gérer son état -->
<RunScript {scriptName} {showLogs} 
    on:buttonStateChange={updateButtonState} 
    on:statusMessageUpdate={updateStatusMessage}
    on:scriptCompleted={handleScriptCompleted} 

/>
