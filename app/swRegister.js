const SW_PATH = "./sw.js";

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: "./" });

    const notify = (detail) => {
      window.dispatchEvent(new CustomEvent("hc-sw-status", { detail }));
    };

    if (registration.waiting) {
      notify({ type: "update_ready" });
    } else {
      notify({ type: "registered" });
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) {
        return;
      }
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") {
          return;
        }
        // If there's an existing controller, a new SW is ready to take over.
        if (navigator.serviceWorker.controller) {
          notify({ type: "update_ready" });
          return;
        }
        notify({ type: "offline_ready" });
      });
    });
  } catch (_error) {
    // Silent by default: offline caching should never block learning.
  }
}

registerServiceWorker();
