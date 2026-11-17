/**
 * 預算摘要：依幣別與類別彙整。
 * @module components/budget-summary
 */

import { h, replaceChildren } from "../utils/dom.js";
import { formatCurrency } from "../utils/currency.js";
import { COST_CATEGORIES } from "../config.js";

/**
 * @param {HTMLElement} root
 * @param {import("../data/budget.js").BudgetSummary} summary
 * @param {string} locale
 */
export const renderBudget = (root, summary, locale) => {
  if (summary.byCurrency.length === 0 && summary.unknown.length === 0) {
    replaceChildren(root, h("p", { className: "muted" }, "行程項目尚未填寫費用。"));
    return;
  }

  replaceChildren(root,
    h("div", { className: "budget" },
      summary.byCurrency.map((group) =>
        h("section", { className: "budget__group", "aria-label": `${group.currency} 預算`, "data-testid": `budget-${group.currency}` },
          h("p", { className: "budget__total" },
            h("span", { className: "budget__total-label" }, `${group.currency} 小計`),
            h("span", { className: "budget__total-value" }, formatCurrency(group.total, group.currency, locale)),
          ),
          h("table", { className: "budget__table" },
            h("caption", { className: "visually-hidden" }, `${group.currency} 依類別`),
            h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "類別"), h("th", { scope: "col" }, "金額"))),
            h("tbody", {}, group.categories.map((c) =>
              h("tr", {},
                h("th", { scope: "row" }, COST_CATEGORIES[c.category] ?? c.category),
                h("td", {}, formatCurrency(c.amount, group.currency, locale)),
              ))),
          ),
        )),
    ),
    summary.byCurrency.length > 1 && h("p", { className: "muted" }, "不同幣別分開計算，未做匯率換算。"),
    summary.unknown.length > 0 && h("div", { className: "budget__unknown", "data-testid": "budget-unknown" },
      h("p", {}, `尚未提供金額：${summary.unknown.length} 項（未計入小計）`),
      h("ul", { role: "list" }, summary.unknown.map((u) => h("li", {}, `第 ${u.dayNumber} 天：${u.title}`))),
    ),
    h("p", { className: "muted" }, "金額為行程資料中的預估值，實際價格請以官方或訂單為準。"),
  );
};
