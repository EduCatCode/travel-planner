import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

/**
 * 單一行程模式的測試：使用固定的加拿大範例資料，並讓 plans/index.json 回應 404，
 * 確保網站在沒有方案清單時退回讀取 itinerary.json。
 */
const CANADA = readFileSync(new URL("../fixtures/canada-itinerary.json", import.meta.url), "utf8");
const canada = () => JSON.parse(CANADA);
const DATA = "**/data/itinerary.json";

const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
    await page.route("**/data/plans/index.json", (route) => route.fulfill({ status: 404, body: "not found" }));
    await page.route(DATA, (route) => route.fulfill({ json: canada() }));
    await use(page);
  },
});

test.describe("核心流程", () => {
  test("載入、切換日期、卡片與地圖聯動、清單保存、分享", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");

    await expect(page.getByTestId("trip-title")).toHaveText("加拿大洛磯與溫哥華");
    await expect(page.getByTestId("day-chip-1")).toHaveAttribute("aria-current", "date");

    // 切換 Day 2
    await page.getByTestId("day-chip-2").click();
    await expect(page.getByTestId("day-chip-2")).toHaveAttribute("aria-current", "date");
    await expect(page.getByTestId("day-chip-1")).not.toHaveAttribute("aria-current", "date");
    await expect(page.locator("#day-title")).toHaveText("班夫鎮周邊與纜車");
    await expect(page).toHaveURL(/#day-02$/);

    // 時間軸依時間排序
    const times = await page.locator(".tl-time__start").allTextContents();
    expect(times).toEqual([...times].sort());

    // 地圖 markers 更新：數量 = 當日有座標的項目，舊 markers 不殘留
    await expect(page.locator("#map-root")).toHaveAttribute("data-map-ready", "true");
    const withCoords = await page.locator("[data-testid='card-select']").count();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(withCoords);
    const markerNumbers = await page.locator(".leaflet-marker-icon .map-pin").allTextContents();
    expect(markerNumbers).toEqual(Array.from({ length: withCoords }, (_, i) => String(i + 1)));

    // 點擊 marker → 對應卡片被選取並捲動到可視區域
    await page.locator(".leaflet-marker-icon").nth(4).click();
    const sunset = page.locator("[data-item-id='d02-sunset']");
    await expect(sunset).toHaveClass(/is-selected/);
    await expect(sunset).toBeInViewport();
    await expect(page.locator(".leaflet-popup").filter({ hasText: "Vermilion Lakes" })).toBeVisible();

    // 點擊景點卡片 → 地圖聚焦（marker 選取、popup 開啟）
    const gondola = page.locator("[data-item-id='d02-gondola']");
    await gondola.getByTestId("card-select").click();
    await expect(gondola).toHaveClass(/is-selected/);
    await expect(sunset).not.toHaveClass(/is-selected/);
    await expect(gondola.getByTestId("card-select")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".leaflet-marker-icon.is-selected .map-pin")).toHaveText("1");
    await expect(page.locator(".leaflet-popup").filter({ hasText: "Banff Gondola" })).toBeVisible();

    // 地圖文字清單也可定位
    await page.getByTestId("map-legend").getByRole("button", { name: /Bow Falls/ }).click();
    await expect(page.locator("[data-item-id='d02-bowfalls']")).toHaveClass(/is-selected/);

    // 導航連結
    const nav = gondola.getByTestId("nav-link");
    await expect(nav).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=51.1446,-115.5735");
    await expect(nav).toHaveAttribute("target", "_blank");
    await expect(nav).toHaveAttribute("rel", "noopener noreferrer");

    // 勾選 checklist → 重新整理後保留
    const passport = page.getByTestId("checkbox-packing-main-passport");
    await passport.check();
    await expect(page.getByTestId("progress-packing-main")).toContainText("已完成 1 / 10（10%）");
    await page.reload();
    await expect(page.getByTestId("checkbox-packing-main-passport")).toBeChecked();
    // 選擇的日期也保留（hash 與 LocalStorage）
    await expect(page.getByTestId("day-chip-2")).toHaveAttribute("aria-current", "date");

    // 複製分享網址：含日期 hash，不含勾選狀態
    await page.getByTestId("copy-link").click();
    await expect(page.locator("#toast")).toHaveText("已複製連結");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${baseURL}#day-02`);
  });

  test("URL hash 可直接開啟指定日期", async ({ page }) => {
    await page.goto("./#day-03");
    await expect(page.getByTestId("day-chip-3")).toHaveAttribute("aria-current", "date");
    await expect(page.locator("#day-title")).toHaveText("露易絲湖與夢蓮湖");
  });

  test("駕車警示：接近上限顯示 Warning，超過顯示 Blocker", async ({ page }) => {
    await page.goto("./#day-04");
    await expect(page.getByTestId("drive-check")).toHaveAttribute("data-level", "warning");
    await expect(page.getByTestId("drive-check")).toContainText("注意");
    await expect(page.getByTestId("check-afternoon-free")).toContainText("下午留白不足");

    await page.route(DATA, (route) => {
      const json = canada();
      json.days[3].driveMinutes = 241;
      return route.fulfill({ json });
    });
    await page.reload();
    await expect(page.getByTestId("drive-check")).toHaveAttribute("data-level", "blocker");
    await expect(page.getByTestId("drive-check")).toContainText("超過上限");
    await expect(page.getByTestId("trip-check-drive-limit")).toHaveAttribute("data-level", "blocker");
  });

  test("預算：不同幣別分開，未知金額不計入", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("budget-CAD")).toBeVisible();
    await expect(page.getByTestId("budget-USD")).toBeVisible();
    await expect(page.getByTestId("budget-unknown")).toContainText("尚未提供金額");
  });

  test("清除本機勾選狀態需要確認", async ({ page }) => {
    await page.goto("./");
    const box = page.getByTestId("checkbox-booking-flight");
    await box.check();
    page.once("dialog", (d) => d.dismiss());
    await page.getByTestId("clear-checklist").click();
    await expect(page.getByTestId("checkbox-booking-flight")).toBeChecked();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("clear-checklist").click();
    await expect(page.getByTestId("checkbox-booking-flight")).not.toBeChecked();
  });
});

test.describe("錯誤與空狀態", () => {
  test("JSON 404 顯示可理解的錯誤，不白屏", async ({ page }) => {
    await page.route(DATA, (route) => route.fulfill({ status: 404, body: "not found" }));
    await page.goto("./");
    await expect(page.getByTestId("load-error")).toContainText("無法載入行程");
    await expect(page.getByTestId("load-error")).toContainText("itinerary.json");
  });

  test("JSON 格式錯誤顯示格式提示", async ({ page }) => {
    await page.route(DATA, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{ bad json" }));
    await page.goto("./");
    await expect(page.getByTestId("load-error")).toContainText("行程資料格式有誤");
  });

  test("Schema 錯誤列出摘要", async ({ page }) => {
    await page.route(DATA, (route) => {
      const json = canada();
      delete json.trip.title;
      return route.fulfill({ json });
    });
    await page.goto("./");
    await expect(page.getByTestId("load-error")).toContainText("$.trip.title");
  });

  test("沒有座標的日期顯示地圖空狀態；沒有 items 顯示時間軸空狀態", async ({ page }) => {
    await page.route(DATA, (route) => {
      const json = canada();
      for (const item of json.days[0].items) delete item.place;
      json.days[1].items = [];
      return route.fulfill({ json });
    });
    await page.goto("./#day-01");
    await expect(page.getByTestId("map-empty")).toBeVisible();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(0);
    await expect(page.getByTestId("nav-link")).toHaveCount(0);
    await page.getByTestId("day-chip-2").click();
    await expect(page.getByTestId("timeline-empty")).toBeVisible();
  });

  test("LocalStorage 不可用時仍可操作", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
    });
    await page.goto("./");
    await expect(page.getByTestId("trip-title")).toBeVisible();
    await expect(page.getByText("本次勾選在重新整理後不會保留")).toBeVisible();
    await page.getByTestId("checkbox-todo-bank").check();
    await expect(page.getByTestId("checkbox-todo-bank")).toBeChecked();
  });
});

test.describe("Accessibility", () => {
  test("Skip link 為第一個可聚焦元素，鍵盤可切換日期與勾選", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("trip-title")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();

    await page.getByTestId("day-chip-1").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("day-chip-3")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("day-chip-3")).toHaveAttribute("aria-current", "date");

    await page.getByTestId("checkbox-todo-offline-map").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("checkbox-todo-offline-map")).toBeChecked();
  });

  test("axe：沒有 critical / serious 問題", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator("#map-root")).toHaveAttribute("data-map-ready", "true");
    const results = await new AxeBuilder({ page }).exclude(".leaflet-tile-pane").analyze();
    const bad = results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} ${v.nodes[0]?.target}`)).toEqual([]);
  });
});

test.describe("Responsive", () => {
  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900]]) {
    test(`${width}×${height} 無水平溢出、地圖有高度、日期可操作`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("./");
      await expect(page.getByTestId("trip-title")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      const mapBox = await page.getByTestId("map-canvas").boundingBox();
      expect(mapBox?.height ?? 0).toBeGreaterThan(200);

      await page.getByTestId("day-chip-5").click();
      await expect(page.getByTestId("day-chip-5")).toHaveAttribute("aria-current", "date");

      // 主要按鈕不重疊
      const boxes = await page.locator(".trip-header__actions .btn").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          expect(overlap).toBe(false);
        }
      }
      // 觸控目標至少 44px
      const small = await page.locator(".day-chip, .btn, .bottom-bar button").evaluateAll((els) =>
        els.filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length);
      expect(small).toBe(0);
    });
  }
});
