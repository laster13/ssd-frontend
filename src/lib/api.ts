import axios from "axios";

// --- AXIOS CLIENT ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // indispensable pour HttpOnly
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("⛔ Session expirée");
    }
    return Promise.reject(error);
  }
);

// --- AUTH ---
export const auth = {
  checkFirstRun: () => api.get("/setup/first-run"),

  registerFirstUser: async (username: string, password: string) => {
    const { data } = await api.post("/setup/register", { username, password });
    return data;
  },

  login: async (username: string, password: string, rememberMe = false) => {
    await api.post(
      "/login",
      { username, password, remember_me: rememberMe },
      { withCredentials: true } // 🔑 patch ici
    );
    return auth.getMe(); // retournera directement l’utilisateur
  },

  logout: async () => {
    await api.post("/logout");
  },

  // 🔑 accepte un cookie optionnel (utile pour SSR)
  getMe: async (cookie?: string) => {
    const { data } = await api.get("/me", {
      headers: cookie ? { cookie } : undefined,
    });
    return data;
  },

  isAuthenticated: async (cookie?: string) => {
    try {
      await auth.getMe(cookie);
      return true;
    } catch {
      // 🔁 tolérer un 401 fugitif en réessayant une fois
      try {
        await new Promise((resolve) => setTimeout(resolve, 200)); // petite pause
        await auth.getMe(cookie);
        return true;
      } catch {
        return false;
      }
    }
  },
};

// --- SONARR ---
export const sonarr = {
  getInstances: () => api.get("/sonarr"),
  createInstance: (data: any) => api.post("/sonarr", data),
  updateInstance: (id: number, data: any) => api.put(`/sonarr/${id}`, data),
  deleteInstance: (id: number) => api.delete(`/sonarr/${id}`),
  testConnection: (data: any) => api.post("/sonarr/test-connection", data),
  testExistingConnection: (id: number) =>
    api.post(`/sonarr/${id}/test-connection`),

  getShows: (
    instanceId: number,
    page = 1,
    pageSize = 36,
    filters: any = {}
  ) => {
    const params = new URLSearchParams({
      instance_id: instanceId.toString(),
      page: page.toString(),
      page_size: pageSize.toString(),
    });

    if (filters.search) params.append("search", filters.search);
    if (filters.status) params.append("status", filters.status);
    if (filters.monitored !== undefined)
      params.append("monitored", filters.monitored);
    if (filters.missing_episodes !== undefined)
      params.append("missing_episodes", filters.missing_episodes);
    if (filters.network) params.append("network", filters.network);
    if (filters.genres?.length > 0) {
      filters.genres.forEach((genre: string) => params.append("genres", genre));
    }
    if (filters.year_from) params.append("year_from", filters.year_from);
    if (filters.year_to) params.append("year_to", filters.year_to);
    if (filters.runtime_min) params.append("runtime_min", filters.runtime_min);
    if (filters.runtime_max) params.append("runtime_max", filters.runtime_max);
    if (filters.certification)
      params.append("certification", filters.certification);

    return api.get(`/shows?${params}`);
  },

  getFilterOptions: (instanceId: number) => {
    const params = new URLSearchParams({ instance_id: instanceId.toString() });
    return api.get(`/shows/filter-options?${params}`);
  },

  getShowDetail: (showId: number, instanceId: number) => {
    const params = new URLSearchParams({ instance_id: instanceId.toString() });
    return api.get(`/shows/${showId}?${params}`);
  },

  seasonIt: (
    showId: number,
    seasonNumber: number | null = null,
    instanceId: number | null = null
  ) =>
    api.post("/season-it", {
      show_id: showId,
      season_number: seasonNumber,
      instance_id: instanceId,
    }),

  searchSeasonPacks: (
    showId: number,
    seasonNumber: number,
    instanceId: number,
    signal?: AbortSignal
  ) =>
    api.post(
      "/search-season-packs",
      {
        show_id: showId,
        season_number: seasonNumber,
        instance_id: instanceId,
      },
      { signal }
    ),

  downloadRelease: (
    releaseGuid: string,
    showId: number,
    seasonNumber: number,
    instanceId: number,
    indexerId: number
  ) =>
    api.post("/download-release", {
      release_guid: releaseGuid,
      show_id: showId,
      season_number: seasonNumber,
      instance_id: instanceId,
      indexer_id: indexerId,
    }),

  getActivityLogs: (instanceId: number | null = null, page = 1, pageSize = 20) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (instanceId) params.append("instance_id", instanceId.toString());
    return api.get(`/activity-logs?${params}`);
  },
};

// --- SETTINGS ---
export const settings = {
  getSettings: () => api.get("/settings"),
  updateSettings: (settingsData: any) => api.put("/settings", settingsData),
  purgeDatabase: () => api.delete("/purge-database"),
  completeOnboarding: () => api.post("/settings/complete-onboarding"),
};

export default api;
