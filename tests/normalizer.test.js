import { describe, it, expect } from "vitest";
import { normalizeTrip, sortItems } from "../src/data/normalizer.js";
import { deepFreeze, loadItinerary, ItineraryLoadError } from "../src/data/itinerary-loader.js";
import { summarizeBudget } from "../src/data/budget.js";
import { validDoc } from "./fixtures.js";

describe("normalizer", () => {
  it("依 startTime 排序，無時間項目放最後，且不修改原陣列", () => {
    const items = deepFreeze([
      { id: "n", type: "note", title: "提醒" },
      { id: "c", type: "activity", startTime: "15:00", title: "C" },
      { id: "a", type: "activity", startTime: "09:00", title: "A" },
      { id: "b", type: "meal", startTime: "09:00", title: "B" },
    ]);
    expect(sortItems(items).map((i) => i.id)).toEqual(["a", "b", "c", "n"]);
    expect(items.map((i) => i.id)).toEqual(["n", "c", "a", "b"]);
  });

  it("只有有座標的項目取得地圖序號", () => {
    const doc = validDoc();
    doc.days[0].items.unshift({ id: "z", type: "activity", startTime: "08:00", title: "Z", place: { name: "無座標" } });
    const model = normalizeTrip(deepFreeze(doc));
    expect(model.days[0].items.map((i) => [i.id, i.markerNumber])).toEqual([["z", null], ["a", 1], ["b", null]]);
    expect(model.days[0].number).toBe(1);
  });
});

describe("loadItinerary", () => {
  const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });
  it("回傳凍結的資料", async () => {
    const doc = await loadItinerary("x", { fetchImpl: ok(validDoc()) });
    expect(Object.isFrozen(doc.days[0].items)).toBe(true);
  });
  it("404 分類為 not-found", async () => {
    await expect(loadItinerary("x", { fetchImpl: async () => ({ ok: false, status: 404 }) }))
      .rejects.toMatchObject({ kind: "not-found" });
  });
  it("JSON 解析失敗分類為 parse", async () => {
    const bad = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } });
    await expect(loadItinerary("x", { fetchImpl: bad })).rejects.toMatchObject({ kind: "parse" });
  });
  it("驗證失敗分類為 invalid 並附錯誤", async () => {
    const doc = validDoc();
    delete doc.trip.title;
    const err = await loadItinerary("x", { fetchImpl: ok(doc) }).catch((e) => e);
    expect(err).toBeInstanceOf(ItineraryLoadError);
    expect(err.kind).toBe("invalid");
    expect(err.details.errors.length).toBeGreaterThan(0);
  });
  it("網路錯誤分類為 network", async () => {
    await expect(loadItinerary("x", { fetchImpl: async () => { throw new TypeError("offline"); } }))
      .rejects.toMatchObject({ kind: "network" });
  });
});

describe("summarizeBudget", () => {
  it("不同幣別分開加總，未知金額不當成 0", () => {
    const days = [{
      number: 1,
      items: [
        { title: "a", type: "meal", cost: { amount: 45, currency: "CAD", category: "meal" } },
        { title: "b", type: "meal", cost: { amount: 30.5, currency: "CAD", category: "meal" } },
        { title: "c", type: "lodging", cost: { amount: 200, currency: "CAD", category: "lodging" } },
        { title: "d", type: "note", cost: { amount: 18, currency: "USD", category: "other" } },
        { title: "e", type: "meal", cost: { amount: null, currency: "CAD", category: "meal", status: "unknown" } },
        { title: "f", type: "activity" },
      ],
    }];
    const s = summarizeBudget(days);
    expect(s.byCurrency).toEqual([
      { currency: "CAD", total: 275.5, categories: [{ category: "lodging", amount: 200 }, { category: "meal", amount: 75.5 }] },
      { currency: "USD", total: 18, categories: [{ category: "other", amount: 18 }] },
    ]);
    expect(s.unknown).toEqual([{ title: "e", dayNumber: 1 }]);
  });
});
