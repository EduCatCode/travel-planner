/**
 * Google Maps 導航 URL（不需要 API Key）。
 * @module services/navigation
 */

import { safeGoogleMapsUrl } from "../utils/sanitize.js";

/**
 * 座標格式化：最多 6 位小數，移除多餘的 0。
 * @param {number} n
 * @returns {string}
 */
const fmt = (n) => String(Number(n.toFixed(6)));

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 * @throws {TypeError} 座標型別或範圍不合法時
 */
export const createGoogleMapsDirectionsUrl = (latitude, longitude) => {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new TypeError(`Invalid latitude: ${String(latitude)}`);
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new TypeError(`Invalid longitude: ${String(longitude)}`);
  }
  const destination = encodeURIComponent(`${fmt(latitude)},${fmt(longitude)}`).replace(/%2C/g, ",");
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

/**
 * 取得地點的導航網址：座標優先產生 directions URL，否則使用安全的 googleMapsUrl。
 * 兩者皆不可用時回傳 null，呼叫端不顯示按鈕。
 * @param {{ latitude?: number, longitude?: number, googleMapsUrl?: string } | undefined} place
 * @returns {string | null}
 */
export const getNavigationUrl = (place) => {
  if (!place) return null;
  try {
    return createGoogleMapsDirectionsUrl(place.latitude, place.longitude);
  } catch {
    return safeGoogleMapsUrl(place.googleMapsUrl);
  }
};
