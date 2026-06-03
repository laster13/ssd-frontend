// src/lib/updateClient.ts
import { writable } from "svelte/store";
import { updateNotification } from "$lib/stores/symlinks";

const API_BASE_URL = '/api/v1';

// État simple réutilisé par la page de mise à jour
export const connectionStatus = writable<"connected" | "disconnected">("disconnected");
export const updateMessage = writable("");

let initialized = false;
let sse: EventSource | null = null;

type UpdateType = "backend" | "frontend" | "saison_frontend";

function getUpdateType(evt: string): UpdateType {
  if (evt.includes("backend")) {
    return "backend";
  }

  if (evt.includes("saison_frontend")) {
    return "saison_frontend";
  }

  return "frontend";
}

// Récupère la notification persistante en base
async function loadPersistentNotification() {
  try {
    const res = await fetch(`${API_BASE_URL}/update/persistent`);

    if (!res.ok) {
      return;
    }

    const data = await res.json();

    if (data.has_update) {
      updateNotification.set({
        type: data.type,
        message: data.message,
        version: data.version || null,
      });
    } else {
      updateNotification.set(null);
    }
  } catch (err) {
    console.warn("⚠️ Erreur chargement notifications persistantes", err);
  }
}

// À appeler une seule fois depuis le layout
export function initUpdateClient() {
  if (initialized) {
    return;
  }

  initialized = true;
  sse = new EventSource(`${API_BASE_URL}/symlinks/events`);

  sse.onopen = async () => {
    connectionStatus.set("connected");
    await loadPersistentNotification();
  };

  sse.onerror = () => {
    connectionStatus.set("disconnected");
  };

  [
    "update_available_backend",
    "update_available_frontend",
    "update_available_saison_frontend",
  ].forEach((evt) => {
    sse?.addEventListener(evt, async (event) => {
      const data = JSON.parse(event.data);

      updateMessage.set(data.message);
      updateNotification.set({
        type: getUpdateType(evt),
        message: data.message,
        version: data.version || null,
      });
    });
  });

  sse.addEventListener("update_error", (event) => {
    const data = JSON.parse(event.data);

    updateMessage.set(data.message);
    updateNotification.set({
      type: "error",
      message: data.message,
      version: null,
    });
  });

  sse.addEventListener("update_finished", async (event) => {
    const data = JSON.parse(event.data);

    updateMessage.set(data.message);

    updateNotification.set(null);
    await loadPersistentNotification();
  });
}