/**
 * 每日選擇器：Mobile 水平捲動 chips、Desktop 同一列展開。
 * @module components/day-selector
 */

import { h, replaceChildren, scrollBehavior } from "../utils/dom.js";
import { formatDate } from "../utils/date.js";

/**
 * @param {HTMLElement} root <nav> 元素
 * @param {object} options
 * @param {object[]} options.days
 * @param {string} options.locale
 * @param {string | null} options.todayId
 * @param {(dayId: string) => void} options.onSelect
 */
export const createDaySelector = (root, { days, locale, todayId, onSelect }) => {
  /** @type {Map<string, HTMLButtonElement>} */
  const buttons = new Map();

  const list = h("ol", { className: "day-chips", role: "list" });
  for (const day of days) {
    const btn = /** @type {HTMLButtonElement} */ (h("button", {
      type: "button",
      className: "day-chip",
      "data-day-id": day.id,
      "data-testid": `day-chip-${day.number}`,
      onclick: () => onSelect(day.id),
    },
      h("span", { className: "day-chip__num" }, `第 ${day.number} 天`),
      h("span", { className: "day-chip__date" }, formatDate(day.date, locale)),
      h("span", { className: "day-chip__sub" },
        h("span", {}, formatDate(day.date, locale, { weekday: "short", month: undefined, day: undefined })),
        h("span", { className: "day-chip__city" }, day.baseCity)),
      day.id === todayId && h("span", { className: "day-chip__today" }, "今天"),
    ));
    buttons.set(day.id, btn);
    list.appendChild(h("li", {}, btn));
  }

  // 方向鍵在日期間移動焦點；Enter / Space 由原生 button 觸發選取
  list.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const all = [...buttons.values()];
    const current = all.indexOf(/** @type {HTMLButtonElement} */ (document.activeElement));
    if (current === -1) return;
    event.preventDefault();
    let next = current;
    if (event.key === "ArrowLeft") next = Math.max(0, current - 1);
    if (event.key === "ArrowRight") next = Math.min(all.length - 1, current + 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = all.length - 1;
    all[next].focus();
  });

  replaceChildren(root, h("div", { className: "day-selector__inner" }, list));

  /**
   * 只水平捲動日期列，不捲動整頁，也不改變鍵盤焦點的起點。
   * @param {HTMLElement} container
   * @param {HTMLElement} chip
   */
  const revealChip = (container, chip) => {
    const c = container.getBoundingClientRect();
    const b = chip.getBoundingClientRect();
    const pad = 16;
    let delta = 0;
    if (b.left < c.left + pad) delta = b.left - c.left - pad;
    else if (b.right > c.right - pad) delta = b.right - c.right + pad;
    if (delta !== 0) container.scrollBy({ left: delta, behavior: scrollBehavior() });
  };

  return {
    /** @param {string} dayId */
    setSelected(dayId) {
      for (const [id, btn] of buttons) {
        if (id === dayId) {
          btn.setAttribute("aria-current", "date");
          revealChip(list, btn);
        } else {
          btn.removeAttribute("aria-current");
        }
      }
    },
  };
};
