/**
 * LocalStorage 包裝：依 Trip ID 分隔 namespace，失敗時退回記憶體。
 *
 * Keys:
 *   tripcanvas:{tripId}:selected-day
 *   tripcanvas:{tripId}:checklist
 *   tripcanvas:{tripId}:preferences
 *   tripcanvas:app-version
 *
 * 不保存精確位置、訂單編號或個資。
 * @module services/storage
 */

import { STORAGE_PREFIX } from "../config.js";

/**
 * @typedef {{ getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void }} StorageLike
 */

/** @returns {StorageLike} */
export const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
};

/**
 * 取得可用的 localStorage；隱私模式或被封鎖時回傳 null。
 * @returns {StorageLike | null}
 */
export const detectLocalStorage = () => {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = `${STORAGE_PREFIX}:probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
};

/**
 * 建立安全的 key-value store。寫入失敗（quota、privacy mode）時自動改用記憶體。
 * @param {StorageLike | null} [backend]
 */
export const createSafeStorage = (backend = detectLocalStorage()) => {
  const memory = createMemoryStorage();
  let primary = backend;
  let persistent = Boolean(backend);
  const listeners = new Set();

  const degrade = (error) => {
    if (!persistent) return;
    persistent = false;
    console.warn("[TripCanvas] LocalStorage 無法使用，改用記憶體暫存：", error);
    listeners.forEach((fn) => fn(false));
  };

  return {
    /** 目前資料是否會在重新整理後保留 */
    get persistent() {
      return persistent;
    },
    /** @param {(persistent: boolean) => void} fn */
    onChange(fn) {
      listeners.add(fn);
    },
    /**
     * @template T
     * @param {string} key
     * @param {T} fallback
     * @returns {T}
     */
    getJSON(key, fallback) {
      let raw = memory.getItem(key);
      if (raw === null && primary) {
        try {
          raw = primary.getItem(key);
        } catch (error) {
          degrade(error);
        }
      }
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        console.warn(`[TripCanvas] 無法解析 ${key}，已恢復預設值`);
        this.remove(key);
        return fallback;
      }
    },
    /**
     * @param {string} key
     * @param {unknown} value
     */
    setJSON(key, value) {
      const raw = JSON.stringify(value);
      if (persistent && primary) {
        try {
          primary.setItem(key, raw);
          return;
        } catch (error) {
          degrade(error);
        }
      }
      memory.setItem(key, raw);
    },
    /** @param {string} key */
    remove(key) {
      memory.removeItem(key);
      try {
        primary?.removeItem(key);
      } catch (error) {
        degrade(error);
      }
    },
  };
};

/**
 * @param {string} tripId
 * @param {string} name
 * @returns {string}
 */
export const tripKey = (tripId, name) => `${STORAGE_PREFIX}:${tripId}:${name}`;

/**
 * 單一 Trip 的狀態存取。
 * @param {string} tripId
 * @param {ReturnType<typeof createSafeStorage>} [storage]
 */
export const createTripStore = (tripId, storage = createSafeStorage()) => {
  const keys = {
    selectedDay: tripKey(tripId, "selected-day"),
    checklist: tripKey(tripId, "checklist"),
    preferences: tripKey(tripId, "preferences"),
  };

  /** @returns {Record<string, Record<string, boolean>>} */
  const readChecklist = () => {
    const value = storage.getJSON(keys.checklist, {});
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };

  return {
    storage,
    keys,
    /** @returns {string | null} */
    getSelectedDay() {
      const v = storage.getJSON(keys.selectedDay, null);
      return typeof v === "string" ? v : null;
    },
    /** @param {string} dayId */
    setSelectedDay(dayId) {
      storage.setJSON(keys.selectedDay, dayId);
    },
    /**
     * @param {string} listId
     * @returns {Record<string, boolean>}
     */
    getChecklist(listId) {
      const list = readChecklist()[listId];
      return list && typeof list === "object" ? { ...list } : {};
    },
    /**
     * @param {string} listId
     * @param {string} itemId
     * @param {boolean} checked
     */
    setChecklistItem(listId, itemId, checked) {
      const all = readChecklist();
      const list = { ...(all[listId] ?? {}) };
      if (checked) list[itemId] = true;
      else delete list[itemId];
      storage.setJSON(keys.checklist, { ...all, [listId]: list });
    },
    clearChecklists() {
      storage.remove(keys.checklist);
    },
    /** @returns {Record<string, unknown>} */
    getPreferences() {
      const v = storage.getJSON(keys.preferences, {});
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    },
    /** @param {Record<string, unknown>} prefs */
    setPreferences(prefs) {
      storage.setJSON(keys.preferences, { ...this.getPreferences(), ...prefs });
    },
  };
};

/**
 * 記錄 App 版本（用於未來的資料遷移）。
 * @param {string} version
 * @param {ReturnType<typeof createSafeStorage>} storage
 */
export const recordAppVersion = (version, storage) => {
  storage.setJSON(`${STORAGE_PREFIX}:app-version`, version);
};
