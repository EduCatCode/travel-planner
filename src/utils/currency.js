/**
 * 貨幣工具。
 * @module utils/currency
 */

/**
 * @param {unknown} code
 * @returns {code is string}
 */
export const isCurrencyCode = (code) =>
  typeof code === "string" && /^[A-Z]{3}$/.test(code);

/**
 * @param {number} amount
 * @param {string} currency ISO 4217
 * @param {string} locale
 * @returns {string}
 */
export const formatCurrency = (amount, currency, locale) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
