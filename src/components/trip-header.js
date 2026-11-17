/**
 * 旅行摘要（Header）。
 * @module components/trip-header
 */

import { h, icon, replaceChildren } from "../utils/dom.js";
import { formatDateRange, formatDate, daysBetween } from "../utils/date.js";
import { TRANSPORT_MODES } from "../config.js";
import { safeImageSrc } from "../utils/sanitize.js";

/**
 * @param {import("../utils/date.js").TripStatus} status
 * @returns {string}
 */
export const describeStatus = (status) => {
  if (status.state === "upcoming") {
    return status.daysUntil === 1 ? "明天出發" : `距離出發還有 ${status.daysUntil} 天`;
  }
  if (status.state === "ongoing") return `旅程進行中，今天是第 ${status.dayNumber} 天`;
  return "旅程已結束";
};

/**
 * @param {HTMLElement} root
 * @param {object} model
 * @param {object} model.trip
 * @param {object[]} model.days
 * @param {import("../utils/date.js").TripStatus} model.status
 * @param {{ onCopyLink: () => void, onNativeShare: (() => void) | null, onPrint: () => void }} actions
 */
export const createTripHeader = (root, { trip, days, status }, actions) => {
  const locale = trip.locale || "zh-TW";
  const totalDays = daysBetween(trip.startDate, trip.endDate) + 1;
  // 最後一天通常是返程、沒有住宿，因此路線以前幾晚的住宿基地計算
  const nights = days.length > 1 ? days.slice(0, -1) : days;
  const cities = [...new Set(nights.map((d) => d.baseCity))];
  const route = cities.length > 1 ? `${cities[0]} 到 ${cities.at(-1)}，住宿 ${cities.length} 地` : cities[0] ?? "";

  const selectedLabel = h("span", { className: "trip-header__selected", "data-testid": "selected-day-label" });
  const cover = safeImageSrc(trip.coverImage);

  replaceChildren(
    root,
    h("div", { className: "trip-header__inner" },
      cover && h("img", {
        className: "trip-header__cover", src: cover, alt: "", width: 1600, height: 600, decoding: "async",
        onerror: (e) => e.currentTarget.remove(),
      }),
      h("div", { className: "trip-header__text" },
        h("p", { className: "trip-header__brand" }, "TripCanvas 旅程畫布"),
        h("h1", { className: "trip-header__title", "data-testid": "trip-title" }, trip.title),
        trip.subtitle && h("p", { className: "trip-header__subtitle" }, trip.subtitle),
        h("dl", { className: "trip-facts" },
          fact("calendar", "日期", h("span", {}, `${formatDateRange(trip.startDate, trip.endDate, locale)}，共 ${totalDays} 天`)),
          route && fact("pin", "路線", route),
          fact("car", "交通", TRANSPORT_MODES[trip.transportMode] ?? trip.transportMode),
          fact("info", "狀態", h("span", { "data-testid": "trip-status" }, describeStatus(status))),
          fact("list", "目前查看", selectedLabel),
        ),
      ),
      h("div", { className: "trip-header__actions" },
        h("button", { type: "button", className: "btn btn--ghost", onclick: actions.onCopyLink, "data-testid": "copy-link" },
          icon("link"), h("span", {}, "複製連結")),
        actions.onNativeShare && h("button", { type: "button", className: "btn btn--ghost", onclick: actions.onNativeShare },
          icon("share"), h("span", {}, "分享")),
        h("button", { type: "button", className: "btn btn--ghost", onclick: actions.onPrint },
          icon("print"), h("span", {}, "列印")),
      ),
    ),
  );

  return {
    /** @param {object} day */
    setSelectedDay(day) {
      selectedLabel.textContent = `第 ${day.number} 天，${formatDate(day.date, locale, { weekday: "short" })}`;
    },
  };
};

/**
 * @param {string} iconName
 * @param {string} term
 * @param {Node | string} value
 */
const fact = (iconName, term, value) =>
  h("div", { className: "trip-facts__row" },
    h("dt", {}, icon(iconName), h("span", {}, term)),
    h("dd", {}, value),
  );
