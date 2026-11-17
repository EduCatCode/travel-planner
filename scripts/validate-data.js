#!/usr/bin/env node
/**
 * 驗證行程資料。
 *   npm run validate:data                 驗證 itinerary.json 與 plans/ 內所有方案
 *   npm run validate:data -- path.json    只驗證指定檔案
 */
import { readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { validateTripDocument } from "../src/data/schema-validator.js";
import { validatePlanIndex } from "../src/data/plan-index.js";

const DATA_DIR = "public/data";
let failed = false;

const fail = (message, errors = []) => {
  failed = true;
  console.error(`✗ ${message}`);
  for (const e of errors) console.error(`    [${e.code}] ${e.path}：${e.message}`);
};

const readJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    fail(`無法讀取或解析 ${file}：${error.message}`);
    return null;
  }
};

/** @returns {Promise<object | null>} */
const checkItinerary = async (file) => {
  const json = await readJson(file);
  if (!json) return null;
  const { valid, errors } = validateTripDocument(json);
  if (!valid) {
    fail(`${file} 有 ${errors.length} 項錯誤：`, errors);
    return null;
  }
  console.log(`✓ ${file} 符合 TripCanvas Schema（${json.days.length} 天）`);
  return json;
};

const exists = (file) => access(file).then(() => true, () => false);

const explicit = process.argv[2];
if (explicit) {
  await checkItinerary(explicit);
} else {
  await checkItinerary(join(DATA_DIR, "itinerary.json"));

  const indexFile = join(DATA_DIR, "plans", "index.json");
  if (await exists(indexFile)) {
    const index = await readJson(indexFile);
    const { valid, errors } = index ? validatePlanIndex(index) : { valid: false, errors: [] };
    if (index && !valid) fail(`${indexFile} 有 ${errors.length} 項錯誤：`, errors);
    if (index && valid) {
      console.log(`✓ ${indexFile}（${index.plans.length} 個方案）`);
      let firstDayIds = null;
      for (const plan of index.plans) {
        const file = join(DATA_DIR, "plans", plan.file);
        const doc = await checkItinerary(file);
        if (!doc) continue;
        if (doc.trip.id !== index.tripId) {
          fail(`${file}：trip.id「${doc.trip.id}」與 index.json 的 tripId「${index.tripId}」不同，切換方案時清單勾選不會共用`);
        }
        const dayIds = doc.days.map((d) => d.id).join(",");
        if (firstDayIds === null) firstDayIds = dayIds;
        else if (dayIds !== firstDayIds) {
          console.warn(`! ${file}：day id 與第一個方案不同，切換方案時可能無法停在同一天`);
        }
      }
    }
  }
}

if (failed) process.exitCode = 1;
