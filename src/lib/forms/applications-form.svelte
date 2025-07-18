<script lang="ts">
  import { slide } from 'svelte/transition';
  import { page } from '$app/stores';
  import { getContext, onMount } from 'svelte';
  import SuperDebug from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { type SuperValidated, type Infer, superForm } from 'sveltekit-superforms';
  import * as Form from '$lib/components/ui/form';
  import { applicationsSettingsSchema, type ApplicationsSettingsSchema } from '$lib/forms/helpers';
  import { toast } from 'svelte-sonner';
  import { Toaster } from '$lib/components/ui/sonner';
  import TextField from '$lib/forms/components/text-field.svelte';
  import CheckboxField from './components/checkbox-field.svelte';
  import GroupCheckboxField from './components/group-checkbox-field.svelte';
  import ArrayField from '$lib/forms/components/array-field.svelte';
  import { Loader2, Trash2, Plus, RefreshCw } from 'lucide-svelte';
  import { Separator } from '$lib/components/ui/separator';
  import * as Combobox from "/src/plugins";
  import { Input } from '$lib/components/ui/input';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { Radio } from 'flowbite-svelte';
  import { Button } from '$lib/components/ui/button';
  import RunScript from '../../routes/run-script.svelte'; 
  import { browser } from '$app/environment';

  export let data: SuperValidated<Infer<ApplicationsSettingsSchema>>;
  export let actionUrl: string = '?/default';
  export let scriptName: string = 'appli';

  let applications = [];
  let domaine = {};
  let selectedItem: Item | null = null;
  let selectedApplication = '';

  let isSubmitting = false;
  let showSpinner = false;
  let statusMessage = '';
  let showLogs = false;
  let selectedAuth = "";

  const formDebug: boolean = getContext('formDebug');

  const form = superForm(data, {
    validators: zodClient(applicationsSettingsSchema),
    dataType: "json",
  });

  const { form: formData, enhance, message, delayed } = form;
  let fruits: Item[] = [];
  let input: HTMLInputElement | null = null;
  let items: { [itemId: string]: HTMLElement } = {};

  type Item = { id: number; label: string };

  formData.domaine = typeof formData.domaine === 'object' && !Array.isArray(formData.domaine) ? formData.domaine : {};

  onMount(() => {
    formData.update(data => {
      data.authentification.authappli = "basique";
      return data;
    });

    if (browser) {
      const uniqueParam = new Date().getTime();
      const currentUrl = window.location.href;
      if (!currentUrl.includes('nocache')) {
        window.location.href = `${currentUrl}?nocache=${uniqueParam}`;
      }
    }

    fetchServices();
    fetchApplications();
  });

  async function fetchServices() {
    try {
      const response = await fetch('/settings/services.json');
      if (!response.ok) throw new Error('Failed to load');
      const jsonData = await response.json();
      fruits = jsonData.items || [{ id: 0, label: 'No items available' }];
      initializeCombobox();
    } catch (error) {
      fruits = [{ id: 0, label: 'No items available' }];
      initializeCombobox();
    }
  }

  async function fetchApplications() {
    try {
      const response = await fetch('/settings.json');
      if (!response.ok) throw new Error('Failed to load');
      const jsonData = await response.json();
      applications = jsonData.applications || [];
      if (applications.length > 0) {
        selectedApplication = applications[0].id;
      }
    } catch (error) {
      console.error('Erreur lors du chargement des applications:', error);
    }
  }

  const config = Combobox.initConfig<Item>({
    toItemId: (item) => item.id,
    toItemInputValue: (item) => item.label,
  });

  let model = Combobox.init(config, {
    allItems: fruits,
    inputMode: { type: "search-mode", inputValue: "" },
    selectMode: { type: "single-select" },
  });

  function initializeCombobox() {
    model = Combobox.init(config, {
      allItems: fruits,
      inputMode: { type: "search-mode", inputValue: "" },
      selectMode: { type: "single-select" },
    });
  }

  $: state = Combobox.toState(config, model);

  const dispatch = (msg: Combobox.Msg<Item> | null) => {
    if (!msg) return;
    const output = Combobox.update(config, { msg, model }, []);
    model = output.model;

    Combobox.handleEffects(output, {
      focusInput: () => input?.focus(),
      scrollItemIntoView: (item) => items[item.id]?.scrollIntoView({ block: "nearest" }),
    });

    Combobox.handleEvents(output, {
      onInputValueChanged() {
        // Optionnel
      },
      onSelectedItemsChanged() {
        selectedItem = model.selectedItems[0] || null;
      },
    });
  };

  const onKeydown = (event: KeyboardEvent) => {
    const msg = Combobox.keyToMsg<Item>(event.key);
    if (msg.shouldPreventDefault) event.preventDefault();
    dispatch(msg);
  };

  function resetCombobox() {
    selectedItem = null;
    selectedApplication = '';
    initializeCombobox();
  }

  function resetForm() {
    formData.update(() => ({
      dossiers_on_item_type: [],
      authentification: { authappli: "basique" },
      domaine: {},
    }));
    resetCombobox();
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    formData.update((data) => {
      if (typeof data.domaine === 'string') {
        try {
          data.domaine = JSON.parse(data.domaine);
        } catch {
          data.domaine = {};
        }
      }
      handleFormSuccess();
      return {
        ...data,
        dossiers_on_item_type: [],
        authentification: { authappli: "basique" },
        domaine: {}
      };
    });
    (event.target as HTMLFormElement).reset();
  }

  function handleFormSuccess() {
    toast.success('Script déclenché: ' + scriptName);
    const label = selectedItem?.label;
    if (!label) {
      toast.error("Aucune application sélectionnée. Veuillez sélectionner une application.");
      return;
    }
    if (browser) {
      const scriptEvent = new CustomEvent('startScript', {
        detail: { scriptName, label }
      });
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

  function handleCheckboxChange(event: Event) {
    showLogs = (event.target as HTMLInputElement).checked;
  }
</script>

<!-- Le reste du HTML est inchangé (reprendre exactement ce que tu avais) --><style>
/* Conteneur principal pour le label et la combobox */
.combobox-container {
    display: flex;
    align-items: center;
}

/* Conteneur du label "Applications" */
.label-container {
    margin-right: 120px;
}

/* Ajustement de la largeur de la combobox */
.combobox-wrapper {
    flex-grow: 0;
}

.label-text {
    margin: 0;
    font-size: 1rem;
}

/* Styles existants pour la combobox */
.container {
    width: 100%;
    max-width: 200px;
}

@keyframes blink {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
}

.blinking-message {
    animation: blink 1.5s linear infinite;
}

.input-container {
    position: relative;
}

.label {
    display: block;
    margin-bottom: 0.5rem;
}

.input {
    padding: 0.25rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.875rem;
    box-sizing: border-box;
    background-color: #ffffff;
    outline: none;
}

.input:focus {
    border-color: #bbb;
}

.suggestions {
    color: #333;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 1;
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #ddd;
    background-color: #ffffff;
    margin: 0;
    padding: 0;
    list-style: none;
}

.option {
    padding: 0.25rem;
    cursor: pointer;
}

.highlighted {
    background-color: #f0f0f0;
}

.selected {
    background-color: #e0e0e0;
    color: #333;
}

.selected-and-highlighted {
    background-color: #d0d0d0;
}

.hide {
    display: none;
}

.selected-result {
    margin-top: 0.5rem;
    font-size: 0.875rem;
}
</style>

<!-- Formulaire pour la combobox -->
<form method="POST" action={actionUrl} use:enhance class="my-8 flex flex-col gap-2" on:submit={handleSubmit}>

<div class="flex flex-col items-start">
    <div class="flex items-center">
        <label style="font-size: 14px" for="showLogs" class="flex items-center">Afficher les logs</label>
        <input type="checkbox" bind:checked={showLogs} class="ml-9" id="showLogs" style="width: 16px; height: 16px; margin-left: 110px; border: 0.5px solid #000; background-color: transparent;" />
    </div>
    <p class="text-gray-500 text-sm mt-1">Logs en temps réel</p>
</div>

{#if !showLogs}


<div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
    <!-- Conteneur principal -->
    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 20px; width: 100%;">
        <!-- Label aligné à gauche -->
        <label 
            class="text-sm" 
            for="authappli-basique" 
            style="flex-shrink: 0; margin-right: 90px;"
        >
            Authentification
        </label>

        <!-- Conteneur des boutons radio -->
        <div style="display: flex; flex-wrap: wrap; gap: 15px;">
            <!-- Basique -->
            <label 
                class="flex items-center gap-2 text-sm" 
                for="authappli-basique" 
                style="display: flex; align-items: center; gap: 5px;"
            >
                <input 
                    id="authappli-basique"
                    name="authappli" 
                    type="radio" 
                    bind:group={$formData.authentification.authappli} 
                    value="basique" 
                    class="appearance-none border-2 border-teal-400 rounded-full checked:bg-teal-400 checked:border-teal-400 w-4 h-4" 
                />
                <span>Basique</span>
            </label>

            <!-- Oauth -->
            <label 
                class="flex items-center gap-2 text-sm" 
                for="authappli-oauth" 
                style="display: flex; align-items: center; gap: 5px;"
            >
                <input 
                    id="authappli-oauth"
                    name="authappli" 
                    type="radio" 
                    bind:group={$formData.authentification.authappli} 
                    value="oauth" 
                    class="appearance-none border-2 border-teal-400 rounded-full checked:bg-teal-400 checked:border-teal-400 w-4 h-4" 
                />
                <span>Oauth</span>
            </label>

            <!-- Authelia -->
            <label 
                class="flex items-center gap-2 text-sm" 
                for="authappli-authelia" 
                style="display: flex; align-items: center; gap: 5px;"
            >
                <input 
                    id="authappli-authelia"
                    name="authappli" 
                    type="radio" 
                    bind:group={$formData.authentification.authappli} 
                    value="authelia" 
                    class="appearance-none border-2 border-teal-400 rounded-full checked:bg-teal-400 checked:border-teal-400 w-4 h-4" 
                />
                <span>Authelia</span>
            </label>

            <!-- Aucune -->
            <label 
                class="flex items-center gap-2 text-sm" 
                for="authappli-aucune" 
                style="display: flex; align-items: center; gap: 5px;"
            >
                <input 
                    id="authappli-aucune"
                    name="authappli" 
                    type="radio" 
                    bind:group={$formData.authentification.authappli} 
                    value="aucune" 
                    class="appearance-none border-2 border-teal-400 rounded-full checked:bg-teal-400 checked:border-teal-400 w-4 h-4" 
                />
                <span>Aucune</span>
            </label>
        </div>
    </div>
</div>
<div style="height: 10px;"></div>

<div 
    class="combobox-container" 
    style="display: flex; flex-direction: column; gap: 8px; align-items: flex-start; width: 100%;"
>
    <!-- Wrapper du label et du champ d'entrée -->
    <div 
        class="combobox-wrapper" 
        style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%;"
    >
        <!-- Label aligné à gauche -->
        <div 
            class="label-container" 
            style="flex-shrink: 0; white-space: nowrap;"
        >
            <p 
                class="text-sm" 
                style="margin: 0;"
            >
                Applications
            </p>
        </div>

        <!-- Champ d'entrée -->
        <div 
            class="input-container" 
            style="position: relative; display: flex; align-items: center; flex-grow: 1; min-width: 200px; max-width: 100%;"
        >
            <input 
                {...state?.aria.input}
                class="input"
                value={state?.inputValue || ""}
                placeholder="Choisir Application"
                bind:this={input}
                on:input={(event) => dispatch({ type: "inputted-value", inputValue: event.currentTarget.value })}
                on:focus={() => dispatch({ type: "focused-input" })}
                on:blur={() => dispatch({ type: "blurred-input" })}
                on:mousedown={() => dispatch({ type: "pressed-input" })}
                on:keydown={onKeydown}
                style="width: 300px; height: 37px; padding: 6px; background-color: transparent; border: 1px solid #ccc; border-radius: 4px; margin-left: 2px;"
            />

            <!-- Liste déroulante alignée sous le champ -->
            <ul 
                {...state?.aria.itemList} 
                class="suggestions" 
                class:hide={!state?.isOpened} 
                style="margin: 0; padding: 0; list-style: none; border: 1px solid #ccc; border-radius: 4px; max-height: 200px; overflow-y: auto; width: 300px; position: absolute; top: calc(100% + 4px); left: 0; background: #fff; z-index: 10;"
            >
                {#if state?.renderItems.length === 0}
                    <li style="padding: 8px; text-align: center;">No results</li>
                {/if}
                {#each state?.renderItems as item, index}
                    <div
                        {...item.aria}
                        role="option"
                        tabindex="0"
                        aria-selected={item.status === "selected"}
                        on:mousemove={() => dispatch({ type: "hovered-over-item", index })}
                        on:mousedown|preventDefault={() => dispatch({ type: "pressed-item", item: item.item })}
                        class="option"
                        style="padding: 8px; cursor: pointer; background: {item.status === 'highlighted' ? '#f0f0f0' : 'transparent'}; border-bottom: 1px solid #eee;"
                    >
                        {item.inputValue}
                    </div>
                {/each}
            </ul>
        </div>
    </div>
</div>

<div style="height: 10px;"></div>

<CheckboxField {form} name="dossiers_enabled" label="Applications Installées" {formData} />
{#if $formData.dossiers_enabled}
    <div transition:slide>
        <ArrayField {form} name="" {formData}>
            {#each $formData.dossiers_on_item_type as _, i}
                <Form.ElementField {form} name="dossiers_on_item_type[{i}]">
                    <Form.Control let:attrs>
                        <div class="flex items-center gap-2">
                            <Input 
                                type="text" 
                                spellcheck="false" 
                                autocomplete="false" 
                                {...attrs} 
                                bind:value={$formData.dossiers_on_item_type[i].label} 
                            />
                            <div class="flex items-center gap-2">
                                <!-- Bouton supprimer -->
                                <Form.Button 
                                    type="button" 
                                    size="sm" 
                                    variant="destructive" 
                                    on:click={async () => {
                                        const itemToDelete = $formData.dossiers_on_item_type[i];
                                        const label = itemToDelete?.label;
                                        console.log('Label de l\'élément à supprimer:', label);

                                        if (label) {
                                            const settingId = encodeURIComponent(label);
                                            if (confirm(`Êtes-vous sûr de vouloir supprimer l'application "${label}" ?`)) {
                                                try {
                                                    const response = await fetch(`/settings/delete?setting_id=${settingId}`, {
                                                        method: 'DELETE',
                                                        headers: {
                                                            'Content-Type': 'application/json'
                                                        }
                                                    });

                                                    const data = await response.json();
                                                    console.log('Réponse complète de l\'API :', data);

                                                    if (data.message === 'Settings deleted successfully.') {
                                                        console.log('Élément supprimé avec succès.');

                                                        // Mise à jour du tableau dossiers_on_item_type
                                                        $formData = {
                                                            ...$formData,
                                                            dossiers_on_item_type: $formData.dossiers_on_item_type.filter((_, index) => index !== i)
                                                        };

                                                        // Suppression dans authentification
                                                        const updatedAuthentification = { ...$formData.authentification };
                                                        delete updatedAuthentification[label];
                                                        $formData = { ...$formData, authentification: updatedAuthentification };

                                                        // Suppression dans domaine
                                                        const updatedDomaine = { ...$formData.domaine };
                                                        delete updatedDomaine[label];
                                                        $formData = { ...$formData, domaine: updatedDomaine };

                                                        console.log('Données après suppression:', $formData);

                                                        const scriptName = 'suppression';

                                                        const scriptEvent = new CustomEvent('startScript', { 
                                                            detail: { 
                                                                scriptName, 
                                                                label 
                                                         } 
                                                       });
                                                        window.dispatchEvent(scriptEvent);
                                                        console.log(`Lancement du script ${scriptName}.sh pour l'application: ${label}`);                   

                                                    } else {
                                                        console.error('Erreur de suppression:', data.message);
                                                    }
                                                } catch (error) {
                                                    console.error('Erreur lors de la suppression:', error);
                                                }
                                            }
                                        } else {
                                            console.error('L\'élément à supprimer n\'est pas défini ou n\'a pas de label.');
                                        }
                                    }}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Form.Button>

                                <!-- Bouton réinitialiser -->
                                <Form.Button 
                                    type="button" 
                                    title="Réinitialiser l'Application" 
                                    size="sm" 
                                    variant="reinitialiser" 
                                    on:click={async () => {
                                        const itemToReinitialize = $formData.dossiers_on_item_type[i];
                                        const label = itemToReinitialize?.label;
                                        console.log('Label de l\'élément à réinitialiser:', label);
                                    if (label) {
                                        try {
                                            const scriptName = 'reinitialiser';
                                            const scriptEvent = new CustomEvent('startScript', { 
                                                detail: { 
                                                    scriptName, 
                                                    label 
                                                } 
                                            });
                                            window.dispatchEvent(scriptEvent);
                                            console.log(`Lancement du script ${scriptName}.sh pour l'application: ${label}`);
                                        } catch (error) {
                                            console.error('Erreur lors du lancement du script:', error);
                                        }
                                    } else {
                                        console.error("L'application à réinitialiser n'a pas de label.");
                                    }
                                }}
                                >
                                    <RefreshCw class="h-4 w-4" />
                                </Form.Button>
                            </div>
                        </div>
                    </Form.Control>
                </Form.ElementField>
            {/each}
        </ArrayField>
    </div>
{/if}

    <!-- Champ de saisie visible pour domaine -->
<div class="mt-4" style="width: 100%;">
    {#if selectedItem?.label}
        <div 
            class="combobox-wrapper" 
            style="display: flex; align-items: center; gap: 0px; flex-wrap: wrap; width: 100%; max-width: 100%;"
        >
            <!-- Label pour Sous domaine -->
            <div 
                class="label-container" 
                style="flex-shrink: 0; white-space: nowrap; font-size: 1rem; margin-bottom: 4px;"
            >
                <p 
                    class="text-sm" 
                    style="margin: 0;"
                >
                    Sous domaine
                    <span class="block text-sm text-gray-500">Personnalisé</span>
                </p>
            </div>

            <!-- Champ de saisie aligné avec le label -->
            <div 
                class="input-container" 
                style="display: flex; align-items: center; flex-grow: 1; min-width: 200px; max-width: 100%;"
            >
                <input 
                    type="text" 
                    name="domaine[{selectedItem.label}]" 
                    id="domaine" 
                    placeholder="Sous domaine par défaut {selectedItem.label}"
                    class="input inline-block shadow-sm sm:text-sm border border-gray-300 rounded-md"
                    style="width: 100%; max-width: 300px; height: 37px; padding: 6px; background-color: transparent; border: 1px solid #ccc; border-radius: 4px;"
                    bind:value={$formData.domaine[selectedItem.label]}
                />
            </div>
        </div>
    {/if}
</div>
{/if}

    <input type="hidden" name="domaine" value={JSON.stringify(formData.domaine)} />
    <input type="hidden" name="selectedItemId" value={selectedItem?.id} />
    <input type="hidden" name="selectedItemLabel" value={selectedItem?.label} />

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
                    <span class="ml-1" class:hidden={$page.url.pathname === '/settings/applications'}>
                        et continuer
                    </span>
                {/if}
            </Form.Button>
        </div>
    </div>
</form>

<!-- Composant RunScript pour exécuter le script et gérer son état -->
<RunScript scriptName={scriptName} label={selectedItem?.label} {showLogs} on:buttonStateChange={updateButtonState} on:statusMessageUpdate={updateStatusMessage} />


{#if formDebug}
	<SuperDebug data={$formData} />
{/if}


