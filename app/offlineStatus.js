let toastRoot = null;
let styleInjected = false;

function ensureStyle() {
  if (styleInjected) {
    return;
  }
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .hc-offline-toast {
      position: fixed;
      right: 16px;
      top: 16px;
      z-index: 80;
      display: grid;
      gap: 10px;
      pointer-events: none;
    }
    .hc-offline-toast .card {
      pointer-events: auto;
      width: min(360px, calc(100vw - 32px));
      border-radius: 18px;
      border: 1px solid rgba(25, 51, 61, 0.18);
      background: rgba(255, 250, 242, 0.95);
      box-shadow: 0 18px 35px rgba(11, 21, 26, 0.18);
      padding: 12px 14px;
      color: #19333d;
      font-family: "Atkinson Hyperlegible", sans-serif;
    }
    .hc-offline-toast .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .hc-offline-toast strong {
      font-family: "Baloo 2", sans-serif;
      font-size: 1.2rem;
    }
    .hc-offline-toast .meta {
      margin-top: 6px;
      color: rgba(25, 51, 61, 0.7);
      font-weight: 700;
    }
    .hc-offline-toast button {
      border: none;
      border-radius: 14px;
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 800;
      background: rgba(25, 51, 61, 0.08);
      color: #19333d;
    }
    .hc-offline-toast button:hover {
      background: rgba(25, 51, 61, 0.12);
    }
  `;
  document.head.append(style);
}

function ensureRoot() {
  if (toastRoot) {
    return toastRoot;
  }
  ensureStyle();
  toastRoot = document.createElement("div");
  toastRoot.className = "hc-offline-toast";
  document.body.append(toastRoot);
  return toastRoot;
}

function showCard(html, { timeoutMs } = {}) {
  const root = ensureRoot();
  root.innerHTML = "";
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = html;
  root.append(card);

  if (timeoutMs) {
    window.setTimeout(() => {
      if (root.contains(card)) {
        root.innerHTML = "";
      }
    }, timeoutMs);
  }
}

function onStatus(detail) {
  const type = detail?.type;
  if (type === "update_ready") {
    const requestUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration("./");
        const waiting = reg?.waiting;
        if (!waiting) {
          window.location.reload();
          return;
        }

        const reloadOnControl = () => {
          navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControl);
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", reloadOnControl);
        waiting.postMessage({ type: "SKIP_WAITING" });
      } catch (_error) {
        window.location.reload();
      }
    };

    showCard(
      `
        <div class="row">
          <div>
            <strong>Update ready</strong>
            <div class="meta">Reload to use the latest version.</div>
          </div>
          <button type="button" data-update="true">Update now</button>
        </div>
      `,
      { timeoutMs: null },
    );
    const button = toastRoot?.querySelector("[data-update]");
    button?.addEventListener("click", requestUpdate);
    return;
  }

  if (type === "offline_ready") {
    showCard(
      `
        <div class="row">
          <div>
            <strong>Offline ready</strong>
            <div class="meta">This page is cached for this browser.</div>
          </div>
        </div>
      `,
      { timeoutMs: 3500 },
    );
  }
}

export function initOfflineStatusToasts() {
  window.addEventListener("hc-sw-status", (event) => onStatus(event?.detail));
}

initOfflineStatusToasts();
