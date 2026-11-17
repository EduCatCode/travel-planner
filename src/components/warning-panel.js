/**
 * 限制檢查顯示。每個狀態同時有 icon、文字與顏色，不只依賴顏色。
 * @module components/warning-panel
 */

import { h, icon, replaceChildren } from "../utils/dom.js";
import { formatDuration } from "../utils/date.js";

const LEVELS = {
  normal: { label: "正常", icon: "check" },
  warning: { label: "注意", icon: "alert" },
  blocker: { label: "超過上限", icon: "stop" },
};

/**
 * @param {import("../data/constraints.js").CheckResult} check
 * @param {string} [testId]
 */
const row = (check, testId) => {
  const level = LEVELS[check.level];
  return h("li", { className: `check check--${check.level}`, "data-level": check.level, "data-testid": testId },
    icon(level.icon, "icon check__icon"),
    h("p", { className: "check__text" },
      h("span", { className: "check__level" }, `${level.label}：`),
      h("span", { className: "check__title" }, check.title),
      check.detail && h("span", { className: "check__detail" }, check.detail),
    ),
  );
};

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof import("../data/constraints.js").checkDay>} result
 * @param {number | undefined} distanceKm
 * @param {{ showDrive?: boolean }} [options] 非自駕行程不顯示駕車列
 */
export const renderDayChecks = (root, result, distanceKm, { showDrive = true } = {}) => {
  const { drive } = result;
  const driveText = drive.max
    ? `上限 ${formatDuration(drive.max)}${drive.level === "blocker" ? `，超過 ${formatDuration(drive.minutes - drive.max)}` : ""}`
    : "未設定每日上限";
  const driveCheck = {
    id: "drive",
    level: drive.level,
    title: `駕車約 ${formatDuration(drive.minutes)}${typeof distanceKm === "number" ? `（${distanceKm} 公里）` : ""}`,
    detail: driveText,
  };
  replaceChildren(root,
    h("ul", { className: "checks", role: "list" },
      showDrive && row(driveCheck, "drive-check"),
      result.checks.map((c) => row(c, `check-${c.id}`)),
    ),
  );
};

/**
 * @param {HTMLElement} root
 * @param {import("../data/constraints.js").CheckResult[]} checks
 */
export const renderTripChecks = (root, checks) => {
  if (checks.length === 0) {
    replaceChildren(root, h("p", { className: "muted" }, "未設定旅程限制。"));
    return;
  }
  replaceChildren(root, h("ul", { className: "checks", role: "list" }, checks.map((c) => row(c, `trip-check-${c.id}`))));
};
