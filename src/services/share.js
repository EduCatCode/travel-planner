/**
 * 分享目前頁面。只分享網址與選中日期，不包含個人勾選狀態。
 * @module services/share
 */

/**
 * @param {{ origin: string, pathname: string }} location
 * @param {string | null} dayId
 * @param {string | null} [planId]
 * @returns {string}
 */
export const buildShareUrl = (location, dayId, planId = null) =>
  `${location.origin}${location.pathname}` +
  `${planId ? `?plan=${encodeURIComponent(planId)}` : ""}` +
  `${dayId ? `#${encodeURIComponent(dayId)}` : ""}`;

/** @returns {boolean} */
export const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 往下使用 fallback
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

/**
 * @param {{ title: string, url: string }} data
 * @returns {Promise<"shared" | "cancelled" | "failed">}
 */
export const nativeShare = async ({ title, url }) => {
  try {
    await navigator.share({ title, url });
    return "shared";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "failed";
  }
};
