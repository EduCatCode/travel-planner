import { describe, it, expect } from "vitest";
import { createGoogleMapsDirectionsUrl, getNavigationUrl } from "../src/services/navigation.js";

describe("createGoogleMapsDirectionsUrl", () => {
  it("產生正確編碼的 directions URL", () => {
    const url = createGoogleMapsDirectionsUrl(51.4254, -116.1773);
    expect(url).toBe("https://www.google.com/maps/dir/?api=1&destination=51.4254,-116.1773");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("api")).toBe("1");
    expect(parsed.searchParams.get("destination")).toBe("51.4254,-116.1773");
  });

  it("小數位數限制為 6 位", () => {
    expect(createGoogleMapsDirectionsUrl(51.123456789, -0.0000001)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=51.123457,0",
    );
  });

  it.each([
    [91, 0], [-91, 0], [0, 181], [0, -181],
    [Number.NaN, 0], [0, Infinity], ["51.4", -116], [undefined, undefined], [null, 0],
  ])("非法輸入 (%s, %s) 拋出 TypeError", (lat, lng) => {
    expect(() => createGoogleMapsDirectionsUrl(lat, lng)).toThrow(TypeError);
  });

  it("邊界值合法", () => {
    expect(() => createGoogleMapsDirectionsUrl(90, 180)).not.toThrow();
    expect(() => createGoogleMapsDirectionsUrl(-90, -180)).not.toThrow();
  });
});

describe("getNavigationUrl", () => {
  it("座標優先", () => {
    expect(getNavigationUrl({ latitude: 1, longitude: 2, googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=x" }))
      .toBe("https://www.google.com/maps/dir/?api=1&destination=1,2");
  });

  it("無座標時使用安全的 googleMapsUrl", () => {
    const url = "https://www.google.com/maps/search/?api=1&query=Banff";
    expect(getNavigationUrl({ googleMapsUrl: url })).toBe(url);
  });

  it("拒絕非 Google 或非 https 的網址", () => {
    expect(getNavigationUrl({ googleMapsUrl: "https://evil.example/maps" })).toBeNull();
    expect(getNavigationUrl({ googleMapsUrl: "http://www.google.com/maps" })).toBeNull();
    expect(getNavigationUrl({ googleMapsUrl: "javascript:alert(1)" })).toBeNull();
  });

  it("沒有座標也沒有網址時回傳 null（不顯示按鈕）", () => {
    expect(getNavigationUrl({ name: "某地" })).toBeNull();
    expect(getNavigationUrl(undefined)).toBeNull();
  });
});
