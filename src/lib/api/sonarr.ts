// ssd-frontend/src/lib/api/sonarr.ts
import axios from 'axios';

export interface SonarrInstance {
  id: number;
  name: string;
  url: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

export interface CreateSonarrPayload {
  name: string;
  url: string;
  api_key: string;
}

export interface UpdateSonarrPayload {
  name?: string;
  url?: string;
  api_key?: string;
  is_active?: boolean;
}

const BASE_URL = '/api/v1/sonarr';

export const sonarr = {
  // ✅ Instances
  createInstance: (data: CreateSonarrPayload) =>
    axios.post<SonarrInstance>(`${BASE_URL}`, data),

  testConnection: (data: CreateSonarrPayload) =>
    axios.post<{ success: boolean; message: string }>(`${BASE_URL}/test-connection`, data),

  getInstances: () =>
    axios.get<SonarrInstance[]>(`${BASE_URL}`),

  updateInstance: (id: number, data: UpdateSonarrPayload) =>
    axios.put<SonarrInstance>(`${BASE_URL}/${id}`, data),

  deleteInstance: (id: number) =>
    axios.delete<{ message: string }>(`${BASE_URL}/${id}`),

  testExisting: (id: number) =>
    axios.post<{ success: boolean; message: string }>(`${BASE_URL}/${id}/test-connection`),

  // ✅ Détails séries
  getShowDetail: (showId: string, instanceId: number) =>
    axios.get(`${BASE_URL}/${instanceId}/series/${showId}`),

  // ✅ Lancer un Season It (toute série ou saison précise)
  seasonIt: (showId: number, seasonNumber: number | null, instanceId: number) =>
    axios.post(`${BASE_URL}/${instanceId}/series/${showId}/season-it`, { season: seasonNumber }),

  // ✅ Recherche interactive d’une saison
  searchSeason: (showId: number, seasonNumber: number, instanceId: number) =>
    axios.post(`${BASE_URL}/${instanceId}/series/${showId}/search`, { season: seasonNumber })
};
