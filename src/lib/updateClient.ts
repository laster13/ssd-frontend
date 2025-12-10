// src/lib/updateClient.ts
import { writable } from "svelte/store";
import { updateNotification } from "$lib/stores/symlinks";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// état simple qu'on peut réutiliser si besoin
export const connectionStatus = writable<"connected" | "disconnected">("disconnected");
export const updateMessage = writable("");

let initialized = false;
let sse: EventSource | null = null;

// 🔎 récupère la notif persistante en base
async function loadPersistentNotification() {
  try {
    const res = await fetch(`${API_BASE_URL}/update/persistent`);
    if (!res.ok) return;
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

// 🚀 à appeler une seule fois (depuis le layout)
export function initUpdateClient() {
  if (initialized) return;
  initialized = true;

  sse = new EventSource(`${API_BASE_URL}/symlinks/events`);

  sse.onopen = async () => {
    connectionStatus.set("connected");
    await loadPersistentNotification();
  };

  sse.onerror = () => {
    connectionStatus.set("disconnected");
  };

  // 🛰️ Quand le backend détecte une mise à jour (via scheduler ou endpoint)
  ["update_available_backend", "update_available_frontend"].forEach((evt) => {
    sse!.addEventListener(evt, async (event) => {
      const data = JSON.parse(event.data);
      updateMessage.set(data.message);

      updateNotification.set({
        type: evt.includes("backend") ? "backend" : "frontend",
        message: data.message,
        version: data.version || null,
      });
    });
  });

  // ✅ Quand une mise à jour est terminée
  sse.addEventListener("update_finished", async (event) => {
    const data = JSON.parse(event.data);
    updateMessage.set(data.message);

    // On efface la bannière et on recharge l'état persistant
    updateNotification.set(null);
    await loadPersistentNotification();
  });
}
