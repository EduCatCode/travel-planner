/**
 * 每日時間軸。不持有全域可變資料；選取透過 callback 通知。
 * @module components/timeline
 */

import { h, replaceChildren, scrollBehavior } from "../utils/dom.js";
import { createItineraryCard } from "./itinerary-card.js";

/**
 * @param {HTMLElement} root
 * @param {{ onSelectItem: (itemId: string, origin: "card") => void }} options
 */
export const createTimeline = (root, { onSelectItem }) => {
  /** @type {Map<string, HTMLElement>} */
  let articles = new Map();

  return {
    /**
     * @param {object} day normalized day
     * @param {{ locale: string, today: string }} ctx
     */
    render(day, ctx) {
      articles = new Map();
      if (day.items.length === 0) {
        replaceChildren(root, h("div", { className: "empty-state", "data-testid": "timeline-empty" },
          h("p", { className: "empty-state__title" }, "這天還沒有安排行程"),
          h("p", {}, "在 itinerary.json 的這一天加入 items，就會依時間顯示在這裡。"),
        ));
        return;
      }
      const fragment = document.createDocumentFragment();
      const list = h("ol", { className: "timeline", role: "list", "data-testid": "timeline" });
      for (const item of day.items) {
        const row = createItineraryCard(item, { ...ctx, onSelect: (id) => onSelectItem(id, "card") });
        articles.set(item.id, /** @type {HTMLElement} */ (row.firstElementChild));
        list.appendChild(row);
      }
      fragment.appendChild(list);
      replaceChildren(root, fragment);
    },

    /**
     * @param {string | null} itemId
     * @param {{ scroll?: boolean }} [options]
     */
    setSelected(itemId, { scroll = false } = {}) {
      for (const [id, el] of articles) {
        const selected = id === itemId;
        el.classList.toggle("is-selected", selected);
        el.querySelector(".card__select")?.setAttribute("aria-pressed", String(selected));
      }
      const target = itemId ? articles.get(itemId) : null;
      if (target && scroll) {
        target.scrollIntoView({ block: "center", behavior: scrollBehavior() });
      }
    },
  };
};
