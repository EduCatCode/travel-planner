/**
 * 多方案清單（public/data/plans/index.json）。
 * 讀不到或格式錯誤時回傳 null，由呼叫端退回讀取 itinerary.json。
 * @module data/plan-index
 */

/**
 * @typedef {{ id: string, title: string, shortTitle?: string, description?: string, file: string }} PlanEntry
 * @typedef {{ schemaVersion: string, tripId: string, plans: PlanEntry[] }} PlanIndex
 */

const PLAN_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const PLAN_FILE = /^[a-z0-9][a-z0-9-]*\.json$/;

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

/**
 * @param {unknown} value
 * @returns {{ valid: boolean, errors: import("./schema-validator.js").ValidationError[] }}
 */
export const validatePlanIndex = (value) => {
  const errors = [];
  const add = (path, code, message) => errors.push({ path, code, message });

  if (!isObject(value)) {
    add("$", "INVALID_ROOT", "方案清單必須是 JSON 物件");
    return { valid: false, errors };
  }
  if (!isNonEmptyString(value.tripId)) add("$.tripId", "REQUIRED_STRING", "tripId 必須是非空字串");
  if (!Array.isArray(value.plans) || value.plans.length === 0) {
    add("$.plans", "REQUIRED_ARRAY", "plans 必須是至少一個方案的陣列");
    return { valid: false, errors };
  }

  const ids = new Set();
  value.plans.forEach((plan, i) => {
    const p = `$.plans[${i}]`;
    if (!isObject(plan)) return add(p, "INVALID_TYPE", "方案必須是物件");
    if (typeof plan.id !== "string" || !PLAN_ID.test(plan.id)) {
      add(`${p}.id`, "INVALID_PLAN_ID", "id 只能使用小寫英文、數字與連字號，例如 a、b、slow-trip");
    } else if (ids.has(plan.id)) {
      add(`${p}.id`, "DUPLICATE_ID", `方案 id 重複：${plan.id}`);
    } else {
      ids.add(plan.id);
    }
    if (!isNonEmptyString(plan.title)) add(`${p}.title`, "REQUIRED_STRING", "title 必須是非空字串");
    if (typeof plan.file !== "string" || !PLAN_FILE.test(plan.file)) {
      add(`${p}.file`, "INVALID_FILE", "file 必須是同資料夾內的 .json 檔名，例如 plan-a.json");
    }
    for (const key of ["shortTitle", "description"]) {
      if (plan[key] !== undefined && typeof plan[key] !== "string") add(`${p}.${key}`, "INVALID_TYPE", `${key} 必須是字串`);
    }
  });

  return { valid: errors.length === 0, errors };
};

/**
 * 決定要顯示的方案：網址 > 上次選擇 > 第一個方案。不存在的 id 會被忽略。
 * @param {PlanEntry[]} plans
 * @param {string | null | undefined} fromUrl
 * @param {unknown} stored
 * @returns {string}
 */
export const resolvePlanId = (plans, fromUrl, stored) => {
  const exists = (id) => typeof id === "string" && plans.some((p) => p.id === id);
  if (exists(fromUrl)) return /** @type {string} */ (fromUrl);
  if (exists(stored)) return /** @type {string} */ (stored);
  return plans[0].id;
};

/**
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<PlanIndex | null>}
 */
export const loadPlanIndex = async (url, { fetchImpl = globalThis.fetch } = {}) => {
  try {
    const res = await fetchImpl(url, { cache: "no-cache", headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = await res.json();
    const { valid, errors } = validatePlanIndex(json);
    if (!valid) {
      console.warn("[TripCanvas] plans/index.json 格式有誤，改用 itinerary.json：", errors);
      return null;
    }
    return json;
  } catch (error) {
    console.info("[TripCanvas] 沒有方案清單，使用 itinerary.json：", error);
    return null;
  }
};
