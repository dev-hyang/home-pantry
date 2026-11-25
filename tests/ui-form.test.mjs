import test from "node:test";
import assert from "node:assert/strict";
import { formBar, formMenu } from "../shared/ui-form.js";

const roles = (html) => [...html.matchAll(/data-role="(\w+)"/g)].map((m) => m[1]);
test("edit：取消在前、保存在后，不管传入顺序", () => {
  const h = formBar("edit", [{ role: "save", label: "保存", attrs: 'type="submit"' }, { role: "cancel", label: "取消", attrs: 'data-act="close"' }]);
  assert.deepEqual(roles(h), ["cancel", "save"]);
  assert.match(h, /data-variant="edit"/);
  assert.match(h, /<button type="submit"|<button class="ui-btn" data-tone="primary" data-role="save" type="submit"/);
  assert.match(h, /<button type="button" class="ui-btn" data-tone="ghost" data-role="cancel" data-act="close">/);
});
test("wizard：取消 · 上一步 · 下一步", () => {
  assert.deepEqual(roles(formBar("wizard", [{ role: "next", label: "下一步" }, { role: "back", label: "上一步" }, { role: "cancel", label: "取消" }])), ["cancel", "back", "next"]);
});
test("inline：保存在前、取消在后", () => {
  assert.deepEqual(roles(formBar("inline", [{ role: "cancel", label: "取消" }, { role: "save", label: "保存" }])), ["save", "cancel"]);
});
test("未知 variant 当 edit；未知 role 当 extra；label 转义；空项跳过", () => {
  const h = formBar("nope", [null, { role: "weird", label: "<b>x</b>" }, { role: "save", label: "保存" }]);
  assert.match(h, /data-variant="edit"/);
  assert.deepEqual(roles(h), ["extra", "save"]);
  assert.ok(!h.includes("<b>x</b>") && h.includes("&lt;b&gt;"));
});
test("formMenu：没有菜单项返回空串；危险项带 data-tone", () => {
  assert.equal(formMenu([]), "");
  assert.equal(formMenu([null]), "");
  const m = formMenu([{ label: "删除", attrs: 'data-act="del"', tone: "danger" }, { label: "加到歌单…", attrs: 'data-act="to-list"' }]);
  assert.match(m, /<details class="ui-more">/);
  assert.match(m, /data-tone="danger" data-act="del">删除/);
  assert.match(m, /aria-label="更多操作"/);
});
