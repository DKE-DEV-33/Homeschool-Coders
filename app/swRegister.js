const SW_PATH = "./sw.js";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "./" });
  } catch (_error) {
    // Silent by default: offline caching should never block learning.
  }
}

registerServiceWorker();

