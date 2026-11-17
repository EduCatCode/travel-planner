import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validatePlanIndex, resolvePlanId, loadPlanIndex } from "../src/data/plan-index.js";
import { validateTripDocument } from "../src/data/schema-validator.js";
import { buildShareUrl } from "../src/services/share.js";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const plans = [{ id: "a", title: "A", file: "plan-a.json" }, { id: "b", title: "B", file: "plan-b.json" }];

describe("validatePlanIndex", () => {
  it("專案內的 plans/index.json 通過", () => {
    expect(validatePlanIndex(read("../public/data/plans/index.json")).errors).toEqual([]);
  });

  it("拒絕重複 id、非法 id 與可跳出資料夾的檔名", () => {
    const { valid, errors } = validatePlanIndex({
      tripId: "t",
      plans: [
        { id: "a", title: "A", file: "plan-a.json" },
        { id: "a", title: "A2", file: "plan-a2.json" },
        { id: "B!", title: "B", file: "../secret.json" },
      ],
    });
    expect(valid).toBe(false);
    expect(errors.map((e) => e.code)).toEqual(expect.arrayContaining(["DUPLICATE_ID", "INVALID_PLAN_ID", "INVALID_FILE"]));
  });

  it("缺少 tripId 或 plans 為空失敗", () => {
    expect(validatePlanIndex({ plans: plans }).errors[0].code).toBe("REQUIRED_STRING");
    expect(validatePlanIndex({ tripId: "t", plans: [] }).valid).toBe(false);
  });
});

describe("各方案資料", () => {
  const index = read("../public/data/plans/index.json");
  const docs = index.plans.map((p) => read(`../public/data/plans/${p.file}`));

  it.each(index.plans.map((p) => [p.file]))("%s 通過 Schema 驗證", (file) => {
    expect(validateTripDocument(read(`../public/data/plans/${file}`)).errors).toEqual([]);
  });

  it("所有方案的 trip.id 與 index.tripId 相同（清單勾選共用）", () => {
    for (const doc of docs) expect(doc.trip.id).toBe(index.tripId);
  });

  it("所有方案的 day id 相同（切換方案時停在同一天）", () => {
    const ids = docs.map((d) => d.days.map((day) => day.id).join(","));
    expect(new Set(ids).size).toBe(1);
  });

  it("加拿大範例（測試用）仍通過驗證", () => {
    expect(validateTripDocument(read("./fixtures/canada-itinerary.json")).errors).toEqual([]);
  });
});

describe("resolvePlanId", () => {
  it("網址 > 上次選擇 > 第一個方案", () => {
    expect(resolvePlanId(plans, "b", "a")).toBe("b");
    expect(resolvePlanId(plans, null, "b")).toBe("b");
    expect(resolvePlanId(plans, null, undefined)).toBe("a");
  });
  it("忽略不存在的 id", () => {
    expect(resolvePlanId(plans, "zzz", "b")).toBe("b");
    expect(resolvePlanId(plans, "zzz", 42)).toBe("a");
  });
});

describe("loadPlanIndex", () => {
  it("404 回傳 null（退回 itinerary.json）", async () => {
    expect(await loadPlanIndex("x", { fetchImpl: async () => ({ ok: false, status: 404 }) })).toBeNull();
  });
  it("網路錯誤回傳 null", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await loadPlanIndex("x", { fetchImpl: async () => { throw new TypeError("offline"); } })).toBeNull();
  });
  it("格式錯誤回傳 null", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = { ok: true, json: async () => ({ tripId: "t", plans: [] }) };
    expect(await loadPlanIndex("x", { fetchImpl: async () => res })).toBeNull();
  });
  it("合法時回傳清單", async () => {
    const res = { ok: true, json: async () => ({ schemaVersion: "1.0", tripId: "t", plans }) };
    expect((await loadPlanIndex("x", { fetchImpl: async () => res }))?.plans).toHaveLength(2);
  });
});

describe("buildShareUrl", () => {
  const loc = { origin: "https://u.github.io", pathname: "/travel-planner/" };
  it("包含方案與日期", () => {
    expect(buildShareUrl(loc, "day-03", "b")).toBe("https://u.github.io/travel-planner/?plan=b#day-03");
  });
  it("單一行程模式不帶 plan", () => {
    expect(buildShareUrl(loc, "day-02")).toBe("https://u.github.io/travel-planner/#day-02");
    expect(buildShareUrl(loc, null, null)).toBe("https://u.github.io/travel-planner/");
  });
});
