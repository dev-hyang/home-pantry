/* 后台刷新不能冲掉表单里还没保存的输入：重画前记下、重画后填回。 */


/** 表单里与渲染默认值不同的字段（用户正在填的）；没有改动返回 null */
export function dirtyFields(f) {
  const vals = {};
  for (const el of f.elements) {
    if (!el.name) continue;
    if (el.type === "radio") { if (el.checked && !el.defaultChecked) vals[el.name] = { radio: el.value }; }   // 单选：记选中的那个值
    else if (el.type === "checkbox") { if (el.checked !== el.defaultChecked) vals[el.name] = { checked: el.checked }; }
    else if (el.tagName === "SELECT") { const def = [...el.options].find((o) => o.defaultSelected)?.value ?? el.options[0]?.value; if (el.value !== def) vals[el.name] = { value: el.value }; }
    else if (el.value !== el.defaultValue) vals[el.name] = { value: el.value };
  }
  return Object.keys(vals).length ? vals : null;
}
/** 一张表单的「身份」：有 id 用 id（再带上 data-id，换了编辑对象就不算同一张），没有就按它在 #main 里是第几张表单 */
const formKey = (f, i) => (f.id ? `#${f.id}|${f.dataset.id || ""}` : `@${i}|${f.dataset.id || ""}`);
export function keepUnsaved() {
  const forms = [...document.querySelectorAll("#main form")];
  const list = forms.map((f, i) => { if (f.dataset.saved) return null; const vals = dirtyFields(f); return vals ? { key: formKey(f, i), vals } : null; }).filter(Boolean);
  // 正在输入的那一格（表单里外都算，比如搜索框）：画完把焦点和光标放回去
  const a = document.activeElement, inMain = a && a !== document.body && a.closest?.("#main");
  const focus = inMain && (a.name || a.id) ? { form: a.form ? formKey(a.form, forms.indexOf(a.form)) : null, name: a.name, id: a.id, s: a.selectionStart, e: a.selectionEnd, value: a.form ? null : a.value } : null;
  // 表单外、没有 name 的输入框也要留（2026-11-14：购物车每一行的花费 / 在哪买 / 用卡——选了特价顺手填的商店名，保存后家人同步一重画就没了）：带 data-keep 的都算
  const loose = [...document.querySelectorAll("#main [data-keep]")].map((el) => {
    const def = el.tagName === "SELECT" ? ([...el.options].find((o) => o.defaultSelected)?.value ?? el.options[0]?.value) : el.defaultValue;
    return el.value !== def ? { key: el.dataset.keep, value: el.value } : null;
  }).filter(Boolean);
  return { list, focus, loose };
}
export function restoreUnsaved({ list, focus, loose = [] }) {
  for (const k of loose) { const el = document.querySelector(`#main [data-keep="${CSS.escape(k.key)}"]`); if (el && el.value !== k.value) el.value = k.value; }
  const forms = [...document.querySelectorAll("#main form")], byKey = new Map(forms.map((f, i) => [formKey(f, i), f]));
  for (const k of list) {
    const f = byKey.get(k.key); if (!f) continue;
    for (const [n, v] of Object.entries(k.vals)) {
      const el = f.elements[n]; if (!el) continue;
      if ("radio" in v) { if (el instanceof RadioNodeList) el.value = v.radio; else el.checked = el.value === v.radio; continue; }
      if ("checked" in v) el.checked = v.checked; else el.value = v.value;
    }
    markDirty(f, true);
  }
  if (!focus) return;
  const f = focus.form ? byKey.get(focus.form) : null;
  const el = f ? f.elements[focus.name] : (focus.id ? document.getElementById(focus.id) : document.querySelector(`#main [name="${CSS.escape(focus.name)}"]`));
  if (!el || el instanceof RadioNodeList || typeof el.focus !== "function") return;
  if (focus.value != null && el.value !== focus.value) el.value = focus.value;   // 表单外的输入框（搜索）
  el.focus({ preventScroll: true });
  try { if (focus.s != null) el.setSelectionRange(focus.s, focus.e); } catch { /* 日期、数字框不支持光标位置 */ }
}
/** 表单有未保存改动：显示“有未保存的修改”，保存按钮加粗提示 */
export function markDirty(f, on) {
  f.classList.toggle("is-dirty", on);
  const note = f.querySelector(".dirty-note"); if (note) note.hidden = !on;
}
