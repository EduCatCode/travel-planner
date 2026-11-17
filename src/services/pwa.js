/**
 * Service Worker 註冊與更新提示。新版本只提示，不會靜默刷新頁面。
 * @module services/pwa
 */

/**
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.scope
 * @param {(apply: () => void) => void} options.onUpdateReady 新版已安裝，呼叫 apply 才會套用並重新載入
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export const registerServiceWorker = async ({ url, scope, onUpdateReady }) => {
  if (!("serviceWorker" in navigator)) {
    console.info("[TripCanvas] 此瀏覽器不支援 Service Worker，離線功能停用");
    return null;
  }

  let userAccepted = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (userAccepted) window.location.reload();
  });

  const promptFor = (worker) => {
    onUpdateReady(() => {
      userAccepted = true;
      worker.postMessage({ type: "SKIP_WAITING" });
    });
  };

  try {
    const registration = await navigator.serviceWorker.register(url, { scope });

    // 已有等待中的新版本（例如上次未套用）
    if (registration.waiting && navigator.serviceWorker.controller) {
      promptFor(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // 有 controller 代表這是更新，而不是第一次安裝
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          promptFor(worker);
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn("[TripCanvas] Service Worker 註冊失敗，網站仍可線上使用：", error);
    return null;
  }
};
