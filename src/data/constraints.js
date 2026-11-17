/**
 * 行程限制檢查。只產生 normal / warning / blocker，不修改資料。
 * @module data/constraints
 */

import { timeToMinutes } from "../utils/date.js";
import { DEFAULT_AFTERNOON_WINDOW, DRIVE_WARNING_RATIO } from "../config.js";

/** @typedef {"normal" | "warning" | "blocker"} CheckLevel */

/**
 * @param {number} driveMinutes
 * @param {number | undefined} maxMinutes
 * @returns {CheckLevel}
 */
export const evaluateDriveTime = (driveMinutes, maxMinutes) => {
  if (typeof maxMinutes !== "number" || maxMinutes <= 0) return "normal";
  if (driveMinutes > maxMinutes) return "blocker";
  if (driveMinutes >= maxMinutes * DRIVE_WARNING_RATIO) return "warning";
  return "normal";
};

/**
 * 計算下午窗口內 free-time 項目的總分鐘數（重疊部分合併計算）。
 * @param {readonly { type: string, startTime?: string, endTime?: string }[]} items
 * @param {{ start: string, end: string }} [window]
 * @returns {number}
 */
export const afternoonFreeMinutes = (items, window = DEFAULT_AFTERNOON_WINDOW) => {
  const ws = timeToMinutes(window.start);
  const we = timeToMinutes(window.end);
  if (ws === null || we === null) return 0;
  const ranges = items
    .filter((i) => i.type === "free-time")
    .map((i) => [timeToMinutes(i.startTime), timeToMinutes(i.endTime)])
    .filter(([s, e]) => s !== null && e !== null && e > s)
    .map(([s, e]) => [Math.max(s, ws), Math.min(e, we)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let cur = null;
  for (const [s, e] of ranges) {
    if (!cur || s > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [s, e];
    } else {
      cur[1] = Math.max(cur[1], e);
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
};

/**
 * 連續兩晚以上相同 baseCity 的住宿基地數量。
 * @param {readonly { baseCity: string }[]} days 已依日期排序
 * @returns {number}
 */
export const countTwoNightBases = (days) => {
  let count = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    if (day.baseCity === prev) {
      run += 1;
    } else {
      if (run >= 2) count += 1;
      prev = day.baseCity;
      run = 1;
    }
  }
  if (run >= 2) count += 1;
  return count;
};

/**
 * 已鎖定（已預訂／不可移動）卻缺少時間或說明的項目。
 * @param {readonly { locked?: boolean, startTime?: string, description?: string }[]} items
 * @returns {object[]}
 */
export const findIncompleteLockedItems = (items) =>
  items.filter((i) => i.locked === true && (!i.startTime || !i.description?.trim()));

/**
 * @typedef {{ id: string, level: CheckLevel, title: string, detail?: string }} CheckResult
 */

/**
 * 單日檢查。
 * @param {object} day normalized day
 * @param {object} [constraints]
 * @returns {{ drive: { level: CheckLevel, minutes: number, max?: number }, checks: CheckResult[] }}
 */
export const checkDay = (day, constraints = {}) => {
  const max = constraints.maxDailyDriveMinutes;
  const drive = { level: evaluateDriveTime(day.driveMinutes, max), minutes: day.driveMinutes, max };
  /** @type {CheckResult[]} */
  const checks = [];

  if (typeof constraints.minAfternoonFreeMinutes === "number" && constraints.minAfternoonFreeMinutes > 0) {
    const window = constraints.afternoonWindow ?? DEFAULT_AFTERNOON_WINDOW;
    const free = afternoonFreeMinutes(day.items, window);
    const ok = free >= constraints.minAfternoonFreeMinutes;
    checks.push({
      id: "afternoon-free",
      level: ok ? "normal" : "warning",
      title: ok ? "下午留白充足" : "下午留白不足",
      detail: `${window.start}–${window.end} 留白 ${free} 分鐘，建議至少 ${constraints.minAfternoonFreeMinutes} 分鐘`,
    });
  }

  const locked = findIncompleteLockedItems(day.items);
  if (locked.length > 0) {
    checks.push({
      id: "locked-incomplete",
      level: "warning",
      title: "已鎖定項目資訊不完整",
      detail: `${locked.map((i) => i.title).join("、")} 缺少時間或說明`,
    });
  }

  return { drive, checks };
};

/**
 * 全旅程檢查。
 * @param {readonly object[]} days
 * @param {object} [constraints]
 * @returns {CheckResult[]}
 */
export const checkTrip = (days, constraints = {}) => {
  /** @type {CheckResult[]} */
  const results = [];
  if (typeof constraints.minimumTwoNightBases === "number" && constraints.minimumTwoNightBases > 0) {
    const n = countTwoNightBases(days);
    const ok = n >= constraints.minimumTwoNightBases;
    results.push({
      id: "two-night-bases",
      level: ok ? "normal" : "warning",
      title: ok ? "連住安排達標" : "連住安排不足",
      detail: `連住兩晚以上的住宿基地 ${n} 個，目標 ${constraints.minimumTwoNightBases} 個`,
    });
  }
  if (typeof constraints.maxDailyDriveMinutes === "number") {
    const over = days.filter((d) => evaluateDriveTime(d.driveMinutes, constraints.maxDailyDriveMinutes) === "blocker");
    results.push({
      id: "drive-limit",
      level: over.length > 0 ? "blocker" : "normal",
      title: over.length > 0 ? `${over.length} 天駕車超過上限` : "每日駕車皆在上限內",
      detail: over.length > 0 ? over.map((d) => `第 ${d.number} 天`).join("、") : undefined,
    });
  }
  return results;
};
