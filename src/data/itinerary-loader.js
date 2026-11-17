/**
 * 載入並驗證行程 JSON。
 * @module data/itinerary-loader
 */

import { validateTripDocument } from "./schema-validator.js";

/** 載入失敗的分類，供畫面顯示不同訊息。 */
export class ItineraryLoadError extends Error {
  /**
   * @param {"not-found" | "network" | "parse" | "invalid"} kind
   * @param {string} message
   * @param {object} [details]
   */
  constructor(kind, message, details = {}) {
    super(message);
    this.name = "ItineraryLoadError";
    this.kind = kind;
    this.details = details;
  }
}

/**
 * 遞迴凍結，避免畫面程式意外修改資料。
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
export const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
};

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<object>} 已驗證、已凍結的 TripDocument
 */
export const loadItinerary = async (url, { fetchImpl = globalThis.fetch } = {}) => {
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-cache", headers: { Accept: "application/json" } });
  } catch (error) {
    throw new ItineraryLoadError("network", "無法連線取得行程資料", { url, cause: String(error) });
  }

  if (!response.ok) {
    throw new ItineraryLoadError(
      response.status === 404 ? "not-found" : "network",
      `HTTP ${response.status}`,
      { url, status: response.status },
    );
  }

  let json;
  try {
    json = await response.json();
  } catch (error) {
    throw new ItineraryLoadError("parse", "JSON 解析失敗", { url, cause: String(error) });
  }

  const { valid, errors } = validateTripDocument(json);
  if (!valid) {
    throw new ItineraryLoadError("invalid", "行程資料驗證失敗", { url, errors });
  }

  return deepFreeze(structuredClone(json));
};
