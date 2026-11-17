/**
 * 行李、預訂與待辦清單。勾選狀態只存在 LocalStorage，不寫回 JSON。
 * @module components/checklist
 */

import { h, replaceChildren, announce } from "../utils/dom.js";

const CATEGORY_LABELS = {
  documents: "證件",
  clothing: "衣物",
  gear: "裝備",
  electronics: "電子用品",
  health: "健康",
  booking: "預訂",
  money: "金錢",
  prep: "行前準備",
};

/**
 * @param {HTMLElement} root
 * @param {object} options
 * @param {object[]} options.checklists
 * @param {ReturnType<typeof import("../services/storage.js").createTripStore>} options.store
 * @param {(message: string) => boolean} [options.confirm]
 */
export const createChecklist = (root, { checklists, store, confirm = (m) => window.confirm(m) }) => {
  const render = () => {
    if (checklists.length === 0) {
      replaceChildren(root, h("p", { className: "muted" }, "行程資料沒有清單。可在 itinerary.json 的 checklists 加入。"));
      return;
    }

    const persistNote = store.storage.persistent
      ? null
      : h("p", { className: "notice notice--warning", role: "status" },
          "此瀏覽器無法使用本機儲存，本次勾選在重新整理後不會保留。");

    const lists = checklists.map((list) => {
      const state = store.getChecklist(list.id);
      const total = list.items.length;
      const progressText = h("span", { "data-testid": `progress-${list.id}` });
      const progressBar = /** @type {HTMLProgressElement} */ (h("progress", { max: String(Math.max(total, 1)), value: "0", "aria-hidden": "true" }));

      const updateProgress = () => {
        const done = list.items.filter((i) => store.getChecklist(list.id)[i.id]).length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        progressText.textContent = `已完成 ${done} / ${total}（${pct}%）`;
        progressBar.value = done;
      };

      const items = list.items.map((entry) => {
        const id = `chk-${list.id}-${entry.id}`;
        const input = /** @type {HTMLInputElement} */ (h("input", {
          type: "checkbox",
          id,
          className: "checkbox",
          "data-testid": `checkbox-${list.id}-${entry.id}`,
        }));
        input.checked = Boolean(state[entry.id]);
        input.addEventListener("change", () => {
          store.setChecklistItem(list.id, entry.id, input.checked);
          updateProgress();
        });
        return h("li", { className: "check-item" },
          input,
          h("label", { for: id },
            h("span", { className: "check-item__label" }, entry.label),
            entry.required && h("span", { className: "tag tag--required" }, "必要"),
            entry.category && h("span", { className: "tag" }, CATEGORY_LABELS[entry.category] ?? entry.category),
          ),
        );
      });

      updateProgress();
      return h("section", { className: "checklist", "aria-labelledby": `cl-${list.id}` },
        h("div", { className: "checklist__head" },
          h("h3", { id: `cl-${list.id}` }, list.title),
          h("p", { className: "checklist__progress" }, progressText),
        ),
        progressBar,
        h("ul", { className: "check-items", role: "list" }, items),
      );
    });

    const clearBtn = h("button", {
      type: "button",
      className: "btn btn--ghost btn--danger",
      "data-testid": "clear-checklist",
      onclick: () => {
        if (!confirm("要清除這趟旅程在此裝置上的所有勾選狀態嗎？這個動作無法復原。")) return;
        store.clearChecklists();
        render();
        announce("已清除本機勾選狀態");
      },
    }, "清除本機勾選狀態");

    replaceChildren(root,
      persistNote,
      h("div", { className: "checklists" }, lists),
      h("div", { className: "checklist__footer" },
        h("p", { className: "muted" }, "勾選狀態只保存在這台裝置的瀏覽器，不會分享給他人。"),
        clearBtn,
      ),
    );
  };

  render();
  store.storage.onChange(render);
  return { render };
};
