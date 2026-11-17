/**
 * Leaflet 地圖。Leaflet 以動態 import 載入，失敗時降級為文字清單與導航連結。
 * @module components/map-view
 */

import { h, icon, replaceChildren } from "../utils/dom.js";
import { getNavigationUrl } from "../services/navigation.js";
import { TILE_URL, TILE_ATTRIBUTION } from "../config.js";

const SINGLE_POINT_ZOOM = 13;
const FOCUS_ZOOM = 13;

/**
 * @param {HTMLElement} root
 * @param {{ onSelectItem: (itemId: string, origin: "map") => void }} options
 */
export const createMapView = (root, { onSelectItem }) => {
  const canvas = h("div", { className: "map-canvas", id: "map-canvas", "data-testid": "map-canvas" });
  const overlay = h("div", { className: "map-overlay", hidden: true, "data-testid": "map-empty" });
  const offlineNote = h("p", { className: "map-offline-note" }, icon("wifiOff"), "離線時地圖底圖可能無法顯示，地點序號與清單仍可使用。");
  const legend = h("ol", { className: "map-legend", role: "list", "data-testid": "map-legend" });
  const frame = h("div", { className: "map-frame" }, canvas, overlay);
  replaceChildren(root, frame, offlineNote, legend);

  /** @type {any} */ let L = null;
  /** @type {any} */ let map = null;
  /** @type {any} */ let layer = null;
  /** @type {Map<string, any>} */ let markers = new Map();
  /** @type {Map<string, HTMLButtonElement>} */ let legendButtons = new Map();
  /** @type {object | null} */ let pendingDay = null;
  let degraded = false;
  let resizeObserver = null;

  const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const showOverlay = (title, body) => {
    replaceChildren(overlay, h("p", { className: "empty-state__title" }, title), h("p", {}, body));
    overlay.hidden = false;
    canvas.classList.add("is-hidden");
  };
  const hideOverlay = () => {
    overlay.hidden = true;
    canvas.classList.remove("is-hidden");
  };

  /** 建立 marker 的 DOM icon（序號）。 */
  const markerElement = (n) => h("span", { className: "map-pin" }, String(n));

  /** @param {object} item */
  const popupContent = (item) => {
    const nav = getNavigationUrl(item.place);
    return h("div", { className: "map-popup" },
      h("p", { className: "map-popup__title" }, h("span", { className: "map-popup__num" }, String(item.markerNumber)), item.place?.name || item.title),
      h("p", { className: "map-popup__meta" }, item.startTime ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ""}  ${item.title}` : item.title),
      nav && h("a", { className: "btn btn--primary btn--small", href: nav, target: "_blank", rel: "noopener noreferrer", "data-needs-network": "" },
        icon("navigate"), h("span", {}, "導航"), h("span", { className: "visually-hidden" }, "（開新分頁）")),
    );
  };

  const renderLegend = (items) => {
    legendButtons = new Map();
    replaceChildren(legend, items.map((item) => {
      const btn = /** @type {HTMLButtonElement} */ (h("button", {
        type: "button",
        className: "map-legend__btn",
        "aria-pressed": "false",
        onclick: () => onSelectItem(item.id, "map"),
      },
        h("span", { className: "map-legend__num", "aria-hidden": "true" }, String(item.markerNumber)),
        h("span", {}, h("span", { className: "visually-hidden" }, `地點 ${item.markerNumber}：`), item.place?.name || item.title),
        item.startTime && h("span", { className: "map-legend__time" }, item.startTime),
      ));
      legendButtons.set(item.id, btn);
      return h("li", {}, btn);
    }));
  };

  const draw = (day) => {
    const items = day.items.filter((i) => i.hasCoordinates);
    renderLegend(items);
    root.setAttribute("data-marker-count", String(items.length));

    if (items.length === 0) {
      layer?.clearLayers();
      markers = new Map();
      showOverlay("這天沒有可顯示的地點", "行程未提供座標，請使用時間軸中的地點資訊。");
      return;
    }
    if (degraded || !map) return;
    hideOverlay();
    map.invalidateSize();

    layer.clearLayers();
    markers = new Map();
    const latlngs = [];
    for (const item of items) {
      const latlng = [item.place.latitude, item.place.longitude];
      latlngs.push(latlng);
      const marker = L.marker(latlng, {
        icon: L.divIcon({ className: "map-marker", html: markerElement(item.markerNumber), iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }),
        title: `${item.markerNumber}. ${item.place.name || item.title}`,
        alt: `${item.markerNumber}. ${item.place.name || item.title}`,
        keyboard: true,
        riseOnHover: true,
      });
      marker.bindPopup(() => popupContent(item), { autoPanPadding: [24, 24] });
      marker.on("click", () => onSelectItem(item.id, "map"));
      marker.addTo(layer);
      markers.set(item.id, marker);
    }

    if (latlngs.length === 1) {
      map.setView(latlngs[0], SINGLE_POINT_ZOOM, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [36, 36], maxZoom: 14, animate: false });
    }
  };

  return {
    /** 初始化 Leaflet（只執行一次）。 */
    async init() {
      try {
        const mod = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        L = mod.default ?? mod;
        map = L.map(canvas, {
          zoomControl: true,
          scrollWheelZoom: false,
          attributionControl: true,
          zoomSnap: 0.5,
        });
        L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: TILE_ATTRIBUTION,
          crossOrigin: true,
        }).addTo(map);
        map.attributionControl.setPrefix(false);
        layer = L.layerGroup().addTo(map);
        root.setAttribute("data-map-ready", "true");

        if ("ResizeObserver" in window) {
          resizeObserver = new ResizeObserver(() => map?.invalidateSize());
          resizeObserver.observe(canvas);
        }
        if (pendingDay) draw(pendingDay);
      } catch (error) {
        console.error("[TripCanvas] 地圖載入失敗：", error);
        degraded = true;
        root.setAttribute("data-map-ready", "degraded");
        showOverlay("地圖暫時無法載入", "時間軸與每個地點的導航連結仍可正常使用。");
      }
    },

    /** @param {object} day */
    showDay(day) {
      pendingDay = day;
      draw(day);
    },

    /**
     * @param {string | null} itemId
     * @param {{ pan?: boolean }} [options]
     */
    setSelected(itemId, { pan = false } = {}) {
      for (const [id, btn] of legendButtons) btn.setAttribute("aria-pressed", String(id === itemId));
      for (const [id, marker] of markers) {
        const el = marker.getElement();
        el?.classList.toggle("is-selected", id === itemId);
        marker.setZIndexOffset(id === itemId ? 1000 : 0);
      }
      const marker = itemId ? markers.get(itemId) : null;
      if (!marker || !map) return;
      if (pan) {
        const target = marker.getLatLng();
        const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
        if (reducedMotion()) map.setView(target, zoom, { animate: false });
        else map.flyTo(target, zoom, { duration: 0.6 });
      }
      marker.openPopup();
    },
  };
};
