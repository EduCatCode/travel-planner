/**
 * 日期與時間工具。所有 ISO 日期以 UTC 午夜處理，避免使用者時區造成位移。
 * @module utils/date
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export const isISODate = (value) => {
  if (typeof value !== "string") return false;
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
};

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {number} UTC 毫秒
 */
export const isoToUTC = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/**
 * b - a 的天數差。
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export const daysBetween = (a, b) =>
  Math.round((isoToUTC(b) - isoToUTC(a)) / DAY_MS);

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export const isTime = (value) => typeof value === "string" && HH_MM.test(value);

/**
 * "HH:mm" 轉為當日分鐘數；格式錯誤回傳 null。
 * @param {unknown} value
 * @returns {number | null}
 */
export const timeToMinutes = (value) => {
  if (!isTime(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

/**
 * 以 Intl 格式化 ISO 日期。
 * @param {string} iso
 * @param {string} locale
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string}
 */
export const formatDate = (iso, locale, options = {}) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    ...options,
  }).format(new Date(isoToUTC(iso)));

/**
 * 以 Intl 格式化日期區間，例如「2027/9/15 – 9/24」。
 * @param {string} start
 * @param {string} end
 * @param {string} locale
 * @returns {string}
 */
export const formatDateRange = (start, end, locale) => {
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const a = new Date(isoToUTC(start));
  const b = new Date(isoToUTC(end));
  return typeof fmt.formatRange === "function"
    ? fmt.formatRange(a, b)
    : `${fmt.format(a)} – ${fmt.format(b)}`;
};

/**
 * 分鐘數轉為可讀文字，例如 110 → 「1 小時 50 分」。
 * @param {number} minutes
 * @returns {string}
 */
export const formatDuration = (minutes) => {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} 分`;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分`;
};

/**
 * 取得指定 IANA 時區的「今天」（YYYY-MM-DD）。
 * @param {string} timeZone
 * @param {Date} [now]
 * @returns {string}
 */
export const todayInTimeZone = (timeZone, now = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
};

/**
 * @param {unknown} tz
 * @returns {boolean}
 */
export const isValidTimeZone = (tz) => {
  if (typeof tz !== "string" || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/**
 * @typedef {{ state: "upcoming" | "ongoing" | "ended", daysUntil: number, dayNumber: number }} TripStatus
 */

/**
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} today
 * @returns {TripStatus}
 */
export const getTripStatus = (startDate, endDate, today) => {
  const untilStart = daysBetween(today, startDate);
  if (untilStart > 0) return { state: "upcoming", daysUntil: untilStart, dayNumber: 0 };
  if (daysBetween(today, endDate) < 0) return { state: "ended", daysUntil: 0, dayNumber: 0 };
  return { state: "ongoing", daysUntil: 0, dayNumber: -untilStart + 1 };
};
