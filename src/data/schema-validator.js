/**
 * 行程 JSON Schema 驗證。回傳所有錯誤，而非只回傳第一個。
 * @module data/schema-validator
 */

import { isISODate, isTime, timeToMinutes, isValidTimeZone, isoToUTC } from "../utils/date.js";
import { isCurrencyCode } from "../utils/currency.js";
import { safeHttpsUrl, safeImageSrc } from "../utils/sanitize.js";

/**
 * @typedef {{ path: string, code: string, message: string }} ValidationError
 */

const ITEM_TYPES = new Set(["activity", "meal", "lodging", "transport", "free-time", "note"]);
const TRANSPORT_MODES = new Set(["drive", "transit", "walk", "mixed"]);
const COST_STATUS = new Set(["estimated", "confirmed", "paid", "unknown"]);
const BOOKING_STATUS = new Set(["confirmed", "pending", "not-required"]);
const CHECKLIST_SCOPES = new Set(["trip", "day"]);

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isFiniteNumber = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * @param {unknown} value
 * @returns {{ valid: boolean, errors: ValidationError[] }}
 */
export const validateTripDocument = (value) => {
  /** @type {ValidationError[]} */
  const errors = [];
  const add = (path, code, message) => errors.push({ path, code, message });

  const requireString = (obj, key, path) => {
    if (!isNonEmptyString(obj?.[key])) add(`${path}.${key}`, "REQUIRED_STRING", `${key} 必須是非空字串`);
  };
  const optionalString = (obj, key, path) => {
    if (obj?.[key] !== undefined && typeof obj[key] !== "string") {
      add(`${path}.${key}`, "INVALID_TYPE", `${key} 必須是字串`);
    }
  };
  const optionalHttps = (obj, key, path) => {
    if (obj?.[key] !== undefined && !safeHttpsUrl(obj[key])) {
      add(`${path}.${key}`, "INVALID_URL", `${key} 只接受 https: 網址`);
    }
  };
  const optionalImage = (obj, key, path) => {
    if (obj?.[key] !== undefined && !safeImageSrc(obj[key])) {
      add(`${path}.${key}`, "INVALID_IMAGE", `${key} 必須是相對路徑或 https: 網址`);
    }
  };
  const optionalStringArray = (obj, key, path) => {
    const v = obj?.[key];
    if (v === undefined) return;
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) {
      add(`${path}.${key}`, "INVALID_TYPE", `${key} 必須是字串陣列`);
    }
  };

  if (!isObject(value)) {
    add("$", "INVALID_ROOT", "行程資料必須是 JSON 物件");
    return { valid: false, errors };
  }

  if (!isNonEmptyString(value.schemaVersion)) {
    add("$.schemaVersion", "REQUIRED_STRING", "schemaVersion 必須是非空字串");
  } else if (!value.schemaVersion.startsWith("1.")) {
    add("$.schemaVersion", "UNSUPPORTED_VERSION", `不支援的 schemaVersion：${value.schemaVersion}`);
  }

  for (const key of ["travelers", "checklists", "sources"]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) {
      add(`$.${key}`, "INVALID_TYPE", `${key} 必須是陣列`);
    }
  }

  // ---------- sources ----------
  const sourceIds = new Set();
  if (Array.isArray(value.sources)) {
    value.sources.forEach((src, i) => {
      const p = `$.sources[${i}]`;
      if (!isObject(src)) return add(p, "INVALID_TYPE", "source 必須是物件");
      requireString(src, "id", p);
      requireString(src, "title", p);
      optionalHttps(src, "url", p);
      if (src.accessedAt !== undefined && !isISODate(src.accessedAt)) {
        add(`${p}.accessedAt`, "INVALID_DATE", "accessedAt 必須是 YYYY-MM-DD");
      }
      if (isNonEmptyString(src.id)) {
        if (sourceIds.has(src.id)) add(`${p}.id`, "DUPLICATE_ID", `source id 重複：${src.id}`);
        sourceIds.add(src.id);
      }
    });
  }

  // ---------- trip ----------
  const trip = value.trip;
  let tripRange = null;
  if (!isObject(trip)) {
    add("$.trip", "REQUIRED_OBJECT", "trip 必須是物件");
  } else {
    const p = "$.trip";
    requireString(trip, "id", p);
    requireString(trip, "title", p);
    optionalString(trip, "subtitle", p);
    optionalImage(trip, "coverImage", p);

    const startOk = isISODate(trip.startDate);
    const endOk = isISODate(trip.endDate);
    if (!startOk) add(`${p}.startDate`, "INVALID_DATE", "startDate 必須是 YYYY-MM-DD");
    if (!endOk) add(`${p}.endDate`, "INVALID_DATE", "endDate 必須是 YYYY-MM-DD");
    if (startOk && endOk) {
      if (isoToUTC(trip.endDate) < isoToUTC(trip.startDate)) {
        add(`${p}.endDate`, "END_BEFORE_START", "endDate 不得早於 startDate");
      } else {
        tripRange = [isoToUTC(trip.startDate), isoToUTC(trip.endDate)];
      }
    }
    if (!isValidTimeZone(trip.timezone)) {
      add(`${p}.timezone`, "INVALID_TIMEZONE", "timezone 必須是 IANA 時區，例如 America/Vancouver");
    }
    if (!isCurrencyCode(trip.currency)) {
      add(`${p}.currency`, "INVALID_CURRENCY", "currency 必須是三碼大寫 ISO 4217，例如 CAD");
    }
    requireString(trip, "locale", p);
    if (!TRANSPORT_MODES.has(trip.transportMode)) {
      add(`${p}.transportMode`, "INVALID_ENUM", "transportMode 必須是 drive、transit、walk 或 mixed");
    }

    if (trip.constraints !== undefined) {
      const c = trip.constraints;
      const cp = `${p}.constraints`;
      if (!isObject(c)) {
        add(cp, "INVALID_TYPE", "constraints 必須是物件");
      } else {
        for (const key of ["maxDailyDriveMinutes", "minAfternoonFreeMinutes", "minimumTwoNightBases"]) {
          if (c[key] !== undefined && !(isFiniteNumber(c[key]) && c[key] >= 0)) {
            add(`${cp}.${key}`, "INVALID_NUMBER", `${key} 必須是大於等於 0 的數字`);
          }
        }
        if (c.afternoonWindow !== undefined) {
          const w = c.afternoonWindow;
          if (!isObject(w) || !isTime(w.start) || !isTime(w.end)) {
            add(`${cp}.afternoonWindow`, "INVALID_TIME", "afternoonWindow 需包含 HH:mm 格式的 start 與 end");
          } else if (timeToMinutes(w.end) <= timeToMinutes(w.start)) {
            add(`${cp}.afternoonWindow.end`, "END_BEFORE_START", "afternoonWindow.end 必須晚於 start");
          }
        }
        optionalStringArray(c, "interests", cp);
      }
    }
  }

  // ---------- days ----------
  if (!Array.isArray(value.days)) {
    add("$.days", "REQUIRED_ARRAY", "days 必須是陣列");
  } else {
    const dayIds = new Set();
    const itemIds = new Set();
    value.days.forEach((day, di) => {
      const p = `$.days[${di}]`;
      if (!isObject(day)) return add(p, "INVALID_TYPE", "day 必須是物件");
      requireString(day, "id", p);
      requireString(day, "title", p);
      requireString(day, "baseCity", p);
      optionalString(day, "summary", p);
      optionalString(day, "weatherNote", p);
      optionalStringArray(day, "notes", p);

      if (isNonEmptyString(day.id)) {
        if (dayIds.has(day.id)) add(`${p}.id`, "DUPLICATE_ID", `day id 重複：${day.id}`);
        dayIds.add(day.id);
      }
      if (!isISODate(day.date)) {
        add(`${p}.date`, "INVALID_DATE", "date 必須是 YYYY-MM-DD");
      } else if (tripRange) {
        const t = isoToUTC(day.date);
        if (t < tripRange[0] || t > tripRange[1]) {
          add(`${p}.date`, "DATE_OUT_OF_RANGE", `${day.date} 不在旅行日期範圍內`);
        }
      }
      if (!(isFiniteNumber(day.driveMinutes) && day.driveMinutes >= 0)) {
        add(`${p}.driveMinutes`, "INVALID_NUMBER", "driveMinutes 必須是大於等於 0 的數字");
      }
      if (day.distanceKm !== undefined && !(isFiniteNumber(day.distanceKm) && day.distanceKm >= 0)) {
        add(`${p}.distanceKm`, "INVALID_NUMBER", "distanceKm 必須是大於等於 0 的數字");
      }
      if (!Array.isArray(day.items)) {
        add(`${p}.items`, "REQUIRED_ARRAY", "items 必須是陣列");
        return;
      }
      day.items.forEach((item, ii) => validateItem(item, `${p}.items[${ii}]`, itemIds, sourceIds, add, {
        requireString, optionalString, optionalHttps, optionalImage, optionalStringArray,
      }));
    });
  }

  // ---------- checklists ----------
  if (Array.isArray(value.checklists)) {
    const listIds = new Set();
    value.checklists.forEach((list, li) => {
      const p = `$.checklists[${li}]`;
      if (!isObject(list)) return add(p, "INVALID_TYPE", "checklist 必須是物件");
      requireString(list, "id", p);
      requireString(list, "title", p);
      if (list.scope !== undefined && !CHECKLIST_SCOPES.has(list.scope)) {
        add(`${p}.scope`, "INVALID_ENUM", "scope 必須是 trip 或 day");
      }
      if (isNonEmptyString(list.id)) {
        if (listIds.has(list.id)) add(`${p}.id`, "DUPLICATE_ID", `checklist id 重複：${list.id}`);
        listIds.add(list.id);
      }
      if (!Array.isArray(list.items)) {
        add(`${p}.items`, "REQUIRED_ARRAY", "items 必須是陣列");
        return;
      }
      const ids = new Set();
      list.items.forEach((entry, ei) => {
        const ep = `${p}.items[${ei}]`;
        if (!isObject(entry)) return add(ep, "INVALID_TYPE", "清單項目必須是物件");
        requireString(entry, "id", ep);
        requireString(entry, "label", ep);
        optionalString(entry, "category", ep);
        if (entry.required !== undefined && typeof entry.required !== "boolean") {
          add(`${ep}.required`, "INVALID_TYPE", "required 必須是布林值");
        }
        if (isNonEmptyString(entry.id)) {
          if (ids.has(entry.id)) add(`${ep}.id`, "DUPLICATE_ID", `清單項目 id 重複：${entry.id}`);
          ids.add(entry.id);
        }
      });
    });
  }

  return { valid: errors.length === 0, errors };
};

/**
 * @param {unknown} item
 * @param {string} p
 * @param {Set<string>} itemIds
 * @param {Set<string>} sourceIds
 * @param {(path: string, code: string, message: string) => void} add
 * @param {Record<string, Function>} h
 */
const validateItem = (item, p, itemIds, sourceIds, add, h) => {
  if (!isObject(item)) return add(p, "INVALID_TYPE", "item 必須是物件");
  h.requireString(item, "id", p);
  h.requireString(item, "title", p);
  h.optionalString(item, "description", p);
  h.optionalStringArray(item, "tags", p);
  h.optionalStringArray(item, "sourceIds", p);

  if (isNonEmptyString(item.id)) {
    if (itemIds.has(item.id)) add(`${p}.id`, "DUPLICATE_ID", `item id 重複：${item.id}`);
    itemIds.add(item.id);
  }
  if (!ITEM_TYPES.has(item.type)) {
    add(`${p}.type`, "INVALID_ENUM", "type 必須是 activity、meal、lodging、transport、free-time 或 note");
  }
  if (item.startTime !== undefined && !isTime(item.startTime)) {
    add(`${p}.startTime`, "INVALID_TIME", "startTime 必須是 HH:mm");
  }
  if (item.endTime !== undefined && !isTime(item.endTime)) {
    add(`${p}.endTime`, "INVALID_TIME", "endTime 必須是 HH:mm");
  }
  if (isTime(item.startTime) && isTime(item.endTime) &&
      timeToMinutes(item.endTime) <= timeToMinutes(item.startTime)) {
    add(`${p}.endTime`, "END_BEFORE_START", "endTime 必須晚於 startTime");
  }
  if (item.locked !== undefined && typeof item.locked !== "boolean") {
    add(`${p}.locked`, "INVALID_TYPE", "locked 必須是布林值");
  }
  if (Array.isArray(item.sourceIds)) {
    for (const id of item.sourceIds) {
      if (typeof id === "string" && !sourceIds.has(id)) {
        add(`${p}.sourceIds`, "UNKNOWN_SOURCE", `找不到 source：${id}`);
      }
    }
  }

  if (item.place !== undefined) {
    const pl = item.place;
    const pp = `${p}.place`;
    if (!isObject(pl)) {
      add(pp, "INVALID_TYPE", "place 必須是物件");
    } else {
      h.requireString(pl, "name", pp);
      h.optionalString(pl, "address", pp);
      const hasLat = pl.latitude !== undefined;
      const hasLng = pl.longitude !== undefined;
      if (hasLat !== hasLng) {
        add(pp, "INCOMPLETE_COORDINATES", "latitude 與 longitude 必須同時提供");
      }
      if (hasLat && !(isFiniteNumber(pl.latitude) && pl.latitude >= -90 && pl.latitude <= 90)) {
        add(`${pp}.latitude`, "INVALID_COORDINATE", "latitude 必須介於 -90 至 90");
      }
      if (hasLng && !(isFiniteNumber(pl.longitude) && pl.longitude >= -180 && pl.longitude <= 180)) {
        add(`${pp}.longitude`, "INVALID_COORDINATE", "longitude 必須介於 -180 至 180");
      }
      h.optionalHttps(pl, "googleMapsUrl", pp);
      h.optionalHttps(pl, "websiteUrl", pp);
      h.optionalImage(pl, "image", pp);
      if (pl.lastVerifiedAt !== undefined && !isISODate(pl.lastVerifiedAt)) {
        add(`${pp}.lastVerifiedAt`, "INVALID_DATE", "lastVerifiedAt 必須是 YYYY-MM-DD");
      }
    }
  }

  if (item.cost !== undefined) {
    const c = item.cost;
    const cp = `${p}.cost`;
    if (!isObject(c)) {
      add(cp, "INVALID_TYPE", "cost 必須是物件");
    } else {
      if (c.amount !== undefined && c.amount !== null && !(isFiniteNumber(c.amount) && c.amount >= 0)) {
        add(`${cp}.amount`, "INVALID_NUMBER", "amount 必須是大於等於 0 的數字或 null");
      }
      if (!isCurrencyCode(c.currency)) {
        add(`${cp}.currency`, "INVALID_CURRENCY", "currency 必須是三碼大寫 ISO 4217");
      }
      if (c.status !== undefined && !COST_STATUS.has(c.status)) {
        add(`${cp}.status`, "INVALID_ENUM", "status 必須是 estimated、confirmed、paid 或 unknown");
      }
      h.optionalString(c, "category", cp);
    }
  }

  if (item.booking !== undefined) {
    const b = item.booking;
    const bp = `${p}.booking`;
    if (!isObject(b)) {
      add(bp, "INVALID_TYPE", "booking 必須是物件");
    } else {
      if (b.status !== undefined && !BOOKING_STATUS.has(b.status)) {
        add(`${bp}.status`, "INVALID_ENUM", "status 必須是 confirmed、pending 或 not-required");
      }
      h.optionalString(b, "provider", bp);
      h.optionalString(b, "note", bp);
    }
  }
};

/**
 * 將錯誤整理為可閱讀的摘要（最多 limit 筆）。
 * @param {ValidationError[]} errors
 * @param {number} [limit]
 * @returns {string[]}
 */
export const summarizeErrors = (errors, limit = 5) => {
  const lines = errors.slice(0, limit).map((e) => `${e.path}：${e.message}`);
  if (errors.length > limit) lines.push(`另有 ${errors.length - limit} 項錯誤，請查看瀏覽器 Console。`);
  return lines;
};
