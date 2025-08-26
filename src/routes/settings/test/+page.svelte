<script lang="ts">
  import type { PageData } from './$types';
  import ApplicationsForm from '$lib/forms/test-form.svelte';

  export let data: PageData;
</script>

<div class="flex flex-col p-6 space-y-4">
  <!-- Titre -->
  <h2 class="text-2xl md:text-3xl font-normal text-center mb-6">
    ⚙️ <span class="text-transparent bg-clip-text 
                 bg-gradient-to-r from-red-600 via-orange-500 via-yellow-400 to-green-500">
      Tableau de Bord
    </span>
  </h2>

  <!-- Formulaire -->
  <ApplicationsForm data={data.form} actionUrl="/settings/test" />
</div>
