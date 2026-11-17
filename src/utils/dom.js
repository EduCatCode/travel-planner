/**
 * 不使用 innerHTML 的 DOM 建構工具。
 * @module utils/dom
 */

/**
 * @typedef {Record<string, string | number | boolean | null | undefined | EventListener>} Attrs
 * @typedef {Node | string | number | null | undefined | false} Child
 */

/**
 * 建立元素。屬性以 setAttribute 寫入，"on" 開頭者綁定事件，文字一律為 text node。
 * @param {string} tag
 * @param {Attrs} [attrs]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElement}
 */
export const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "className") {
      el.className = String(value);
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
};

/**
 * @param {Node} parent
 * @param {(Child | Child[])[]} children
 */
const append = (parent, children) => {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
};

const SVG_NS = "http://www.w3.org/2000/svg";

/** 線條 icon 路徑（24×24，stroke 繪製）。 */
const ICON_PATHS = {
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  utensils: ["M7 3v8a2 2 0 0 0 4 0V3", "M9 11v10", "M17 3c-2 2-2 6 0 8v10"],
  bed: ["M3 18V7", "M3 13h18v5", "M21 18v-3a3 3 0 0 0-3-3h-7v1", "M7 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  car: ["M5 16l1.5-5h11L19 16", "M4 16h16v3H4z", "M7 19v1.5", "M17 19v1.5", "M8 7.5h8"],
  plane: ["M2 13l20-6-7 14-3-6z", "M12 15l3-4"],
  train: ["M6 4h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z", "M6 10h12", "M8 21l2-4", "M16 21l-2-4"],
  coffee: ["M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", "M16 10h1.5a2.5 2.5 0 0 1 0 5H16", "M8 3v3", "M12 3v3"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.5v.5"],
  lock: ["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  navigate: ["M3 11l18-8-8 18-2-8z"],
  link: ["M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1", "M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"],
  pin: ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  alert: ["M12 3l10 18H2z", "M12 10v5", "M12 18v.5"],
  stop: ["M8 3h8l5 5v8l-5 5H8l-5-5V8z", "M12 8v5", "M12 16v.5"],
  share: ["M12 3v12", "M7 8l5-5 5 5", "M5 13v7h14v-7"],
  print: ["M7 9V3h10v6", "M5 9h14v8h-3", "M8 17H5", "M8 14h8v7H8z"],
  wifiOff: ["M3 3l18 18", "M8.5 16.5a5 5 0 0 1 7 0", "M5 12.5a10 10 0 0 1 4-2.3", "M12 20v.5", "M15 10.2a10 10 0 0 1 4 2.3"],
  calendar: ["M4 6h16v14H4z", "M4 10h16", "M8 3v4", "M16 3v4"],
  map: ["M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z", "M9 3v15", "M15 6v15"],
  list: ["M9 6h12", "M9 12h12", "M9 18h12", "M4 6h.5", "M4 12h.5", "M4 18h.5"],
  wallet: ["M3 7h16v13H3z", "M3 7l12-4v4", "M15 13.5h4"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"],
};

/**
 * 建立裝飾性 SVG icon（aria-hidden）。
 * @param {keyof typeof ICON_PATHS} name
 * @param {string} [className]
 * @returns {SVGSVGElement}
 */
export const icon = (name, className = "icon") => {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", className);
  for (const d of ICON_PATHS[name] ?? ICON_PATHS.info) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
};

/**
 * 清空並以新內容取代。
 * @param {Element} el
 * @param {...(Child | Child[])} children
 */
export const replaceChildren = (el, ...children) => {
  el.replaceChildren();
  append(el, children);
};

/**
 * 以 aria-live 區域宣告狀態。
 * @param {string} message
 */
export const announce = (message) => {
  const region = document.getElementById("live-region");
  if (!region) return;
  region.textContent = "";
  // 讓螢幕閱讀器偵測到內容變化
  window.setTimeout(() => {
    region.textContent = message;
  }, 50);
};

/**
 * 依使用者動態偏好決定捲動行為。
 * @returns {ScrollBehavior}
 */
export const scrollBehavior = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
