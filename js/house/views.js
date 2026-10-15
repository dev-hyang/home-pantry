/* 房屋维护 · 第一期：房屋资料（房型、材料、设施）、责任归属、材料保养建议、按模板批量加入房屋耗材 */
import { alertsOf } from "../core/logic.js";
import { state } from "../core/state.js";
import { href } from "../core/router.js";
import { esc, inSpace } from "../core/util.js";
import { restockPanel, shelfGrid } from "../pantry/views.js";

const H = () => window.HOUSE;

/** 默认地区：设备时区在北美 → 北美模板，否则中国模板 */
export const defaultRegion = () => (Units.region.system === "us" ? "na" : "cn");

/** 编辑中的房屋资料草稿（切换地区、房型时重新渲染表单，草稿保证已填内容不丢） */
export function houseDraft() {
  if (!state.houseDraft) {
    const p = state.houseProfile;
    if (p) state.houseDraft = { ...p, features: [...(p.features || [])], exterior: [...(p.exterior || [])], flooring: [...(p.flooring || [])] };
    else {
      const region = defaultRegion(), t = H().HOUSE_TYPES[region][0];
      state.houseDraft = { region, house_type: t.id, year_built: null, features: [...t.features], exterior: [], roof: null, flooring: [] };
    }
  }
  return state.houseDraft;
}

/** 把表单当前值读回草稿 */
export function readHouseForm(form) {
  const d = houseDraft(), fe = form.elements;
  const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
  d.region = fe.region.value;
  d.house_type = fe.house_type.value;
  const y = parseInt(fe.year_built.value, 10);
  d.year_built = Number.isFinite(y) ? y : null;
  d.features = checked("features");
  d.exterior = checked("exterior");
  d.flooring = checked("flooring");
  d.roof = fe.roof.value || null;
  return d;
}

/** 切换房型：按新房型预选设施（之前的勾选会被替换） */
export function applyTypeDefaults(d) {
  const t = H().typeOf(d.region, d.house_type) || H().HOUSE_TYPES[d.region][0];
  d.house_type = t.id;
  d.features = [...t.features];
}

/* ── 房屋概览 ── */
export function viewHouse() {
  const p = state.houseProfile;
  const alerts = alertsOf(state.enriched.filter(inSpace("house")));
  const shelf = shelfGrid("house");
  if (!p) {
    return `<section class="section house-intro">
      <h2>先说说你家的房子</h2>
      <p class="muted">选一下房型、外墙和地面材料、家里有哪些设施，大约 1 分钟。之后会告诉你哪些部位归自己维护、各种材料怎么保养，并一次加好常用的房屋耗材。</p>
      <p><a class="btn btn-primary" href="${href("house", "profile")}">填写房屋资料</a>
         <a class="btn btn-ghost" href="${href("house", "supplies")}">先直接记录耗材</a></p>
    </section>
    ${shelf ? `<section class="section"><div class="section-head"><h2>房屋耗材</h2></div><div class="shelf">${shelf}</div></section>` : ""}`;
  }
  const t = H().typeOf(p.region, p.house_type);
  const names = (group, ids) => ids.map((id) => H().MATERIALS[group].find((m) => m.id === id)).filter(Boolean);
  const ext = names("exterior", p.exterior || []), floors = names("flooring", p.flooring || []);
  const roof = p.roof ? names("roof", [p.roof]) : [];
  const featNames = H().FEATURES.filter((f) => (p.features || []).includes(f.id)).map((f) => f.name);
  const age = p.year_built ? new Date().getFullYear() - p.year_built : null;

  const ownerRows = H().SYSTEMS.map((s) => {
    const o = H().OWNERS[t?.owners?.[s.id] || "varies"];
    return `<tr><th scope="row">${esc(s.name)}</th><td><span class="owner ${o.cls}">${esc(o.name)}</span></td></tr>`;
  }).join("");

  const careBlock = (title, mats) => mats.length ? `<div class="care">
      <h3>${title}</h3>
      ${mats.map((m) => `<details ${mats.length === 1 ? "open" : ""}><summary>${esc(m.name)}</summary><ul>${m.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`).join("")}
    </div>` : "";

  return `
    <section class="section">
      <div class="house-card">
        <span class="house-ico" aria-hidden="true">${t?.icon || "🏠"}</span>
        <div class="grow">
          <h2>${esc(t?.name || "我的房子")}<span class="muted">${esc(t?.en || "")}</span></h2>
          <p class="muted">${esc(H().REGIONS[p.region]?.name || "")}${p.year_built ? `，${p.year_built} 年建成（约 ${age} 年房龄）` : ""}</p>
          <div class="tagline">${[...ext, ...roof, ...floors].map((m) => `<span class="tag">${esc(m.name)}</span>`).join("")}
            ${featNames.map((n) => `<span class="tag tag-soft">${esc(n)}</span>`).join("")}</div>
        </div>
        <a class="btn btn-sm btn-ghost" href="${href("house", "profile")}">修改资料</a>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>房屋耗材提醒</h2>
        <div class="head-acts">${alerts.length ? `<button type="button" class="btn btn-primary btn-sm" data-action="shop-add-alerts" data-space="house">全部加入采购清单</button>` : ""}
          <a class="btn btn-sm btn-ghost" href="${href("house", "template")}">按房屋资料推荐</a></div></div>
      <div class="panel">${alerts.length ? restockPanel(alerts) : shelf ? `<div class="empty"><strong>房屋耗材都充足</strong></div>`
        : `<div class="empty"><strong>还没有房屋耗材</strong>按你家的设施一次加好滤网、电池、融雪盐等。<p><a class="btn btn-primary" href="${href("house", "template")}">查看推荐清单</a></p></div>`}</div>
      ${shelf ? `<div class="shelf" style="margin-top:10px">${shelf}</div>` : ""}
    </section>

    <section class="section">
      <div class="section-head"><h2>哪些部位归谁维护</h2><p>${esc(t?.desc || "")}</p></div>
      <div class="panel"><div class="ch-scroll"><table class="owner-table"><tbody>${ownerRows}</tbody></table></div>
        <p class="disclaimer">这是该房型的常见情况，具体以 HOA 章程、物业服务合同或租约为准。</p></div>
    </section>

    ${ext.length || roof.length || floors.length ? `<section class="section">
      <div class="section-head"><h2>材料保养建议</h2><p>根据你填写的外墙、屋面和地面材料</p></div>
      <div class="panel care-grid">${careBlock("外墙", ext)}${careBlock("屋面", roof)}${careBlock("地面", floors)}</div>
      <p class="disclaimer">周期与寿命为常见经验值，实际以产品说明书和专业人士检查为准。</p>
    </section>` : `<section class="section"><div class="panel empty"><strong>还没填材料</strong>补充外墙、屋面和地面材料后，这里会给出对应的保养建议。<p><a class="btn btn-ghost" href="${href("house", "profile")}">补充材料</a></p></div></section>`}

    <section class="section"><div class="panel next-phase">
      <h3>即将推出</h3>
      <p class="muted">设备档案（炉子、热水器、排水泵、屋顶等）、保养记录、按季节的检修任务和保修到期提醒。</p>
    </div></section>`;
}

/* ── 房屋资料表单（整页） ── */
export function viewHouseProfile() {
  const d = houseDraft(), Hh = H();
  const types = Hh.HOUSE_TYPES[d.region] || [];
  const check = (name, list, sel) => list.map((x) => `<label class="check"><input type="checkbox" name="${name}" value="${x.id}" ${sel.includes(x.id) ? "checked" : ""}><span>${esc(x.name)}</span></label>`).join("");
  const thisYear = new Date().getFullYear();
  return `
    <section class="section form-page house-form">
      <div class="section-head"><h2>房屋资料</h2>
        ${state.houseProfile ? `<a class="btn btn-sm btn-ghost" href="${href("house", "overview")}">返回房屋</a>` : ""}</div>
      <form id="houseForm" class="panel" novalidate>
        <fieldset>
          <legend>地区</legend>
          <div class="seg-radio">${Object.values(Hh.REGIONS).map((r) => `<label class="radio-pill"><input type="radio" name="region" value="${r.id}" ${d.region === r.id ? "checked" : ""}><span>${r.name}<small>${r.hint}</small></span></label>`).join("")}</div>
          <p class="hint">决定房型、材料和耗材推荐用哪一套；和显示单位的地区设置相互独立。</p>
        </fieldset>
        <fieldset>
          <legend>房型</legend>
          <div class="type-grid">${types.map((t) => `<label class="type-card"><input type="radio" name="house_type" value="${t.id}" ${d.house_type === t.id ? "checked" : ""}>
            <span class="type-body"><span class="type-ico" aria-hidden="true">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.en)}</small><em>${esc(t.desc)}</em></span></label>`).join("")}</div>
          <p class="hint">切换房型会按该房型重新预选下面的设施，可以再调整。</p>
        </fieldset>
        <fieldset>
          <legend>建成年份（可选）</legend>
          <input name="year_built" type="number" inputmode="numeric" min="1850" max="${thisYear}" placeholder="例如 1998" value="${d.year_built ?? ""}" style="max-width:200px" aria-label="建成年份">
        </fieldset>
        <fieldset>
          <legend>家里有这些设施</legend>
          <div class="check-grid">${check("features", Hh.forRegion(Hh.FEATURES, d.region), d.features || [])}</div>
        </fieldset>
        <fieldset>
          <legend>外墙材料（可多选）</legend>
          <div class="check-grid">${check("exterior", Hh.forRegion(Hh.MATERIALS.exterior, d.region), d.exterior || [])}</div>
        </fieldset>
        <fieldset>
          <legend>屋面</legend>
          <div class="check-grid">
            <label class="check"><input type="radio" name="roof" value="" ${!d.roof ? "checked" : ""}><span>不清楚 / 不用管</span></label>
            ${Hh.forRegion(Hh.MATERIALS.roof, d.region).map((m) => `<label class="check"><input type="radio" name="roof" value="${m.id}" ${d.roof === m.id ? "checked" : ""}><span>${esc(m.name)}</span></label>`).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>地面材料（可多选）</legend>
          <div class="check-grid">${check("flooring", Hh.forRegion(Hh.MATERIALS.flooring, d.region), d.flooring || [])}</div>
        </fieldset>
        <p id="houseFormError" class="form-error" role="alert"></p>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">保存房屋资料</button>
          ${state.houseProfile ? `<a class="btn btn-ghost" href="${href("house", "overview")}" data-action="house-cancel">取消</a>` : ""}
        </div>
      </form>
    </section>`;
}

/* ── 推荐耗材（按模板批量添加） ── */
export function viewHouseTemplate() {
  const p = state.houseProfile;
  if (!p) return `<div class="panel empty"><strong>先填写房屋资料</strong>推荐清单会根据房型、设施和材料生成。<p><a class="btn btn-primary" href="${href("house", "profile")}">填写房屋资料</a></p></div>`;
  const recs = H().recommendSupplies(p);
  const have = new Set(state.items.map((i) => i.name.trim()));
  const groups = H().HOUSE_CATEGORIES.map((c) => ({ c, rows: recs.filter((r) => r.category === c.id) })).filter((g) => g.rows.length);
  const fresh = recs.filter((r) => !have.has(r.name)).length;
  return `
    <section class="section">
      <div class="section-head"><h2>推荐的房屋耗材</h2><p>根据你的房屋资料，共 ${recs.length} 项${fresh < recs.length ? `，其中 ${recs.length - fresh} 项已经有了` : ""}</p></div>
      <form id="templateForm" class="panel">
        <div class="tpl-bar">
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="1">全选</button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-all" data-on="0">全不选</button>
          <span class="muted">加入后可以随时修改数量、少货线，或删除。</span>
        </div>
        ${groups.map(({ c, rows }) => `<fieldset class="tpl-group" style="--cat:${c.color}">
          <legend>${c.icon} ${c.name}</legend>
          ${rows.map((r) => {
            const exists = have.has(r.name);
            const key = `${r.category}|${r.name}`;
            return `<label class="tpl-row ${exists ? "is-have" : ""}">
              <input type="checkbox" name="tpl" value="${esc(key)}" ${exists ? "disabled" : "checked"}>
              <span class="grow"><b>${esc(r.name)}</b>
                <small>先备 ${r.qty} ${esc(r.unit)}${r.min ? `，少于 ${r.min} ${esc(r.unit)} 提醒` : ""}${r.every ? `，约每 ${r.every} 天用 1 ${esc(r.unit)}` : ""}</small>
                ${r.note ? `<small class="note">${esc(r.note)}</small>` : ""}</span>
              ${exists ? `<span class="badge b-ok">已有</span>` : ""}
            </label>`;
          }).join("")}
        </fieldset>`).join("")}
        <div class="form-actions" style="margin-top:12px">
          <button type="submit" class="btn btn-primary" ${fresh ? "" : "disabled"}>添加选中的耗材</button>
          <a class="btn btn-ghost" href="${href("house", "overview")}">稍后再说</a>
        </div>
      </form>
    </section>`;
}

/** 把勾选的模板项转换成库存物品 */
export function templateItems(keys) {
  const p = state.houseProfile, recs = H().recommendSupplies(p);
  return recs.filter((r) => keys.includes(`${r.category}|${r.name}`)).map((r) => ({
    name: r.name, category: r.category, subcategory: r.sub || null, unit: r.unit, quantity: r.qty, min_quantity: r.min || 0,
    location: r.loc || null, expiry_date: null, lead_days: 14, avg_daily_use: r.avg_daily_use, notes: r.note || null,
  }));
}
