/* TripCanvas Service Worker
 * - App Shell / 靜態資源：Cache First，版本更新時清除舊 cache
 * - data/ 內的 JSON（itinerary.json、plans/*.json）：Network First，失敗時使用 cache
 * - 第三方資源（地圖 tiles、Google Maps）：不處理、不快取
 * - 只處理 GET
 */

const CACHE_VERSION = "v1";
let BUILD = "dev";
let PRECACHE = [];

try {
  importScripts("./precache-manifest.js");
  BUILD = self.__TRIPCANVAS_BUILD__ || BUILD;
  PRECACHE = Array.isArray(self.__TRIPCANVAS_PRECACHE__) ? self.__TRIPCANVAS_PRECACHE__ : [];
} catch {
  // 開發模式沒有 precache-manifest.js，只快取 App Shell
}

const STATIC_CACHE = `tripcanvas-static-${CACHE_VERSION}-${BUILD}`;
const DATA_CACHE = `tripcanvas-data-${CACHE_VERSION}`;
const ALLOWLIST = [STATIC_CACHE, DATA_CACHE];

const SCOPE = new URL("./", self.location).href;
const DATA_DIR = new URL("./data/", SCOPE).href;
const DATA_URL = new URL("./data/itinerary.json", SCOPE).href;
const PLANS_INDEX_URL = new URL("./data/plans/index.json", SCOPE).href;
const INDEX_URL = new URL("./index.html", SCOPE).href;

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon.svg",
  "./images/placeholders/place.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      const urls = [...new Set([...APP_SHELL, ...PRECACHE])].map((u) => new URL(u, SCOPE).href);
      await staticCache.addAll(urls);
      try {
        await precacheData();
      } catch {
        // 行程資料會在第一次讀取時再快取
      }
    })(),
  );
  // 不呼叫 skipWaiting：等待使用者同意後才更新，避免查看中被強制刷新
});

/** 預先快取行程資料：itinerary.json，以及方案清單列出的所有方案。 */
const precacheData = async () => {
  const cache = await caches.open(DATA_CACHE);
  const put = async (url) => {
    const res = await fetch(url, { cache: "no-cache" });
    if (res.ok) await cache.put(url, res.clone());
    return res;
  };
  await put(DATA_URL).catch(() => null);
  const indexRes = await put(PLANS_INDEX_URL).catch(() => null);
  if (!indexRes || !indexRes.ok) return;
  const index = await indexRes.json();
  const files = Array.isArray(index.plans) ? index.plans.map((p) => p && p.file).filter((f) => typeof f === "string") : [];
  await Promise.all(files.map((file) => put(new URL(file, PLANS_INDEX_URL).href).catch(() => null)));
};

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("tripcanvas-") && !ALLOWLIST.includes(key))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  const path = url.href.split(/[?#]/)[0];
  if (path.startsWith(DATA_DIR) && path.endsWith(".json")) {
    event.respondWith(networkFirst(request, path));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(appShell(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

/**
 * @param {Request} request
 * @param {string} key 去除 query 的網址，作為快取鍵
 */
const networkFirst = async (request, key) => {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw error;
  }
};

/** @param {Request} request */
const appShell = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = (await cache.match(INDEX_URL)) || (await cache.match(SCOPE));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch {
    return new Response("<h1>目前離線</h1><p>請連上網路後重新開啟 TripCanvas。</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};

/** @param {Request} request */
const cacheFirst = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") await cache.put(request, res.clone());
  return res;
};
