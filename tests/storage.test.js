import { describe, it, expect, vi } from "vitest";
import { createSafeStorage, createTripStore, createMemoryStorage, tripKey } from "../src/services/storage.js";

describe("storage", () => {
  it("使用規格定義的 key namespace", () => {
    const store = createTripStore("trip-a", createSafeStorage(createMemoryStorage()));
    expect(store.keys).toEqual({
      selectedDay: "tripcanvas:trip-a:selected-day",
      checklist: "tripcanvas:trip-a:checklist",
      preferences: "tripcanvas:trip-a:preferences",
    });
  });

  it("LocalStorage 壞 JSON 可恢復預設值", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const backend = createMemoryStorage();
    backend.setItem(tripKey("trip-a", "checklist"), "{not json");
    backend.setItem(tripKey("trip-a", "selected-day"), "\"day-02");
    const store = createTripStore("trip-a", createSafeStorage(backend));
    expect(store.getChecklist("packing")).toEqual({});
    expect(store.getSelectedDay()).toBeNull();
    // 壞資料已被清除，之後可正常寫入
    store.setChecklistItem("packing", "passport", true);
    expect(store.getChecklist("packing")).toEqual({ passport: true });
  });

  it("不同 Trip ID 的 checklist 不互相污染", () => {
    const shared = createSafeStorage(createMemoryStorage());
    const a = createTripStore("trip-a", shared);
    const b = createTripStore("trip-b", shared);
    a.setChecklistItem("packing", "passport", true);
    a.setSelectedDay("day-03");
    expect(b.getChecklist("packing")).toEqual({});
    expect(b.getSelectedDay()).toBeNull();
    b.clearChecklists();
    expect(a.getChecklist("packing")).toEqual({ passport: true });
  });

  it("取消勾選會移除項目", () => {
    const store = createTripStore("t", createSafeStorage(createMemoryStorage()));
    store.setChecklistItem("l", "x", true);
    store.setChecklistItem("l", "y", true);
    store.setChecklistItem("l", "x", false);
    expect(store.getChecklist("l")).toEqual({ y: true });
  });

  it("寫入失敗（quota）時改用記憶體並通知", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const failing = {
      getItem: () => null,
      setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
      removeItem: () => {},
    };
    const storage = createSafeStorage(failing);
    const onChange = vi.fn();
    storage.onChange(onChange);
    const store = createTripStore("t", storage);
    store.setChecklistItem("l", "x", true);
    expect(storage.persistent).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(store.getChecklist("l")).toEqual({ x: true });
  });

  it("沒有 localStorage（隱私模式）時使用記憶體", () => {
    const storage = createSafeStorage(null);
    expect(storage.persistent).toBe(false);
    const store = createTripStore("t", storage);
    store.setSelectedDay("day-02");
    expect(store.getSelectedDay()).toBe("day-02");
  });

  it("preferences 合併寫入", () => {
    const store = createTripStore("t", createSafeStorage(createMemoryStorage()));
    store.setPreferences({ a: 1 });
    store.setPreferences({ b: 2 });
    expect(store.getPreferences()).toEqual({ a: 1, b: 2 });
  });
});
