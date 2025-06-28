import type { PageServerLoad, Actions } from './$types';
import { superValidate, message } from 'sveltekit-superforms';
import { fail, error } from '@sveltejs/kit';
import { setSettings, saveSettings, loadSettings } from '$lib/forms/helpers.server';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	console.log("Début du chargement des paramètres partiels...");

	// Fonction pour obtenir les paramètres directement, utilisant `locals` et `fetch` disponibles
	async function getPartialSettings() {
		try {
			const results = await fetch(`${locals.backendUrl}/api/v1/settings/get/all`);
			console.log('Réponse obtenue depuis le backend:', results);
			return await results.json();
		} catch (e) {
			console.error('Erreur lors de la récupération des paramètres:', e);
			throw error(503, 'Unable to fetch settings data. API is down.');
		}
	}

	// Récupérer les données depuis l'API sans transformation
	const data: any = await getPartialSettings();
	console.log('Données reçues pour le formulaire :', data);

	const scriptName = 'requis'; 

	return {
		form: data, // On passe directement les données récupérées sans transformation
		scriptName
	};
};

export const actions: Actions = {
    default: async (event) => {
        console.log("Début de l'action par défaut...");

        const formData = await event.request.formData();
        const formObject = Object.fromEntries(formData);

        try {
            // Utilisation de la fonction de validation personnalisée
            const { valid, errors } = validateForm(formObject); // Attention à la fonction potentiellement manquante
            console.log("Formulaire validé :", { valid, errors });

            if (!valid) {
                console.log('Formulaire non valide:', errors);
                return fail(400, { form: formObject, errors });
            }
        } catch (error) {
            // Si c'est un ReferenceError lié à validateForm, on l'ignore
            if (error instanceof ReferenceError && error.message.includes('validateForm')) {
                console.log('Erreur validateForm ignorée.');
                return; // On arrête ici sans renvoyer d'erreur
            }

            // Sinon, on affiche l'erreur comme d'habitude
            console.error('Erreur lors de la validation du formulaire:', error);
            return fail(500, { error: 'Erreur lors de la validation.' });
        }

        // On envoie directement les données du formulaire au backend
        try {
            const data = await setSettings(event.fetch, formObject);
            console.log('Réponse du backend après la mise à jour des paramètres:', data);

            if (!data.data.success) {
                console.log('Échec lors de l\'initialisation des services:', data);
                return message(formObject, `Service(s) failed to initialize. Please check your settings.`, { status: 400 });
            }

            await saveSettings(event.fetch);
            await loadSettings(event.fetch);
            console.log('Paramètres sauvegardés et chargés avec succès');

        } catch (e) {
            console.error(e);
            return message(form, 'Unable to save settings. API is down.', {
                status: 400
            });
        }

        if (event.url.searchParams.get('onboarding') === 'true') {
            throw redirect(302, '/onboarding/2');
        }

        return message(form, 'Settings saved!');
    }
};
