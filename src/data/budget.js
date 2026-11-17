/**
 * 預算彙整。不同幣別分開加總；未知金額不當成 0。
 * @module data/budget
 */

/**
 * @typedef {object} BudgetSummary
 * @property {{ currency: string, total: number, categories: { category: string, amount: number }[] }[]} byCurrency
 * @property {{ title: string, dayNumber: number }[]} unknown 有 cost 但無金額的項目
 * @property {number} itemCount 有金額的項目數
 */

/**
 * @param {readonly object[]} days normalized days
 * @returns {BudgetSummary}
 */
export const summarizeBudget = (days) => {
  /** @type {Map<string, Map<string, number>>} */
  const map = new Map();
  const unknown = [];
  let itemCount = 0;

  for (const day of days) {
    for (const item of day.items) {
      const cost = item.cost;
      if (!cost) continue;
      if (typeof cost.amount !== "number" || !Number.isFinite(cost.amount) || cost.status === "unknown") {
        unknown.push({ title: item.title, dayNumber: day.number });
        continue;
      }
      const category = cost.category || item.type || "other";
      if (!map.has(cost.currency)) map.set(cost.currency, new Map());
      const cat = map.get(cost.currency);
      cat.set(category, (cat.get(category) ?? 0) + cost.amount);
      itemCount += 1;
    }
  }

  const byCurrency = [...map.entries()].map(([currency, cats]) => {
    const categories = [...cats.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount);
    return { currency, total: round2(categories.reduce((s, c) => s + c.amount, 0)), categories };
  });

  return { byCurrency, unknown, itemCount };
};

const round2 = (n) => Math.round(n * 100) / 100;
