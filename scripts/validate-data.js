#!/usr/bin/env node
/**
 * 在命令列驗證 itinerary.json：npm run validate:data [-- path/to/file.json]
 */
import { readFile } from "node:fs/promises";
import { validateTripDocument } from "../src/data/schema-validator.js";

const file = process.argv[2] ?? "public/data/itinerary.json";

try {
  const json = JSON.parse(await readFile(file, "utf8"));
  const { valid, errors } = validateTripDocument(json);
  if (valid) {
    console.log(`✓ ${file} 符合 TripCanvas Schema（${json.days.length} 天）`);
  } else {
    console.error(`✗ ${file} 有 ${errors.length} 項錯誤：`);
    for (const e of errors) console.error(`  [${e.code}] ${e.path}：${e.message}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`✗ 無法讀取或解析 ${file}：${error.message}`);
  process.exitCode = 1;
}
