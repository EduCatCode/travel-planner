/**
 * 將驗證過的行程文件轉為畫面使用的 view model。
 * 不修改輸入資料：所有排序都在複製後的陣列上進行。
 * @module data/normalizer
 */

import { timeToMinutes } from "../utils/date.js";

/**
 * @typedef {object} NormalizedItem
 * @property {object} source 原始 item（唯讀）
 * @property {string} id
 * @property {number} index 當日排序後位置（0 起算）
 * @property {number | null} markerNumber 有座標時的地圖序號（1 起算）
 * @property {boolean} hasCoordinates
 */

/**
 * @param {unknown} place
 * @returns {boolean}
 */
export const hasValidCoordinates = (place) =>
  typeof place === "object" && place !== null &&
  typeof place.latitude === "number" && Number.isFinite(place.latitude) &&
  typeof place.longitude === "number" && Number.isFinite(place.longitude) &&
  place.latitude >= -90 && place.latitude <= 90 &&
  place.longitude >= -180 && place.longitude <= 180;

/**
 * 依規則排序：有時間者依 startTime 升冪（穩定排序），無時間者保持原順序放在最後。
 * 回傳新陣列，不修改輸入。
 * @template {{ startTime?: string }} T
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export const sortItems = (items) => {
  const decorated = items.map((item, i) => ({ item, i, t: timeToMinutes(item.startTime) }));
  decorated.sort((a, b) => {
    if (a.t === null && b.t === null) return a.i - b.i;
    if (a.t === null) return 1;
    if (b.t === null) return -1;
    return a.t - b.t || a.i - b.i;
  });
  return decorated.map((d) => d.item);
};

/**
 * @param {readonly object[]} items
 * @returns {NormalizedItem[]}
 */
export const normalizeItems = (items) => {
  let marker = 0;
  return sortItems(items).map((item, index) => {
    const hasCoordinates = hasValidCoordinates(item.place);
    return {
      ...item,
      source: item,
      index,
      hasCoordinates,
      markerNumber: hasCoordinates ? ++marker : null,
    };
  });
};

/**
 * @param {object} doc 已通過驗證的 TripDocument
 * @returns {object}
 */
export const normalizeTrip = (doc) => {
  const days = [...doc.days]
    .map((day, originalIndex) => ({ day, originalIndex }))
    .sort((a, b) => (a.day.date < b.day.date ? -1 : a.day.date > b.day.date ? 1 : a.originalIndex - b.originalIndex))
    .map(({ day }, index) => ({
      ...day,
      index,
      number: index + 1,
      notes: day.notes ?? [],
      items: normalizeItems(day.items ?? []),
    }));

  return {
    schemaVersion: doc.schemaVersion,
    trip: doc.trip,
    travelers: doc.travelers ?? [],
    days,
    checklists: doc.checklists ?? [],
    sources: doc.sources ?? [],
  };
};
