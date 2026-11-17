/**
 * 離線提示。離線時在 <html> 設定 data-offline，供 CSS 標示需要網路的按鈕。
 * @module components/offline-banner
 */

import { h, icon, replaceChildren, announce } from "../utils/dom.js";

/**
 * @param {HTMLElement} root
 * @returns {{ isOnline: () => boolean }}
 */
export const createOfflineBanner = (root) => {
  replaceChildren(root,
    h("p", { className: "banner__text" },
      icon("wifiOff"),
      h("span", {}, "目前離線：可查看最近載入的行程。導航、官網與地圖底圖需要網路。"),
    ),
  );

  const update = (online, { silent = false } = {}) => {
    root.hidden = online;
    document.documentElement.toggleAttribute("data-offline", !online);
    if (!silent) announce(online ? "已恢復網路連線" : "目前離線，顯示最近載入的行程");
  };

  window.addEventListener("online", () => update(true));
  window.addEventListener("offline", () => update(false));
  update(navigator.onLine !== false, { silent: true });

  return { isOnline: () => navigator.onLine !== false };
};
