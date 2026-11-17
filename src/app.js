/**
 * 應用程式組裝：載入資料、建立元件、處理日期與項目選取。
 * @module app
 */

import {
  APP_VERSION, DATA_URL, PLANS_DIR, PLANS_INDEX_URL, SERVICE_WORKER_URL, SERVICE_WORKER_SCOPE,
} from "./config.js";
import { loadItinerary, ItineraryLoadError } from "./data/itinerary-loader.js";
import { loadPlanIndex, resolvePlanId } from "./data/plan-index.js";
import { normalizeTrip } from "./data/normalizer.js";
import { summarizeErrors } from "./data/schema-validator.js";
import { checkDay, checkTrip } from "./data/constraints.js";
import { summarizeBudget } from "./data/budget.js";
import { createSafeStorage, createTripStore, recordAppVersion } from "./services/storage.js";
import { registerServiceWorker } from "./services/pwa.js";
import { buildShareUrl, canNativeShare, copyToClipboard, nativeShare } from "./services/share.js";
import { createTripHeader } from "./components/trip-header.js";
import { createDaySelector } from "./components/day-selector.js";
import { createTimeline } from "./components/timeline.js";
import { createMapView } from "./components/map-view.js";
import { createChecklist } from "./components/checklist.js";
import { renderDayChecks, renderTripChecks } from "./components/warning-panel.js";
import { renderBudget } from "./components/budget-summary.js";
import { createOfflineBanner } from "./components/offline-banner.js";
import { h, icon, replaceChildren, announce, scrollBehavior } from "./utils/dom.js";
import { formatDate, getTripStatus, todayInTimeZone } from "./utils/date.js";
import { safeHttpsUrl } from "./utils/sanitize.js";

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** 啟動 App。任何失敗都顯示可理解的畫面，不會白屏。 */
export const startApp = async () => {
  createOfflineBanner($("offline-banner"));
  setupServiceWorker();

  const storage = createSafeStorage();
  recordAppVersion(APP_VERSION, storage);

  const index = await loadPlanIndex(PLANS_INDEX_URL);
  if (!index) {
    // 沒有方案清單：單一行程模式
    let doc;
    try {
      doc = await loadItinerary(DATA_URL);
    } catch (error) {
      renderLoadError(error);
      return;
    }
    safeMount(doc, { storage });
    return;
  }

  // ---------- 多方案模式 ----------
  const prefStore = createTripStore(index.tripId, storage);
  const urlPlan = new URLSearchParams(window.location.search).get("plan");
  const initialPlan = resolvePlanId(index.plans, urlPlan, prefStore.getPreferences().plan);

  /** @type {ReturnType<typeof mount> | null} */
  let session = null;
  let loading = false;

  /**
   * @param {string} planId
   * @param {{ fromUser?: boolean }} [opts]
   */
  const switchPlan = async (planId, { fromUser = false } = {}) => {
    const entry = index.plans.find((p) => p.id === planId);
    if (!entry || loading) return;
    if (session && session.planId === planId) return;
    loading = true;

    let doc;
    try {
      doc = await loadItinerary(`${PLANS_DIR}${entry.file}`);
    } catch (error) {
      loading = false;
      if (!session) {
        renderLoadError(error);
      } else {
        console.error(`[TripCanvas] 無法載入${entry.title}：`, error, error?.details);
        toast(`無法載入${entry.title}，請檢查網路後再試`);
      }
      return;
    }
    if (doc.trip.id !== index.tripId) {
      console.warn(`[TripCanvas] ${entry.file} 的 trip.id（${doc.trip.id}）與 index.json 的 tripId 不同，清單勾選狀態不會共用`);
    }

    const keepDay = session?.getDayId() ?? null;
    prefStore.setPreferences({ plan: planId });
    writePlanToUrl(planId);
    session?.destroy();
    session = safeMount(doc, {
      storage,
      plans: index.plans,
      planId,
      initialDayId: keepDay,
      onSelectPlan: (id) => switchPlan(id, { fromUser: true }),
    });
    loading = false;

    if (fromUser) {
      announce(`已切換到${entry.title}`);
      /** @type {HTMLElement | null} */ (document.querySelector(`[data-plan-id="${planId}"]`))?.focus();
    }
  };

  await switchPlan(initialPlan);
};

/**
 * 把方案寫進網址（?plan=），保留目前的 #day hash，不新增瀏覽紀錄。
 * @param {string} planId
 */
const writePlanToUrl = (planId) => {
  const url = new URL(window.location.href);
  if (url.searchParams.get("plan") === planId) return;
  url.searchParams.set("plan", planId);
  history.replaceState(null, "", url);
};

/**
 * @param {object} doc
 * @param {MountOptions} options
 */
const safeMount = (doc, options) => {
  try {
    return mount(normalizeTrip(doc), options);
  } catch (error) {
    console.error("[TripCanvas] 畫面初始化失敗：", error);
    renderLoadError(new ItineraryLoadError("invalid", String(error)));
    return null;
  }
};

/**
 * @typedef {object} MountOptions
 * @property {ReturnType<typeof createSafeStorage>} storage
 * @property {import("./data/plan-index.js").PlanEntry[]} [plans]
 * @property {string | null} [planId]
 * @property {string | null} [initialDayId]
 * @property {(planId: string) => void} [onSelectPlan]
 */

/**
 * @param {object} model
 * @param {MountOptions} options
 */
const mount = (model, { storage, plans = [], planId = null, initialDayId = null, onSelectPlan }) => {
  const { trip, days } = model;
  const locale = trip.locale || "zh-TW";
  const today = todayInTimeZone(trip.timezone);
  const status = getTripStatus(trip.startDate, trip.endDate, today);
  const store = createTripStore(trip.id, storage);

  document.title = `${trip.title}｜TripCanvas`;
  document.documentElement.lang = locale;
  document.body.dataset.state = "ready";

  const dayById = new Map(days.map((d) => [d.id, d]));
  const todayDay = days.find((d) => d.date === today) ?? null;
  /** @type {{ dayId: string | null, itemId: string | null }} */
  const state = { dayId: null, itemId: null };

  // ---------- Header ----------
  const shareUrl = () => buildShareUrl(window.location, state.dayId, planId);
  const header = createTripHeader($("trip-header"), { trip, days, status, plans, planId }, {
    onSelectPlan,
    onCopyLink: async () => {
      const ok = await copyToClipboard(shareUrl());
      toast(ok ? "已複製連結" : "無法自動複製，請從網址列複製");
    },
    onNativeShare: canNativeShare()
      ? async () => {
          const result = await nativeShare({ title: trip.title, url: shareUrl() });
          if (result === "failed") {
            const ok = await copyToClipboard(shareUrl());
            toast(ok ? "無法開啟分享選單，已改為複製連結" : "無法分享，請從網址列複製");
          }
        }
      : null,
    onPrint: () => window.print(),
  });

  $("day-selector").hidden = false;
  $("bottom-bar").hidden = false;
  $("map-panel").hidden = false;
  if (days.length === 0) {
    $("day-selector").hidden = true;
    $("bottom-bar").hidden = true;
    replaceChildren($("day-panel"), h("div", { className: "empty-state", "data-testid": "no-days" },
      h("h2", { className: "empty-state__title" }, "這趟旅程還沒有每日行程"),
      h("p", {}, "在 itinerary.json 的 days 陣列加入第一天，就會出現在這裡。"),
    ));
    $("map-panel").hidden = true;
  }

  // ---------- 元件 ----------
  const daySelector = createDaySelector($("day-selector"), {
    days, locale, todayId: todayDay?.id ?? null,
    onSelect: (id) => selectDay(id, { fromUser: true }),
  });

  const timeline = createTimeline($("timeline-root"), {
    onSelectItem: (id, origin) => selectItem(id, origin),
  });

  const mapView = createMapView($("map-root"), {
    onSelectItem: (id, origin) => selectItem(id, origin),
  });
  if (days.length > 0) mapView.init();

  createChecklist($("checklist-root"), { checklists: model.checklists, store });
  renderBudget($("budget-root"), summarizeBudget(days), locale);
  renderTripChecks($("trip-checks-root"), checkTrip(days, trip.constraints));
  renderSources(model.sources);

  // ---------- 選取 ----------
  /**
   * @param {string} dayId
   * @param {{ fromUser?: boolean }} [opts]
   */
  function selectDay(dayId, { fromUser = false } = {}) {
    const day = dayById.get(dayId);
    if (!day) return;
    const changed = state.dayId !== dayId;
    state.dayId = dayId;
    state.itemId = null;
    store.setSelectedDay(dayId);
    header.setSelectedDay(day);
    daySelector.setSelected(dayId);
    renderDayPanel(day);
    mapView.showDay(day);

    if (fromUser) {
      const hash = `#${encodeURIComponent(dayId)}`;
      if (window.location.hash !== hash) history.replaceState(null, "", hash);
      if (changed) announce(`已切換到第 ${day.number} 天：${day.title}`);
    }
  }

  /**
   * @param {string} itemId
   * @param {"card" | "map"} origin
   */
  function selectItem(itemId, origin) {
    state.itemId = itemId;
    timeline.setSelected(itemId, { scroll: origin === "map" });
    mapView.setSelected(itemId, { pan: true });
  }

  /** @param {object} day */
  function renderDayPanel(day) {
    $("day-number").textContent = `第 ${day.number} 天，${formatDate(day.date, locale, { weekday: "long" })}`;
    $("day-title").textContent = day.title;
    $("day-base").textContent = `今晚住 ${day.baseCity}`;
    replaceChildren($("day-extra"),
      day.summary && h("p", { className: "day-summary" }, day.summary),
      day.weatherNote && h("p", { className: "day-weather" }, icon("info"), h("span", {}, `天氣備註（非即時資訊）：${day.weatherNote}`)),
      day.notes.length > 0 && h("ul", { className: "day-notes", role: "list" },
        day.notes.map((n) => h("li", {}, icon("alert"), h("span", {}, n)))),
    );
    renderDayChecks($("day-checks"), checkDay(day, trip.constraints), day.distanceKm, {
      showDrive: trip.transportMode === "drive",
    });
    timeline.render(day, { locale, today });
  }

  // ---------- 初始日期：hash > 切換方案前的日期 > 上次選擇 > 今天 > 第一天 ----------
  const fromHash = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    return dayById.has(id) ? id : null;
  };
  const valid = (id) => (id && dayById.has(id) ? id : null);
  const initial = fromHash() ?? valid(initialDayId) ?? valid(store.getSelectedDay()) ?? todayDay?.id ?? days[0]?.id;
  if (initial) selectDay(initial);

  const onHashChange = () => {
    const id = fromHash();
    if (id && id !== state.dayId) selectDay(id, { fromUser: true });
  };
  window.addEventListener("hashchange", onHashChange);

  setupBottomBar({ todayDay, selectDay, status });

  return {
    planId,
    getDayId: () => state.dayId,
    /** 切換方案前釋放事件與地圖，避免重複綁定。 */
    destroy() {
      window.removeEventListener("hashchange", onHashChange);
      mapView.destroy();
    },
  };
};

/**
 * @param {object} ctx
 */
const setupBottomBar = ({ todayDay, selectDay, status }) => {
  const bar = $("bottom-bar");
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
  const label = status.state === "ongoing" && todayDay ? "今天" : "行程";
  replaceChildren(bar, h("ul", { role: "list" },
    h("li", {}, h("button", { type: "button", onclick: () => {
      if (todayDay) selectDay(todayDay.id, { fromUser: true });
      go("day-panel");
    } }, icon("calendar"), h("span", {}, label))),
    h("li", {}, h("button", { type: "button", onclick: () => go("map-panel") }, icon("map"), h("span", {}, "地圖"))),
    h("li", {}, h("button", { type: "button", onclick: () => go("checklist-section") }, icon("list"), h("span", {}, "清單"))),
  ));
};

/** @param {object[]} sources */
const renderSources = (sources) => {
  const root = $("sources-root");
  if (!sources.length) {
    root.hidden = true;
    return;
  }
  replaceChildren(root,
    h("h2", { className: "footer__heading" }, "資料來源"),
    h("ul", { role: "list", className: "sources" }, sources.map((s) => {
      const url = safeHttpsUrl(s.url);
      return h("li", {},
        url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, s.title, h("span", { className: "visually-hidden" }, "（開新分頁）")) : s.title,
        s.accessedAt && h("span", { className: "muted" }, `（查閱 ${s.accessedAt}）`),
      );
    })),
  );
};

/** @param {unknown} error */
const renderLoadError = (error) => {
  console.error("[TripCanvas] 行程載入失敗：", error, error?.details);
  document.body.dataset.state = "error";
  $("day-selector").hidden = true;
  $("bottom-bar").hidden = true;

  let title = "無法載入行程";
  let body = "請檢查網路連線後重新整理。";
  /** @type {string[]} */
  let details = [];
  if (error instanceof ItineraryLoadError) {
    if (error.kind === "not-found") {
      body = "找不到行程資料檔，請檢查 data/itinerary.json 是否存在，以及 vite.config.js 的 base 路徑是否與 repository 名稱一致。";
    } else if (error.kind === "parse") {
      title = "行程資料格式有誤";
      body = "itinerary.json 不是有效的 JSON，常見原因是多了逗號或少了引號。";
    } else if (error.kind === "invalid") {
      title = "行程資料格式有誤";
      body = "itinerary.json 有欄位不符合規格，請依下列提示修正：";
      details = summarizeErrors(error.details?.errors ?? []);
    }
  }

  replaceChildren($("trip-header"), h("div", { className: "trip-header__inner" },
    h("div", { className: "trip-header__text" },
      h("p", { className: "trip-header__brand" }, "TripCanvas 旅程畫布"),
    )));
  replaceChildren($("main"),
    h("section", { className: "error-state", role: "alert", "data-testid": "load-error" },
      h("h1", {}, title),
      h("p", {}, body),
      details.length > 0 && h("ul", { className: "error-state__list" }, details.map((d) => h("li", {}, d))),
      h("button", { type: "button", className: "btn btn--primary", onclick: () => window.location.reload() },
        icon("refresh"), h("span", {}, "重新載入")),
    ),
  );
};

/** 短暫提示訊息（同時以 aria-live 宣告）。 */
const toast = (message) => {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  announce(message);
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => (el.hidden = true), 2600);
};

const setupServiceWorker = () => {
  if (!import.meta.env?.PROD) return;
  registerServiceWorker({
    url: SERVICE_WORKER_URL,
    scope: SERVICE_WORKER_SCOPE,
    onUpdateReady: (apply) => {
      const banner = $("update-banner");
      replaceChildren(banner,
        h("p", { className: "banner__text" }, icon("refresh"), h("span", {}, "有新版本可用。")),
        h("button", { type: "button", className: "btn btn--primary btn--small", onclick: apply }, "重新載入以更新"),
      );
      banner.hidden = false;
      announce("有新版本可用，可在方便時重新載入");
    },
  });
};
