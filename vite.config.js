import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * GitHub Pages project site 位於 https://{user}.github.io/{repo}/。
 * 預設 repository 名稱為 travel-planner；改名時修改 DEFAULT_BASE，
 * 或在建置時設定環境變數 BASE_PATH（GitHub Actions 已自動依 repository 名稱設定）。
 */
const DEFAULT_BASE = "/travel-planner/";

const normalizeBase = (value) => {
  if (!value) return DEFAULT_BASE;
  let base = value.startsWith("/") ? value : `/${value}`;
  if (!base.endsWith("/")) base += "/";
  return base;
};

/** 產生 Service Worker 的 precache 清單（含 hash 檔名），確保第一次開啟後即可離線。 */
const precacheManifest = () => ({
  name: "tripcanvas-precache-manifest",
  apply: "build",
  // writeBundle 時 bundle 已是最終輸出（Vite 已移除空的 CSS-only chunk）
  writeBundle(options, bundle) {
    const files = Object.keys(bundle)
      .filter((name) => !name.endsWith(".map") && name !== "index.html" && name !== "precache-manifest.js")
      .sort();
    // 方案清單變動（新增、移除方案）也要觸發 Service Worker 更新，才會預先快取新方案
    let planIndex = "";
    try {
      planIndex = readFileSync("public/data/plans/index.json", "utf8");
    } catch {
      // 沒有方案清單
    }
    const build = createHash("sha256").update(files.join("\n")).update(planIndex).digest("hex").slice(0, 10);
    const urls = files.map((f) => `./${f}`);
    writeFileSync(
      join(options.dir, "precache-manifest.js"),
      `// 由 vite.config.js 於建置時產生，請勿手動修改\n` +
        `self.__TRIPCANVAS_BUILD__ = ${JSON.stringify(build)};\n` +
        `self.__TRIPCANVAS_PRECACHE__ = ${JSON.stringify(urls, null, 2)};\n`,
    );
  },
});

/** 只在 production build 加入 CSP（開發模式的 HMR 需要 websocket 與 inline script）。 */
const contentSecurityPolicy = () => ({
  name: "tripcanvas-csp",
  apply: "build",
  transformIndexHtml() {
    const policy = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "manifest-src 'self'",
      "worker-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
    ].join("; ");
    return [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head" }];
  },
});

export default defineConfig({
  base: normalizeBase(process.env.BASE_PATH),
  plugins: [contentSecurityPolicy(), precacheManifest()],
  build: {
    outDir: "dist",
    target: "es2020",
    sourcemap: false,
    assetsInlineLimit: 2048,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
  },
});
