/**
 * 全域設定。BASE_URL 由 Vite 依 vite.config.js 的 base 注入，
 * 因此網站部署在 https://{user}.github.io/{repo}/ 子路徑時路徑仍正確。
 * @module config
 */

const BASE = import.meta.env?.BASE_URL ?? "./";

export const APP_VERSION = "1.0.0";
export const DATA_URL = `${BASE}data/itinerary.json`;
export const SERVICE_WORKER_URL = `${BASE}service-worker.js`;
export const SERVICE_WORKER_SCOPE = BASE;
export const PLACEHOLDER_IMAGE = `${BASE}images/placeholders/place.svg`;

export const STORAGE_PREFIX = "tripcanvas";

/** 超過此天數的 lastVerifiedAt 會提示「建議重新確認」。 */
export const STALE_AFTER_DAYS = 90;

/** 駕車時間達上限此比例即顯示 Warning。 */
export const DRIVE_WARNING_RATIO = 0.8;

export const DEFAULT_AFTERNOON_WINDOW = Object.freeze({ start: "13:00", end: "17:00" });

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

/** @type {Record<string, { label: string, icon: string }>} */
export const ITEM_TYPES = Object.freeze({
  activity: { label: "景點／活動", icon: "camera" },
  meal: { label: "餐飲", icon: "utensils" },
  lodging: { label: "住宿", icon: "bed" },
  transport: { label: "交通", icon: "car" },
  "free-time": { label: "留白", icon: "coffee" },
  note: { label: "提醒", icon: "info" },
});

export const TRANSPORT_MODES = Object.freeze({
  drive: "自駕",
  transit: "大眾運輸",
  walk: "步行",
  mixed: "混合交通",
});

export const COST_STATUS = Object.freeze({
  estimated: "預估",
  confirmed: "已確認",
  paid: "已付款",
  unknown: "未知",
});

export const COST_CATEGORIES = Object.freeze({
  activity: "景點／活動",
  meal: "餐飲",
  lodging: "住宿",
  transport: "交通",
  fuel: "油資",
  ticket: "門票",
  shopping: "購物",
  other: "其他",
});

export const BOOKING_STATUS = Object.freeze({
  confirmed: "已預訂",
  pending: "待預訂",
  "not-required": "免預訂",
});
