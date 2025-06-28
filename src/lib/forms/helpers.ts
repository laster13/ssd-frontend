import { z } from 'zod';
import type { SuperValidated } from 'sveltekit-superforms';

// Application Settings Schema -----------------------------------------------------------------------------------

// Liste des paramètres à récupérer depuis l'API
export const applicationsSettingsToGet: string[] = [
    'authentification',
    'applications',
    'dossiers'
];

// Schéma de validation pour les paramètres d'application
export const applicationsSettingsSchema = z.object({
    id: z.union([z.number(), z.string()]).optional().default(0),
    label: z.string().optional().default(''),
    dossiers_on_item_type: z.array(z.object({
        label: z.string()
    })).optional().default([]),

    authentification: z
        .record(z.string(), z.union([
            z.literal("basique"),
            z.literal("oauth"),
            z.literal("authelia"),
            z.literal("aucune")
        ]))
        .optional()
        .default({ traefik: "basique" }), // Ajout de traefik avec valeur par défaut

    // Domaine est un dictionnaire avec des chaînes comme valeurs
    domaine: z.record(z.string(), z.string().nullable()).optional().default({}),
});

export function applicationsSettingsToPass(data: any) {
    console.log('Données d\'authentification avant traitement:', data?.data?.dossiers?.authentification);

    let applications = data?.data?.applications || [];
    if (!Array.isArray(applications)) applications = applications ? [applications] : [];

    if (applications.length === 0) {
        return {
            id: 0,
            label: '',
            domaine: {},
            dossiers_on_item_type: [],
            authentification: { traefik: "basique" },
        };
    }

    const selectedApplication = applications[0];
    const dossiers_on_item_type = (data?.data?.dossiers?.on_item_type || []).map((item: string) => ({
        label: item
    }));

    const authentification = dossiers_on_item_type.reduce((acc, item) => {
        const authValue = data?.data?.dossiers?.authentification?.[item.label];
        acc[item.label] = authValue !== undefined && authValue !== null ? authValue : 'basique';
        return acc;
    }, { traefik: 'basique' } as Record<string, string>);

    const domaine = dossiers_on_item_type.reduce((acc, item) => {
        acc[item.label] = data?.data?.dossiers?.domaine?.[item.label] || '';
        return acc;
    }, {} as Record<string, string>);

    return {
        id: selectedApplication.id || 0,
        label: selectedApplication.label || '',
        domaine,
        dossiers_on_item_type,
        authentification
    };
}

// Fonction pour mettre à jour les paramètres
export function applicationsSettingsToSet(
    form: SuperValidated<ApplicationsSettingsSchema>, existingData = []
) {
    console.log('Données du formulaire avant mise à jour:', form.data);

    const newApplication = {
        id: form.data.id?.toString(),
        label: form.data.label
    };

    const dossiers = {
        on_item_type: form.data.dossiers_on_item_type.map((item) => item.label),
        authentification: form.data.authentification,
        domaine: form.data.domaine
    };

    const result = [
        {
            key: 'applications',
            value: [...existingData, newApplication]
        },
        {
            key: 'dossiers',
            value: dossiers
        }
    ];

    console.log('Données à retourner après mise à jour:', result);
    return result;
}


// seedbox Settings -----------------------------------------------------------------------------------
// Les clés que nous allons récupérer depuis l'API
export const seedboxSettingsToGet: string[] = ['cloudflare', 'utilisateur'];

export const seedboxSettingsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  domain: z.string().regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid domain format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  cloudflare_login: z.string().min(1, "Login is required"),
  cloudflare_api_key: z.string().min(1, "API key is required"),
  oauth_enabled: z.boolean().default(false),
  oauth_client: z.string().default(''),  // OAuth Client
  oauth_secret: z.string().default(''),  // OAuth Secret
  oauth_mail: z.string().default(''),    // OAuth Mail
  zurg_enabled: z.boolean().default(false),
  zurg_token: z.string().default(''),  // OAuth Secret
});

export type SeedboxSettingsSchema = typeof seedboxSettingsSchema;

// Ajustement de la fonction seedboxSettingsToPass pour éviter les erreurs d’accès aux données
export function seedboxSettingsToPass(data: any) {
  if (!data?.utilisateur || !data?.cloudflare) {
    console.error("Données utilisateur ou cloudflare manquantes :", data);
    return {};
  }

  return {
    username: data.utilisateur.username || '',
    email: data.utilisateur.email || '',
    domain: data.utilisateur.domain || '',
    password: data.utilisateur.password || '',
    cloudflare_login: data.cloudflare.cloudflare_login || '',
    cloudflare_api_key: data.cloudflare.cloudflare_api_key || '',
    oauth_enabled: data.utilisateur.oauth_enabled,
    oauth_client: data.utilisateur.oauth_client || '',
    oauth_secret: data.utilisateur.oauth_secret || '',
    oauth_mail: data.utilisateur.oauth_mail || '',
    zurg_enabled: data.utilisateur.zurg_enabled,
    zurg_token: data.utilisateur.zurg_token || '',
  };
}

// Fonction pour préparer les données du formulaire en vue de leur enregistrement
export function seedboxSettingsToSet(form: SuperValidated<Infer<SeedboxSettingsSchema>>) {
  return [
    {
      key: 'utilisateur',
      value: {
        username: form.data.username,
        domain: form.data.domain,
        email: form.data.email,
        password: form.data.password,
        oauth_enabled: form.data.oauth_enabled,
        oauth_client: form.data.oauth_client,
        oauth_secret: form.data.oauth_secret,
        oauth_mail: form.data.oauth_mail,
        zurg_enabled: form.data.zurg_enabled,
        zurg_token: form.data.zurg_token,
      },
    },
    {
      key: 'cloudflare',
      value: {
        cloudflare_login: form.data.cloudflare_login,
        cloudflare_api_key: form.data.cloudflare_api_key,
      },
    },
  ];
}

// Media Server Settings -----------------------------------------------------------------------------------

export const mediaServerSettingsToGet: string[] = ['updaters'];

export const mediaServerSettingsSchema = z.object({
	// update_interval: z.number().nonnegative().int().optional().default(120), // Moved to coerce due to https://github.com/huntabyte/shadcn-svelte/issues/574
	update_interval: z.coerce.number().gte(0).int().optional().default(120),
	plex_enabled: z.boolean().default(false),
	plex_token: z.string().optional().default(''),
	plex_login: z.string().optional().default(''),
	plex_password: z.string().optional().default(''),
	plex_url: z.string().optional().default('')
});
export type MediaServerSettingsSchema = typeof mediaServerSettingsSchema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mediaServerSettingsToPass(data: any) {
	return {
		update_interval: data.updaters.update_interval,
		plex_token: data.updaters.plex.token,
		plex_url: data.updaters.plex.url,
		plex_login: data.updaters.plex.login,
		plex_password: data.updaters.plex.password,
		plex_enabled: data.updaters.plex.enabled
	};
}

export function mediaServerSettingsToSet(form: SuperValidated<Infer<MediaServerSettingsSchema>>) {
	return [
		{
			key: 'updaters',
			value: {
				update_interval: form.data.update_interval,
				plex: {
					enabled: form.data.plex_enabled,
					token: form.data.plex_token,
					login: form.data.plex_login,
					password: form.data.plex_password,
					url: form.data.plex_url
				}
			}
		}
	];
}