import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-restricted-properties": ["error",
        { property: "innerHTML", message: "請使用 utils/dom.js 的 h()，不得以 innerHTML 插入內容。" },
        { property: "outerHTML", message: "不得使用 outerHTML。" }],
      "no-restricted-syntax": ["error",
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: "不得使用 insertAdjacentHTML。" }],
    },
  },
  {
    files: ["public/service-worker.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.serviceworker } },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "*.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: { ...globals.node, ...globals.browser } },
  },
];
