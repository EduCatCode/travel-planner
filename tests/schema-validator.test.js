import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateTripDocument, summarizeErrors } from "../src/data/schema-validator.js";
import { validDoc } from "./fixtures.js";

const codes = (doc) => validateTripDocument(doc).errors.map((e) => e.code);

describe("validateTripDocument", () => {
  it("合法 Schema 通過", () => {
    expect(validateTripDocument(validDoc())).toEqual({ valid: true, errors: [] });
  });

  it("範例 itinerary.json 通過", () => {
    const json = JSON.parse(readFileSync(new URL("../public/data/itinerary.json", import.meta.url), "utf8"));
    const result = validateTripDocument(json);
    expect(result.errors).toEqual([]);
  });

  it("缺少 trip.title 失敗", () => {
    const doc = validDoc();
    delete doc.trip.title;
    const { valid, errors } = validateTripDocument(doc);
    expect(valid).toBe(false);
    expect(errors).toContainEqual(expect.objectContaining({ path: "$.trip.title", code: "REQUIRED_STRING" }));
  });

  it("endDate 早於 startDate 失敗", () => {
    const doc = validDoc();
    doc.trip.endDate = "2027-09-14";
    expect(codes(doc)).toContain("END_BEFORE_START");
  });

  it("重複 item ID 失敗（跨日也檢查）", () => {
    const doc = validDoc();
    doc.days[1].items.push({ id: "a", type: "note", title: "重複" });
    const { errors } = validateTripDocument(doc);
    expect(errors).toContainEqual(expect.objectContaining({ code: "DUPLICATE_ID", path: "$.days[1].items[0].id" }));
  });

  it("非法座標失敗", () => {
    const doc = validDoc();
    doc.days[0].items[0].place.latitude = 91;
    doc.days[0].items[0].place.longitude = -181;
    const errs = validateTripDocument(doc).errors.filter((e) => e.code === "INVALID_COORDINATE");
    expect(errs.map((e) => e.path)).toEqual([
      "$.days[0].items[0].place.latitude",
      "$.days[0].items[0].place.longitude",
    ]);
  });

  it("座標只提供一半失敗", () => {
    const doc = validDoc();
    delete doc.days[0].items[0].place.longitude;
    expect(codes(doc)).toContain("INCOMPLETE_COORDINATES");
  });

  it("回傳所有錯誤，而非只有第一個", () => {
    const doc = validDoc();
    delete doc.trip.title;
    doc.trip.currency = "cad";
    doc.days[0].driveMinutes = -5;
    doc.days[0].items[0].endTime = "09:00";
    expect(codes(doc)).toEqual(expect.arrayContaining([
      "REQUIRED_STRING", "INVALID_CURRENCY", "INVALID_NUMBER", "END_BEFORE_START",
    ]));
  });

  it("日期不在旅行範圍內失敗", () => {
    const doc = validDoc();
    doc.days[1].date = "2027-09-20";
    expect(codes(doc)).toContain("DATE_OUT_OF_RANGE");
  });

  it("重複 day ID 失敗", () => {
    const doc = validDoc();
    doc.days[1].id = "day-01";
    expect(codes(doc)).toContain("DUPLICATE_ID");
  });

  it("外部 URL 只接受 https", () => {
    const doc = validDoc();
    doc.days[0].items[0].place.websiteUrl = "http://example.com";
    doc.days[0].items[0].place.googleMapsUrl = "javascript:alert(1)";
    expect(codes(doc).filter((c) => c === "INVALID_URL")).toHaveLength(2);
  });

  it("無效時區、日期與 enum", () => {
    const doc = validDoc();
    doc.trip.timezone = "Mars/Base";
    doc.trip.startDate = "2027-02-30";
    doc.trip.transportMode = "boat";
    doc.days[0].items[0].type = "party";
    expect(codes(doc)).toEqual(expect.arrayContaining(["INVALID_TIMEZONE", "INVALID_DATE", "INVALID_ENUM"]));
  });

  it("引用不存在的 source 失敗", () => {
    const doc = validDoc();
    doc.days[0].items[0].sourceIds = ["missing"];
    expect(codes(doc)).toContain("UNKNOWN_SOURCE");
  });

  it("非物件根節點", () => {
    expect(validateTripDocument(null).valid).toBe(false);
    expect(validateTripDocument([]).errors[0].code).toBe("INVALID_ROOT");
  });

  it("summarizeErrors 限制筆數", () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({ path: `$.x${i}`, code: "X", message: "m" }));
    const lines = summarizeErrors(errors, 5);
    expect(lines).toHaveLength(6);
    expect(lines[5]).toContain("另有 3 項錯誤");
  });
});
