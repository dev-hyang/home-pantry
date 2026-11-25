/* 库存页的同步小件：分类表单、移动分类。 */
import { COLORS, ICONS } from "../core/categories.js";
import { esc } from "../core/util.js";
import { t } from "../core/i18n.js";
import { ORDER_KEY, orderedCats, parentSelect } from "./inventory-sync-common.js";

/** 把某个分类往前 / 往后挪一位 */
export function moveCat(space, id, dir) {
  const ids = orderedCats(space).map((c) => c.id), i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  try { localStorage.setItem(ORDER_KEY(space), JSON.stringify(ids)); } catch { /* 忽略 */ }
}
/** 分类表单（新建自建分类 / 编辑自建或内置分类）：名称、图标、颜色、常用小类。内置分类改过的叫“覆盖”，可恢复默认或隐藏 */
export function catFormHtml(cf) {
  const editing = !!cf.key, builtin = !!cf.builtin, overridden = builtin && !!cf.id;
  const iconList = cf.icon && !ICONS.includes(cf.icon) ? [cf.icon, ...ICONS] : ICONS;   // 内置分类的图标不在候选里时也要能选中
  const icons = iconList.map((i) => `<label class="ico-pick"><input type="radio" name="icon" value="${i}" ${(cf.icon || ICONS[0]) === i ? "checked" : ""}><span>${i}</span></label>`).join("");
  const colorList = cf.color && !COLORS.includes(cf.color) ? [cf.color, ...COLORS] : COLORS;
  const colors = colorList.map((c) => `<label class="color-pick"><input type="radio" name="color" value="${c}" ${(cf.color || COLORS[0]) === c ? "checked" : ""}><span style="--c:${c}"></span></label>`).join("");
  const sub = builtin ? t("内置分类：改名、换图标颜色、增删小类都可以，全家共用；“恢复默认”退回内置设置") : t("会出现在方块、筛选芯片、物品分类下拉和统计里，全家共用");
  return `<form id="catForm" class="panel cat-form">
    <input type="hidden" name="space" value="${esc(cf.space)}">
    <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${editing ? t("编辑分类") : t("新分类")}${cf.hidden ? ` <span class="badge" style="background:var(--surface-2)">${t("已隐藏")}</span>` : ""}</h3><p>${sub}</p></div>
    <div class="form-grid">
      <label>${t("分类名")}<input name="name" required maxlength="20" placeholder="${t("例如：露营食品、手工材料")}" value="${esc(cf.name || "")}"></label>
      <label>${t("小类（逗号分隔，可选）")}<input name="subs" maxlength="200" placeholder="${t("例如：帐篷食品, 速食, 饮用水")}" value="${esc((cf.subs || []).join(", "))}"><small>${t("物品表单的“小类”下拉就按这里的顺序；改名不会改已有物品上的小类文字")}</small></label>
      ${builtin ? "" : parentSelect(cf)}
    </div>
    <div class="pick-row" role="group" aria-label="${t("图标")}">${icons}</div>
    <div class="pick-row" role="group" aria-label="${t("颜色")}">${colors}</div>
    <div class="ui-acts" style="margin-top:10px"><button type="submit" class="ui-btn" data-size="sm" data-tone="primary">${editing ? t("保存") : t("添加分类")}</button>
      <button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="cat-cancel">${t("取消")}</button>
      ${editing ? `<span class="spacer"></span>${builtin
        ? `${overridden ? `<button type="button" class="ui-btn" data-size="sm" data-tone="ghost" data-action="cat-restore" data-cat="${esc(cf.key)}">${t("恢复默认")}</button>` : ""}<button type="button" class="ui-btn" data-size="sm" data-tone="danger" data-action="cat-hide" data-cat="${esc(cf.key)}" data-on="${cf.hidden ? "0" : "1"}">${cf.hidden ? t("重新显示") : t("隐藏分类")}</button>`
        : `<button type="button" class="ui-btn" data-size="sm" data-tone="danger" data-action="cat-delete" data-cat="${esc(cf.key)}">${t("删除分类")}</button>`}` : ""}</div>
  </form>`;
}
