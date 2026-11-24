import test from "node:test";
import assert from "node:assert/strict";
import { sheetHtml } from "../js/core/ui-sheet.js";

test("遮罩和取消按钮带同一个关闭属性", () => {
  const h = sheetHtml({ title: "标题", label: "名字", list: "<i>x</i>", closeAttr: "data-lp-close", cancelText: "取消" });
  assert.equal(h.match(/data-lp-close/g).length, 2);
  assert.match(h, /<h3>标题<\/h3>/);
  assert.match(h, /aria-label="名字"/);
  assert.match(h, /<div class="fam-sheet-list"><i>x<\/i><\/div>/);
});
test("没有标题不画 h3；label 和取消文字会转义", () => {
  const h = sheetHtml({ label: 'a"<b', cancelText: "<x>" });
  assert.doesNotMatch(h, /<h3>/);
  assert.match(h, /a&quot;&lt;b/); assert.match(h, /&lt;x&gt;/);
});

import { cycleFocus } from "../js/core/ui-sheet.js";
test("Tab 在面板里转圈", () => {
  const [a, b, c] = [{}, {}, {}], list = [a, b, c];
  assert.equal(cycleFocus(list, a, false), b);
  assert.equal(cycleFocus(list, c, false), a);   // 末尾回到开头
  assert.equal(cycleFocus(list, a, true), c);    // Shift+Tab 从开头回到末尾
  assert.equal(cycleFocus(list, {}, false), a);  // 焦点在面板外：从头开始
  assert.equal(cycleFocus(list, {}, true), c);
  assert.equal(cycleFocus([], a, false), null);
});
