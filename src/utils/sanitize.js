/**
 * URL 安全檢查。JSON 內容一律以 textContent 輸出，此模組只處理 URL。
 * @module utils/sanitize
 */

/**
 * 僅接受 https: 的絕對網址。
 * @param {unknown} value
 * @returns {string | null}
 */
export const safeHttpsUrl = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

/**
 * 圖片來源：允許 https 或站內相對路徑（./、../ 或不含 scheme 的路徑）。
 * 拒絕 javascript:、data:、// 開頭的 protocol-relative 網址。
 * @param {unknown} value
 * @returns {string | null}
 */
export const safeImageSrc = (value) => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const v = value.trim();
  if (v.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return safeHttpsUrl(v);
  if (v.startsWith("/")) return null; // 根目錄絕對路徑在 repository 子路徑下會 404
  return v;
};

const GOOGLE_MAPS_HOSTS = new Set(["www.google.com", "google.com", "maps.google.com"]);

/**
 * 只接受 Google Maps 官方網域的 https 連結。
 * @param {unknown} value
 * @returns {string | null}
 */
export const safeGoogleMapsUrl = (value) => {
  const href = safeHttpsUrl(value);
  if (!href) return null;
  const url = new URL(href);
  if (url.hostname === "maps.app.goo.gl") return href;
  if (GOOGLE_MAPS_HOSTS.has(url.hostname) && url.pathname.startsWith("/maps")) return href;
  return null;
};
