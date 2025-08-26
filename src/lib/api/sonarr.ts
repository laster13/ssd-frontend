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

// 👉 Préfixe unique pour toutes les routes Sonarr
const BASE_URL = '/api/v1/sonarr';

export const sonarr = {
  /**
   * Créer une nouvelle instance Sonarr
   * POST /api/v1/sonarr
   */
  createInstance: (data: CreateSonarrPayload) =>
    axios.post<SonarrInstance>(`${BASE_URL}`, data),

  /**
   * Tester une nouvelle connexion Sonarr
   * POST /api/v1/sonarr/test-connection
   */
  testConnection: (data: CreateSonarrPayload) =>
    axios.post<{ success: boolean; message: string }>(`${BASE_URL}/test-connection`, data),

  /**
   * Lister les instances Sonarr de l’utilisateur
   * GET /api/v1/sonarr
   */
  getInstances: () =>
    axios.get<SonarrInstance[]>(`${BASE_URL}`),

  /**
   * Mettre à jour une instance existante
   * PUT /api/v1/sonarr/{id}
   */
  updateInstance: (id: number, data: UpdateSonarrPayload) =>
    axios.put<SonarrInstance>(`${BASE_URL}/${id}`, data),

  /**
   * Supprimer (désactiver) une instance
   * DELETE /api/v1/sonarr/{id}
   */
  deleteInstance: (id: number) =>
    axios.delete<{ message: string }>(`${BASE_URL}/${id}`),

  /**
   * Tester une instance existante
   * POST /api/v1/sonarr/{id}/test-connection
   */
  testExisting: (id: number) =>
    axios.post<{ success: boolean; message: string }>(`${BASE_URL}/${id}/test-connection`)
};
