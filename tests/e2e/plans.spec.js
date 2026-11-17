import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** 多方案模式：使用專案內真正的 public/data/plans 資料。 */
const test = base.extend({
  page: async ({ page }, use) => {
    await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
    await use(page);
  },
});

const pressed = (page, id) => expect(page.getByTestId(`plan-${id}`)).toHaveAttribute("aria-pressed", "true");

test.describe("方案切換", () => {
  test("預設顯示第一個方案，網址寫入 ?plan=a", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByTestId("trip-title")).toHaveText("東京與河口湖 7 日");
    await pressed(page, "a");
    await expect(page.getByTestId("plan-b")).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/\?plan=a$/);
    await expect(page.getByTestId("plan-description")).toContainText("河口湖兩天");
    // 大眾運輸行程不顯示駕車列
    await expect(page.getByTestId("drive-check")).toHaveCount(0);
  });

  test("切換方案時保留日期，時間軸與地圖一起更新，重新整理後保留", async ({ page }) => {
    await page.goto("./?plan=a#day-03");
    await expect(page.getByTestId("day-chip-3")).toHaveAttribute("aria-current", "date");
    await expect(page.locator("[data-item-id='d03a-chureito']")).toBeVisible();

    await page.getByTestId("plan-b").click();
    await pressed(page, "b");
    await expect(page).toHaveURL(/\?plan=b#day-03$/);
    await expect(page.getByTestId("day-chip-3")).toHaveAttribute("aria-current", "date");
    await expect(page.locator("[data-item-id='d03b-free']")).toBeVisible();
    await expect(page.locator("[data-item-id='d03a-chureito']")).toHaveCount(0);
    await expect(page.locator(".trip-header__subtitle")).toHaveText("方案 B：慢遊咖啡");
    await expect(page.getByTestId("plan-b")).toBeFocused();
    await expect(page.locator("#live-region")).toHaveText("已切換到方案 B：慢遊咖啡");

    // 地圖重建：marker 數量 = 有座標的卡片數
    await expect(page.locator("#map-root")).toHaveAttribute("data-map-ready", "true");
    const withCoords = await page.getByTestId("card-select").count();
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(withCoords);
    await expect(page.locator(".leaflet-container")).toHaveCount(1);

    await page.reload();
    await pressed(page, "b");
    await expect(page.getByTestId("day-chip-3")).toHaveAttribute("aria-current", "date");
  });

  test("開啟順序：網址 > 上次選擇 > 第一個方案", async ({ page }) => {
    await page.goto("./?plan=c");
    await pressed(page, "c");
    // 不帶參數：使用上次選擇
    await page.goto("./");
    await pressed(page, "c");
    await expect(page).toHaveURL(/\?plan=c$/);
    // 網址優先
    await page.goto("./?plan=b");
    await pressed(page, "b");
    // 不存在的方案：退回上次選擇
    await page.goto("./?plan=zzz");
    await pressed(page, "b");
    await expect(page).toHaveURL(/\?plan=b$/);
  });

  test("清單勾選狀態在方案之間共用", async ({ page }) => {
    await page.goto("./?plan=a");
    await page.getByTestId("checkbox-todo-card-fee").check();
    await page.getByTestId("plan-c").click();
    await pressed(page, "c");
    await expect(page.getByTestId("checkbox-todo-card-fee")).toBeChecked();
  });

  test("分享連結包含方案與日期，不包含勾選狀態", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./?plan=b");
    await page.getByTestId("checkbox-packing-main-passport").check();
    await page.getByTestId("day-chip-3").click();
    await page.getByTestId("copy-link").click();
    await expect(page.locator("#toast")).toHaveText("已複製連結");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}?plan=b#day-03`);
  });

  test("鍵盤可切換方案", async ({ page }) => {
    await page.goto("./?plan=a");
    await page.getByTestId("plan-a").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("plan-b")).toBeFocused();
    await page.keyboard.press("Enter");
    await pressed(page, "b");
    await expect(page.getByTestId("plan-b")).toBeFocused();
  });

  test("讀不到 plans/index.json 時退回 itinerary.json", async ({ page }) => {
    await page.route("**/data/plans/index.json", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto("./");
    await expect(page.getByTestId("trip-title")).toHaveText("東京與河口湖 7 日");
    await expect(page.getByTestId("plan-switcher")).toHaveCount(0);
  });

  test("axe：方案頁沒有 critical / serious 問題", async ({ page }) => {
    await page.goto("./?plan=c");
    await expect(page.locator("#map-root")).toHaveAttribute("data-map-ready", "true");
    const results = await new AxeBuilder({ page }).exclude(".leaflet-tile-pane").analyze();
    const bad = results.violations.filter((v) => ["critical", "serious"].includes(v.impact));
    expect(bad.map((v) => `${v.id}: ${v.nodes.length} ${v.nodes[0]?.target}`)).toEqual([]);
  });

  for (const [width, height] of [[360, 800], [1440, 900]]) {
    test(`${width}px 方案按鈕不溢出、不重疊`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("./");
      await expect(page.getByTestId("plan-switcher")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const boxes = await page.locator(".plan-option").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
      for (const b of boxes) expect(b.height).toBeGreaterThanOrEqual(44);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
        }
      }
    });
  }
});

test.describe("離線", () => {
  test.use({ serviceWorkers: "allow" });

  test("離線重新載入可查看行程，並能切換到從未開啟過的方案", async ({ page, context }) => {
    await page.goto("./?plan=a");
    await expect(page.getByTestId("trip-title")).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("offline-banner")).toBeVisible();
    await pressed(page, "a");
    await expect(page.getByTestId("timeline-item").first()).toBeVisible();

    // 方案 C 從未在線上開啟過，靠安裝時的預先快取
    await page.getByTestId("plan-c").click();
    await pressed(page, "c");
    await expect(page.locator(".trip-header__subtitle")).toHaveText("方案 C：東京城市與採買");
    await page.getByTestId("day-chip-4").click();
    await expect(page.locator("#day-title")).toHaveText("早班巴士回東京，澀谷與 SHIBUYA SKY");
    await context.setOffline(false);
  });
});
