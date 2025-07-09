<script lang="ts">
  import { slide } from 'svelte/transition';
  import { page } from '$app/stores';
  import { getContext, onMount } from 'svelte';
  import SuperDebug from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { seedboxSettingsSchema, type SeedboxSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import TextField from './components/text-field.svelte';
  import { Loader2 } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import RunScript from '../../routes/run-script.svelte';
  import { goto } from '$app/navigation';
  import CheckboxField from './components/checkbox-field.svelte';
  import { browser } from '$app/environment';

  export let data: SuperValidated<Infer<SeedboxSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let label = "";
  export let fieldDescription = "";
  export let name;
  export let scriptName: string = 'infos';

  let isScriptCompleted = false;
  let isSubmitting = false;
  let showSpinner = false;
  let statusMessage = '';
  let showLogs = false;

  const formDebug: boolean = getContext('formDebug');

  const form = superForm(data, {
    validators: zodClient(seedboxSettingsSchema),
    dataType: "json",
  });

  const { form: formData, enhance, message, delayed } = form;

  function handleFormSuccess() {
    console.log("Formulaire soumis avec succès.");
    toast.success('Script déclenché: ' + scriptName);

    if (browser) {
      console.log('Dispatching startScript event for:', scriptName);
      const scriptEvent = new CustomEvent('startScript', { detail: { scriptName } });
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

  onMount(() => {
    if (!browser) return;
    const uniqueParam = new Date().getTime();
    const currentUrl = window.location.href;

    if (!currentUrl.includes('nocache')) {
      window.location.href = `${currentUrl}?nocache=${uniqueParam}`;
    }
  });

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

<!-- Formulaire principal avec utilisation du schéma pour la validation -->
<form method="POST" action={actionUrl} use:enhance class="my-8 flex flex-col gap-2" on:submit={handleFormSuccess}>

<div class="flex flex-col items-start">
    <div class="flex items-center">
        <label style="font-size: 14px" for="showLogs" class="flex items-center">Afficher les logs</label>
        <input type="checkbox" bind:checked={showLogs} class="ml-9" id="showLogs" />
    </div>
    <p style="font-size: 13px" class="text-gray-500 text-sm mt-1">Logs en temps réel.</p>
</div>

{#if !showLogs}
    <div transition:slide>
        <TextField {form} name="username" label="Username" {formData} />
    </div>

    <div transition:slide>
        <TextField {form} name="email" label="Email" {formData} />
    </div>

    <div transition:slide>
        <TextField {form} name="domain" label="Domaine" {formData} />
    </div>

    <div transition:slide>
        <TextField {form} name="password" label="Password" {formData} isProtected={true} />
    </div>

    <div transition:slide>
        <TextField {form} name="cloudflare_login" label="Cloudflare Mail" {formData} />
    </div>

    <div transition:slide>
        <TextField {form} name="cloudflare_api_key" label="Cloudflare API" isProtected={true} {formData} />
    </div>

    <div transition:slide>
        <CheckboxField {form} name="oauth_enabled" label="Oauth" {formData} />
    </div>

        {#if $formData.oauth_enabled}
            <div transition:slide>
                <TextField {form} name="oauth_client" label="Oauth Client" isProtected={true} {formData} />
            </div>

            <div transition:slide>
                <TextField {form} name="oauth_secret" label="Oauth Secret" isProtected={true} {formData} />
            </div>

            <div transition:slide>
                <TextField {form} name="oauth_mail" label="Oauth Mail" {formData} />
            </div>
        {/if}

        <Separator class="mt-4" />

        <!-- Exemple de groupe de champs avec description -->
        <div class="form-group">
            <label for={name} class="text-sm">{label}</label>

            <!-- Description du champ, affichée si présente -->
            {#if fieldDescription}
                <p class="text-gray-500 text-xs">{fieldDescription}</p>
            {/if}
        </div>
{/if}

    <!-- Bouton de soumission -->
    <div class="flex w-full justify-between items-center">
        {#if statusMessage}
            <p class="text-orange-500 text-sm blinking-message">{statusMessage}</p>
        {/if}

        <div class="ml-auto">
            <Form.Button disabled={isSubmitting} type="submit" size="sm" class="w-full lg:max-w-max">
                {#if showSpinner}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    <p class="text-sm text-gray-500">Soumission en cours...</p>
                {:else}
                    Sauvegarder
                    <span class="ml-1" class:hidden={$page.url.pathname === '/settings/seedbox'}>
                        et continuer
                    </span>
                {/if}
            </Form.Button>
        </div>
    </div>
</form>

<RunScript {scriptName} {showLogs} on:buttonStateChange={updateButtonState} on:statusMessageUpdate={updateStatusMessage} on:scriptCompleted={handleScriptCompleted} />

{#if formDebug}
	<SuperDebug data={$formData} />
{/if}

