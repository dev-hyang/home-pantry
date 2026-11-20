import{g as O}from"./chunk-FSY2QA7Q.js";import{a as h,b as y,d as x,i as k}from"./chunk-JOU7QYFK.js";import{B as v,c as d,h as u,i as b,l as $,y as f,z as g}from"./chunk-4QNLI5E2.js";import{a as r}from"./chunk-JB5BL7MD.js";import{H as p,j as c,k as t,t as i}from"./chunk-RRGJ5CTX.js";function w(){let s=Object.keys(u()),n=Object.entries(b());if(!s.length&&!n.length)return"";let e=a=>new Date(a).toLocaleTimeString(void 0,{hour:"2-digit",minute:"2-digit"});return`<p class="muted" style="margin:0 0 8px;font-size:13px">${t("已自动跳过的模型：")}${[...s.map(a=>`${i(a)}（${t("已下线，24 小时内不再试")}）`),...n.map(([a,l])=>`${i(a)}（${t("额度用完，{time} 恢复",{time:e(l)})}）`)].join("；")}
    <button type="button" class="btn btn-sm btn-ghost" data-action="ai-marks-clear">${t("清除，重新试")}</button></p>`}function j(){let s=new Map,n=(e,a)=>{e&&!s.has(e)&&s.set(e,a)};for(let e of y())n(e.name,t("存放位置"));for(let e of CATEGORIES)if(e.custom){n(e.name,t("分类"));for(let a of e.subs||[])n(a,t("小类"))}else if(e.overridden){e.name!==e.base.name&&n(e.name,t("分类"));for(let a of e.subs||[])(e.base.subs||[]).includes(a)||n(a,t("小类"))}return[...s.entries()]}function F(){let s=j(),n=(e,a,l,o)=>{let m=c(e)||{};return`<label>${l}<input name="${a}" maxlength="60" value="${i(m[a]||"")}" placeholder="${i(o)}"></label>`};return`<form id="termsForm" class="panel">
    <div class="section-head" style="margin-bottom:6px"><h3 style="font-size:15px">${t("自定义名称的翻译")}</h3><p>${t("自己起的位置、分类、小类在其他语言下怎么叫；留空就按原文显示（繁體由简体自动转换）")}</p></div>
    ${s.length?`<div class="terms-list">
      ${s.map(([e,a])=>`<div class="term-card" data-term="${i(e)}"><div class="term-name"><b>${i(e)}</b><small>${i(a)}</small></div>
        <div class="term-fields">${n(e,"zh","简体",e)}${n(e,"en","English","")}${n(e,"hant","繁體",t("自动"))}</div></div>`).join("")}
    </div>
    <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存翻译")}</button></div>`:`<p class="muted" style="margin:0;font-size:13px">${t("还没有自己起的名字。新建位置或分类后会出现在这里。")}</p>`}
  </form>`}function I(){let s=r.catForm,n=[["pantry","日常消耗品"],["house","汽车房屋消耗品"],["gear","家居耐用品"]].filter(([a])=>a!=="gear"||r.gearEnabled),e=a=>{let l=r.items.filter(m=>m.category===a.id).length,o=a.custom?`<span class="badge b-ok">${t("自建")}</span>`:a.overridden?`<span class="badge b-soon">${t("改过")}</span>`:"";return`<li class="${a.hidden?"inactive":""}"><span class="mi" style="--cat:${a.color}" aria-hidden="true">${a.icon}</span>
      <span class="grow"><b>${i(t(a.name))}</b> ${o}${a.hidden?` <span class="badge" style="background:var(--surface-2)">${t("已隐藏")}</span>`:""}
        <small>${(a.subs||[]).length?i((a.subs||[]).map(m=>t(m)).join(" · ")):t("没有小类")}${l?` · ${t("{n} 件",{n:l})}`:""}</small></span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${a.id}">${t("编辑")}</button></li>`};return`${s?O(s):""}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("大类决定方块、筛选和统计；小类是物品表单里的下拉。内置分类也能改名、增删小类或隐藏，自建的可删除，全家共用。")}</p>
    ${n.map(([a,l])=>`<div class="panel loc-group"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">${t(l)}</h3>
        <button type="button" class="btn btn-sm btn-ghost" data-action="cat-new" data-space="${a}">＋ ${t("新分类")}</button></div>
      <ul class="member-list loc-list cat-list">${p(a,{withHidden:!0}).map(e).join("")}</ul></div>`).join("")}`}function A(){let s=r.locForm,n=x(),e=[...window.LOCATION_GROUPS,h].map(o=>`<option value="${o.id}" ${(s?.grp||"custom")===o.id?"selected":""}>${i(t(o.name))}</option>`).join(""),a=s?`<form id="locForm" class="panel">
      <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${s.oldName?t("重命名：{name}",{name:t(s.oldName)}):t("新位置")}</h3>
        <p>${s.oldName?t("用到这个位置的物品和设备会一起改名"):t("会出现在物品 / 设备的位置下拉里，全家共用")}</p></div>
      <div class="form-grid">
        <label>${t("位置名")}<input name="name" required maxlength="20" placeholder="${t("例如：Emma 的房间、车库架子")}" value="${i(s.name||"")}"></label>
        <label>${t("所在分组")}<select name="grp">${e}</select></label>
      </div>
      <div class="form-actions" style="margin-top:10px"><button type="submit" class="btn btn-primary btn-sm">${t("保存")}</button>
        <button type="button" class="btn btn-sm btn-ghost" data-action="loc-cancel">${t("取消")}</button>
        ${s.id?`<span class="spacer"></span><button type="button" class="btn btn-sm btn-danger-ghost" data-action="loc-del" data-id="${s.id}">${t("删除")}</button>`:""}</div>
    </form>`:"",l=o=>{let m=k(r,o.name);return`<li><span class="grow"><b>${i(t(o.name))}</b>${o.custom?` <span class="badge b-ok">${o.replaces?t("已改名"):t("自定义")}</span>`:""}<small>${m?t("{n} 件物品 / 设备",{n:m}):t("还没放东西")}${o.replaces?` · ${t("原为“{name}”",{name:t(o.replaces)})}`:""}</small></span>
      <button type="button" class="btn btn-sm btn-ghost" data-action="loc-edit" data-name="${i(o.name)}">${t("重命名")}</button></li>`};return`${a}
    <p class="muted" style="margin:0 0 10px;font-size:13px">${t("按房间分组，物品 / 设备的位置下拉也按这个分组显示；下拉末尾的“＋ 新位置…”可以边填边加。")}</p>
    ${n.map(o=>`<div class="panel loc-group"><div class="section-head" style="margin-bottom:4px"><h3 style="font-size:15px">${i(t(o.name))}</h3>
        <button type="button" class="btn btn-sm btn-ghost" data-action="loc-new" data-grp="${o.id}">＋ ${t("新位置")}</button></div>
      <ul class="member-list loc-list">${o.locs.map(l).join("")}</ul></div>`).join("")}
    ${n.some(o=>o.id==="custom")?"":`<div class="form-actions"><button type="button" class="btn btn-sm" data-action="loc-new" data-grp="custom">＋ ${t("新位置")}</button></div>`}`}var U=[{id:"ai",icon:"__AI__",name:"AI 助手"},{id:"family",icon:"👨‍👩‍👧",name:"家庭与成员"},{id:"prefs",icon:"🌐",name:"语言、地区与单位"},{id:"categories",icon:"🗂️",name:"分类与小类"},{id:"locations",icon:"📍",name:"存放位置"},{id:"modules",icon:"🧩",name:"模块开关"},{id:"print",icon:"🖨️",name:"打印"},{id:"backup",icon:"🛟",name:"同步、备份与恢复"},{id:"usage",icon:"📊",name:"存储用量"},{id:"data",icon:"🔔",name:"通知"},{id:"apps",icon:"🔗",name:"姐妹站点与介绍"}];async function L(s){let n=s.elements,e=d();Object.assign(e,{provider:n.provider.value,key:n.key.value.trim(),model:n.model.value.trim(),base:n.base.value.trim(),people:+n.people.value||4,auth:n.auth?.value||"bearer",freeOnly:!!n.freeOnly?.checked,rpm:n.rpm?.value===""?"":Math.max(0,+n.rpm.value||0),rpd:n.rpd?.value===""?"":Math.max(0,+n.rpd.value||0)}),$(e)}function H(s,n){let e=f[n.id],a=g(s);return`<fieldset class="quota-box">
    <legend>${t("免费额度")}</legend>
    <p class="${a.ok?"muted":"form-error"}" style="margin:0 0 8px;font-size:13px">${i(v(a))}${e?` · ${t(e.resetText)}`:""}</p>
    ${w()}
    <label class="check-inline" style="margin-bottom:8px"><input type="checkbox" name="freeOnly" ${s.freeOnly!==!1?"checked":""}><span>${t("只用免费额度：到上限就不再发请求，并提示下次可用时间")}</span></label>
    <div class="form-grid">
      <label>${t("每分钟上限（次）")}<input name="rpm" type="number" inputmode="numeric" min="0" max="1000" placeholder="${e?.rpm??t("不限")}" value="${i(s.rpm??"")}"></label>
      <label>${t("每天上限（次）")}<input name="rpd" type="number" inputmode="numeric" min="0" max="100000" placeholder="${e?.rpd??t("不限")}" value="${i(s.rpd??"")}"><small>${e?t("留空用默认值（各家公布的免费档，会变，以控制台为准）"):t("这个服务没有免费档；留空不限制，或按你买的额度填")}</small></label>
    </div>
    <div class="form-actions" style="margin-top:8px"><button type="button" class="btn btn-sm btn-ghost" data-action="ai-usage-reset" data-provider="${n.id}">${t("重置计数")}</button>
      <small class="muted">${t("计数只在本机浏览器里，换设备或家人各自计")}</small></div>
  </fieldset>`}export{F as a,I as b,A as c,U as d,L as e,H as f};
