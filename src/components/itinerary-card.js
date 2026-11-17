/**
 * 單一行程項目卡片。
 * @module components/itinerary-card
 */

import { h, icon } from "../utils/dom.js";
import { formatCurrency } from "../utils/currency.js";
import { formatDate, daysBetween } from "../utils/date.js";
import { safeHttpsUrl, safeImageSrc } from "../utils/sanitize.js";
import { getNavigationUrl } from "../services/navigation.js";
import { ITEM_TYPES, COST_STATUS, BOOKING_STATUS, STALE_AFTER_DAYS, PLACEHOLDER_IMAGE } from "../config.js";

/**
 * 交通類型依 tags 選擇 icon。
 * @param {object} item
 * @returns {string}
 */
export const iconForItem = (item) => {
  if (item.type !== "transport") return ITEM_TYPES[item.type]?.icon ?? "info";
  const tags = item.tags ?? [];
  if (tags.some((t) => ["flight", "airport", "plane"].includes(t))) return "plane";
  if (tags.some((t) => ["train", "transit", "shuttle", "bus"].includes(t))) return "train";
  return "car";
};

/**
 * @param {string | undefined} lastVerifiedAt
 * @param {string} today
 * @param {string} locale
 * @returns {HTMLElement | null}
 */
const freshness = (lastVerifiedAt, today, locale) => {
  if (!lastVerifiedAt) return null;
  const stale = daysBetween(lastVerifiedAt, today) > STALE_AFTER_DAYS;
  return h("p", { className: `card__fresh${stale ? " card__fresh--stale" : ""}` },
    `資料驗證日期 ${formatDate(lastVerifiedAt, locale, { year: "numeric" })}`,
    stale && h("span", { className: "card__stale" }, "，建議重新確認"),
  );
};

/**
 * @param {object} item NormalizedItem
 * @param {object} ctx
 * @param {string} ctx.locale
 * @param {string} ctx.today
 * @param {(itemId: string) => void} ctx.onSelect
 * @returns {HTMLLIElement}
 */
export const createItineraryCard = (item, { locale, today, onSelect }) => {
  const type = ITEM_TYPES[item.type] ?? ITEM_TYPES.note;
  const titleId = `item-title-${item.id}`;
  const place = item.place;
  const navUrl = getNavigationUrl(place);
  const website = safeHttpsUrl(place?.websiteUrl);
  const image = safeImageSrc(place?.image);
  const booking = item.booking?.status ? BOOKING_STATUS[item.booking.status] : null;

  const timeBlock = item.startTime
    ? h("p", { className: "tl-time" },
        h("time", { className: "tl-time__start" }, item.startTime),
        item.endTime && h("span", { className: "tl-time__end" },
          h("span", { className: "visually-hidden" }, "至"), item.endTime),
      )
    : h("p", { className: "tl-time tl-time--none" }, h("span", {}, "不限時間"));

  const node = h("span", { className: "tl-node", "aria-hidden": "true" },
    item.markerNumber !== null ? String(item.markerNumber) : icon(iconForItem(item), "icon icon--node"));

  const titleContent = item.hasCoordinates
    ? h("button", {
        type: "button",
        className: "card__select",
        "aria-pressed": "false",
        "data-testid": "card-select",
        onclick: () => onSelect(item.id),
      },
        h("span", { className: "visually-hidden" }, `地點 ${item.markerNumber}：`),
        item.title,
        h("span", { className: "visually-hidden" }, "，在地圖上顯示"),
      )
    : item.title;

  const costNode = item.cost
    ? h("li", { className: "card__meta-item" }, icon("wallet"),
        typeof item.cost.amount === "number" && item.cost.status !== "unknown"
          ? `${COST_STATUS[item.cost.status] ?? "預估"} ${formatCurrency(item.cost.amount, item.cost.currency, locale)}`
          : "費用尚未提供")
    : null;

  const img = image && h("img", {
    className: "card__image",
    src: image,
    alt: place?.name ? `${place.name} 照片` : "",
    width: 640,
    height: 360,
    loading: "lazy",
    decoding: "async",
  });
  if (img) {
    img.addEventListener("error", () => {
      if (img.dataset.fallback) return; // 只替換一次
      img.dataset.fallback = "1";
      img.src = PLACEHOLDER_IMAGE;
      img.alt = "";
    });
  }

  const article = h("article", {
    className: "tl-item",
    "data-type": item.type,
    "data-item-id": item.id,
    "aria-labelledby": titleId,
    "data-testid": "timeline-item",
  },
    timeBlock,
    node,
    h("div", { className: "card" },
      h("div", { className: "card__head" },
        h("p", { className: "card__type" }, icon(iconForItem(item)), h("span", {}, type.label)),
        item.locked && h("p", { className: "badge badge--locked" }, icon("lock"), h("span", {}, booking === "已預訂" ? "已預訂" : "已鎖定")),
        !item.locked && booking && h("p", { className: `badge badge--${item.booking.status}` }, booking),
      ),
      h("h3", { className: "card__title", id: titleId }, titleContent),
      item.description && h("p", { className: "card__desc" }, item.description),
      place && h("p", { className: "card__place" },
        icon("pin"),
        h("span", {},
          h("span", { className: "card__place-name" }, place.name),
          place.address && h("span", { className: "card__address" }, place.address),
          !item.hasCoordinates && h("span", { className: "card__address" }, "未提供座標，不顯示於地圖"),
        ),
      ),
      img,
      (costNode || item.booking?.provider) && h("ul", { className: "card__meta", role: "list" },
        costNode,
        item.booking?.provider && h("li", { className: "card__meta-item" }, icon("check"), item.booking.provider),
      ),
      freshness(place?.lastVerifiedAt, today, locale),
      (navUrl || website) && h("div", { className: "card__actions" },
        navUrl && h("a", {
          className: "btn btn--primary btn--small",
          href: navUrl,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-testid": "nav-link",
          "data-needs-network": "",
        }, icon("navigate"), h("span", {}, "導航"), h("span", { className: "visually-hidden" }, `到 ${place?.name ?? item.title}（開新分頁）`)),
        website && h("a", {
          className: "btn btn--ghost btn--small",
          href: website,
          target: "_blank",
          rel: "noopener noreferrer",
          "data-needs-network": "",
        }, icon("link"), h("span", {}, "官網"), h("span", { className: "visually-hidden" }, `${place?.name ?? item.title}（開新分頁）`)),
      ),
    ),
  );

  return /** @type {HTMLLIElement} */ (h("li", { className: "tl-row" }, article));
};
