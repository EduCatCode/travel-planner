import { describe, it, expect } from "vitest";
import {
  evaluateDriveTime, afternoonFreeMinutes, countTwoNightBases, checkDay, checkTrip, findIncompleteLockedItems,
} from "../src/data/constraints.js";

describe("evaluateDriveTime", () => {
  it("240 分鐘（等於上限）為邊界 Warning，不是 Blocker", () => {
    expect(evaluateDriveTime(240, 240)).toBe("warning");
  });
  it("241 分鐘為 Blocker", () => {
    expect(evaluateDriveTime(241, 240)).toBe("blocker");
  });
  it("達上限 80% 為 Warning，以下為 Normal", () => {
    expect(evaluateDriveTime(192, 240)).toBe("warning");
    expect(evaluateDriveTime(191, 240)).toBe("normal");
    expect(evaluateDriveTime(0, 240)).toBe("normal");
  });
  it("未設定上限時為 Normal", () => {
    expect(evaluateDriveTime(999, undefined)).toBe("normal");
  });
});

describe("afternoonFreeMinutes", () => {
  const w = { start: "13:00", end: "17:00" };
  it("只計算窗口內的 free-time，並合併重疊", () => {
    const items = [
      { type: "free-time", startTime: "12:00", endTime: "13:30" }, // 30
      { type: "free-time", startTime: "14:00", endTime: "15:00" }, // 60
      { type: "free-time", startTime: "14:30", endTime: "15:30" }, // +30（重疊）
      { type: "activity", startTime: "15:30", endTime: "16:30" },  // 非留白
      { type: "free-time", startTime: "16:45", endTime: "18:00" }, // 15
    ];
    expect(afternoonFreeMinutes(items, w)).toBe(135);
  });
  it("沒有留白為 0", () => {
    expect(afternoonFreeMinutes([], w)).toBe(0);
  });
});

describe("countTwoNightBases", () => {
  it("計算連住兩晚以上的基地", () => {
    const days = ["Banff", "Banff", "Banff", "Jasper", "Jasper", "Hope", "Vancouver", "Vancouver"].map((baseCity) => ({ baseCity }));
    expect(countTwoNightBases(days)).toBe(3);
  });
  it("沒有連住為 0", () => {
    expect(countTwoNightBases([{ baseCity: "A" }, { baseCity: "B" }, { baseCity: "A" }])).toBe(0);
  });
});

describe("checkDay / checkTrip", () => {
  const constraints = { maxDailyDriveMinutes: 240, minAfternoonFreeMinutes: 60, minimumTwoNightBases: 2 };
  it("留白不足產生 Warning，不修改資料", () => {
    const day = Object.freeze({ driveMinutes: 100, items: Object.freeze([{ type: "free-time", startTime: "13:00", endTime: "13:30" }]) });
    const result = checkDay(day, constraints);
    expect(result.drive.level).toBe("normal");
    expect(result.checks.find((c) => c.id === "afternoon-free").level).toBe("warning");
  });
  it("鎖定項目缺時間或說明", () => {
    expect(findIncompleteLockedItems([
      { locked: true, title: "x", startTime: "10:00", description: "ok" },
      { locked: true, title: "y" },
      { locked: false, title: "z" },
    ]).map((i) => i.title)).toEqual(["y"]);
  });
  it("旅程超時天數為 Blocker", () => {
    const days = [{ number: 1, baseCity: "A", driveMinutes: 241 }, { number: 2, baseCity: "A", driveMinutes: 10 }];
    const results = checkTrip(days, constraints);
    expect(results.find((r) => r.id === "drive-limit").level).toBe("blocker");
    expect(results.find((r) => r.id === "two-night-bases").level).toBe("warning");
  });
});
