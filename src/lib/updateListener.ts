import { updateNotification } from '$lib/stores/symlinks'; // ✅ on importe ton store existant

export function initUpdateListener() {
  const eventSource = new EventSource('/api/v1/symlinks/events');

  eventSource.addEventListener('update_available_backend', (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    updateNotification.set({
      type: 'backend',
      message: data.message,
      version: data.version
    });
  });

  eventSource.addEventListener('update_available_frontend', (e) => {
    const data = JSON.parse((e as MessageEvent).data);
    updateNotification.set({
      type: 'frontend',
      message: data.message,
      version: data.version
    });
  });

  eventSource.onerror = () => {
    console.warn('❌ SSE déconnecté, reconnexion dans 5s...');
    setTimeout(initUpdateListener, 5000);
  };
}
