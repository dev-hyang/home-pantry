import{a as wt}from"./chunk-ME7YTUOC.js";import{g as W,i as xt,j as K,k as kt,l as Y,n as Z,p as Q}from"./chunk-DJATSBQP.js";import{d as yt}from"./chunk-54S5PABG.js";import{m as T,r as P,s as ft,u as V,v as _,w as B}from"./chunk-KAANKQTL.js";import{b as vt,d as gt,e as I}from"./chunk-UBO4F4R3.js";import{d as G,h as R,j as U,l as z,m as J}from"./chunk-EUDH4UCU.js";import{c as mt}from"./chunk-NKE6X6ZX.js";import{Ja as ht,x as bt}from"./chunk-OGTJ36TM.js";import{a as $,b as C,f as k}from"./chunk-UVTSSMY7.js";import{G as q,H as rt,I as dt,J as j,K as A,O as pt,W as $t,Y as ut,k as t,m as it,n as ct,s as E,t as s,u as M,v as S}from"./chunk-7MFRLEF5.js";var St=()=>window.matchMedia("(max-width: 640px)").matches||document.documentElement.classList.contains("force-phone"),tt=a=>`${a.icon} ${t(a.name)}`;function qt(a,n){let e=l=>`<option value="${s(l.id)}" ${l.id===n?"selected":""}>${l.icon} ${s(t(l.name))}</option>`,o=_(a);return o.length<2?o.flatMap(l=>l.cats).map(e).join(""):o.map(l=>`<optgroup label="${s(t(l.g.name))}">${l.cats.map(e).join("")}</optgroup>`).join("")}function jt(a,n){let e=_(a),o=l=>n(l.id,`${l.icon} ${t(l.name)}`);return e.length<2?e.flatMap(l=>l.cats).map(o).join(""):e.map(l=>`<span class="chip-grp" aria-hidden="true">${s(t(l.g.name))}</span>${l.cats.map(o).join("")}`).join("")}function X(a){let n=a.filter(o=>o.status==="out").length,e=a.filter(o=>o.status==="low"||o.status==="soon"||o.exp).length;return{out:n,warn:e,kind:a.length?n?"out":e?"warn":"ok":"none"}}var Tt=(a,n)=>n.length?a.kind==="out"?`<span class="pill pill-out"><i>!</i>${t("{n} 缺货",{n:a.out})}${a.warn?` · ${t("{n} 少货",{n:a.warn})}`:""}</span>`:a.kind==="warn"?`<span class="pill pill-warn"><i>!</i>${t("{n} 少货 / 临期",{n:a.warn})}</span>`:`<span class="pill pill-ok"><i>✓</i>${t("充足")}</span>`:`<span class="pill pill-none">${t("空")}</span>`,Bt=a=>!!a.q.trim()||a.status!=="all"||(a.loc||"all")!=="all";function at(a,n){let e=new Set(a.map(d=>d.location).filter(Boolean));if(!e.size)return"";let o=yt().map(d=>({...d,locs:d.locs.filter(p=>e.has(p.name))})).filter(d=>d.locs.length),l=new Set(o.flatMap(d=>d.locs.map(p=>p.name))),r=[...e].filter(d=>!l.has(d)),i=d=>`<option value="${s(d)}" ${n.loc===d?"selected":""}>${s(t(d))}</option>`;return`<select id="invLoc" aria-label="${t("按位置筛选")}"><option value="all">${t("全部位置")}</option>
    ${o.map(d=>`<optgroup label="${s(t(d.name))}">${d.locs.map(p=>i(p.name)).join("")}</optgroup>`).join("")}
    ${r.length?`<optgroup label="${t("其他")}">${r.map(i).join("")}</optgroup>`:""}</select>`}function nt(a,n){let e=$.filter,o=Bt(e),l=o?n.filter(b=>B(b,e,{withCat:!1})):n,r=!o&&!!$.catSort,i=T(a),d=a==="gear";if(o){let b=i.map(x=>{let g=l.filter(O=>O.category===x.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:X(g),D=`<span class="tile-top"><span class="tile-ico" style="--cat:${x.color}" aria-hidden="true">${x.icon}</span><b class="tile-count">${g.length}</b></span>
        <span class="tile-name">${s(t(x.name))}</span>${g.length?`<span class="pill pill-none">${s(g.slice(0,3).map(O=>O.name).join(" · "))}${g.length>3?" …":""}</span>`:`<span class="pill pill-none">${t("无")}</span>`}`;return`<button type="button" class="tile st-${L.kind} ${g.length?"is-hit":"is-dim"}" data-action="cat" data-cat="${x.id}" ${g.length?"":"disabled"}>${D}</button>`}).join("");return`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件符合")}</span><small>${l.length?t("点格子进入分类，筛选条件会保留"):t("换个关键词或筛选试试")}</small></div>
        <button type="button" class="stat" data-action="inv-clear"><b>✕</b><span>${t("清除")}</span></button></div>
      <div class="cat-dash" id="catDash">${b}</div>`}let p=d?null:X(l),c=d?0:l.filter(b=>b.exp).length,h=d?0:l.filter(b=>b.status==="low"||b.status==="soon").length,y=(b,x,g,L)=>`<button type="button" class="stat ${L}" data-action="goto-status" data-space="${a}" data-status="${g}" ${b?"":"disabled"}><b>${b}</b><span>${x}</span></button>`,f=d?`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件家居耐用品")}</span></div></div>`:`<div class="dash-sum">
        <div class="sum-main"><b>${l.length}</b><span>${t("件物品")}</span><small>${p.kind==="ok"?t("库存都充足"):t("{n} 件要补货",{n:p.out+h})}</small></div>
        <div class="sum-stats">${y(p.out,t("缺货"),"out","s-out")}${y(h,t("少货"),"low","s-warn")}${y(c,t("临期"),"exp","s-exp")}</div>
      </div>`,m=(b,x)=>{let g=l.filter(H=>H.category===b.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:X(g),D=d?g.reduce((H,It)=>H+M(It.qty),0):g.length,O=r?`<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="-1" ${x===0?"disabled":""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="1" ${x===i.length-1?"disabled":""} aria-label="${t("往后")}">›</button></span>`:"",ot=`<span class="tile-top"><span class="tile-ico" style="--cat:${b.color}" aria-hidden="true">${b.icon}</span><b class="tile-count">${D}</b></span>
      <span class="tile-name">${s(t(b.name))}</span>
      ${d?g.length?`<span class="pill pill-none">${t("{n} 种",{n:g.length})}</span>`:`<span class="pill pill-none">${t("空")}</span>`:Tt(L,g)}${O}`,lt=`tile st-${L.kind} ${g.length?"":"is-empty"}`;return r?`<div class="${lt} is-sorting">${ot}</div>`:`<button type="button" class="${lt}" data-action="cat" data-cat="${b.id}">${ot}</button>`},v=r?[]:_(a,i),u=r||v.length<2?i.map(m).join(""):v.map(b=>`<h4 class="cat-grp-h">${s(tt(b.g))}</h4>${b.cats.map(x=>m(x,i.indexOf(x))).join("")}`).join(""),w=r?"":`<button type="button" class="tile tile-add" data-action="cat-new" data-space="${a}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="pill pill-none">${t("自定义")}</span></button>`;return`${f}<div class="cat-dash" id="catDash">${u}${w}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${r?t("完成排序"):t("调整顺序")}</button></p>`}function Nt(){try{return localStorage.getItem(xt)==="cats"?"cats":"rows"}catch{return"rows"}}var Mt=a=>`<div class="seg inv-seg" role="group" aria-label="${s(t("怎么看"))}">${[["rows","☰","物品"],["cats","▦","分类"]].map(([n,e,o])=>`<button type="button" class="seg-btn" data-action="inv-view" data-view="${n}" aria-pressed="${a===n}"><span aria-hidden="true">${e}</span> ${t(o)}</button>`).join("")}</div>`,Et=a=>!!a.alert_mute_until&&String(a.alert_mute_until)>pt(),Ft=()=>$.filter.space==="house"&&$.houseEnabled?"house":$.filter.space==="gear"?"gear":"pantry",F=(a,n)=>String(a).includes("&cat=")?`<a class="fab" href="${k("item","new")}?space=${a}" aria-label="${s(n)}" title="${s(n)}"><span aria-hidden="true">＋</span></a>`:`<button type="button" class="fab" data-action="add-item-pick" aria-label="${s(n)}" title="${s(n)}"><span aria-hidden="true">＋</span></button>`;function Dt(a){let n=$.filter;n.space!==a&&Object.assign(n,{space:a,cat:"all"});let e=K(),o=$.enriched.filter(r=>e.some(i=>j(i)(r))),l=n.cat!=="all"?q(n.cat):null;return`<section class="section inv-rows-page">
      <div class="section-head"><p>${t("{n} 件",{n:o.length})}</p><div class="head-acts">
        <button type="button" class="btn btn-sm ${$.invSel?"btn-primary":"btn-ghost"}" data-action="inv-select" aria-pressed="${!!$.invSel}">${$.invSel?t("完成"):`☑ ${t("多选")}`}</button>${Mt("rows")}</div></div>
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${t("搜索物品，例如：纸、蛋")}" value="${s(n.q)}" aria-label="${t("搜索物品")}">
        <select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([r,i])=>`<option value="${r}" ${n.status===r?"selected":""}>${t(i)}</option>`).join("")}
        </select>
        ${at(o,n)}
        ${V(n)}
        <select id="invSort" aria-label="${t("排序")}">${Ct.map(([r,i])=>`<option value="${r}" ${(n.sort||"default")===r?"selected":""}>${t(i)}</option>`).join("")}</select>
        ${J("inv",z(n,U.inv))}
      </div>
      ${l?`<div class="chips inv-catchip"><button type="button" class="chip" data-action="cat" data-cat="all" aria-pressed="true" aria-label="${s(t("清除分类：{c}",{c:t(l.name)}))}">${l.icon} ${s(t(l.name))} <span aria-hidden="true">✕</span></button></div>`:""}
      <div id="invRows" class="${$.invSel?"sel-mode":""}"></div>
      ${$.invSel?Ht():F(Ft(),t("添加物品"))}
    </section>`}function Ht(){let a=$.invSel.size?"":"disabled";return`<div class="inv-selbar" role="toolbar" aria-label="${s(t("多选操作"))}">
    <span class="inv-seln" aria-live="polite">${s(Z())}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-action="inv-sel-all">${t("全选")}</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-action="inv-sel-shop" ${a}>🛒 ${t("加入购物车")}</button>
    <button type="button" class="btn btn-sm" data-action="inv-sel-mute" ${a}>🔕 ${t("不提醒")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-action="inv-sel-del" ${a}>🗑 ${t("删除")}</button>
  </div>`}function At(a){let n=$.filter,e=n.cat!=="all"?q(n.cat):null,o=(()=>{try{return JSON.parse(localStorage.getItem("hmh-pv-fold")||"{}")}catch{return{}}})(),l=(i,d,p)=>{if(e&&dt(e.id)!==i)return"";let c=$.enriched.filter(j(i)),h=c.filter(kt).sort(Y(n.sort)),y=i==="gear"?[]:Q(i),f=G(`inv-${i}`,JSON.stringify(n)),m=h.slice(0,f),v=h.length?`<ul class="inv-list">${m.map(zt).join("")}</ul>${R(`inv-${i}`,h.length,f)}`:`<div class="empty">${c.length?`<strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或筛选试试。")}`:i==="house"?`<strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:i==="gear"?`<strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}`:`<strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}`}</div>`;return`<details class="pv-card inv-sec" data-fold="${i}" id="invSec-${i}" ${o[i]!==0?"open":""}>
      <summary><span class="pv-ico" aria-hidden="true">${d}</span><span class="pv-ttl"><b>${s(p)}</b><small>${h.length===c.length?t("{n} 件",{n:c.length}):t("{a} / {b} 件符合",{a:h.length,b:c.length})}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
      <div class="pv-body">${y.length&&!$.invSel?`<div class="inv-sec-bar"><span class="muted">${t("{n} 件要补货",{n:y.length})}</span><button type="button" class="btn btn-sm" data-action="inv-sec-shop" data-space="${i}">🛒 ${t("全部加入购物车")}</button></div>`:""}${v}</div></details>`},r={pantry:["🥫",t("日常消耗品")],house:["🧰",t("汽车房屋消耗品")],gear:["🛋️",t("家居耐用品")]};a.innerHTML=`<div class="pv-cards">${K().map(i=>l(i,...r[i])).join("")}</div>`}var _a=a=>`<span class="badge ${C[a.status].cls}">${t(C[a.status].label)}</span>`,Gt=()=>`<span class="rs-tag is-in is-static" title="${s(t("已加入购物车"))}" aria-label="${s(t("已加入购物车"))}" role="img">✓🛒</span>`,Rt=a=>Et(a)||M(a.min_quantity)<=0&&M(a.lead_days)<=0;function Ut(a,n){if(A(a))return"";let e=Rt(a),o=Units.factor(a.unit),l=e?[]:[M(a.min_quantity)>0&&t("少货线 {q} {u}",{q:S(M(a.min_quantity)*o),u:s(t(a.du))}),M(a.lead_days)>0&&t("提前 {d} 天",{d:M(a.lead_days)})].filter(Boolean),r=e?`🔕 ${t("不提醒")}`:`🔔 ${l.join(" · ")}`,i=e?t("点一下设置提醒"):t("点一下修改提醒设置");return n?`<span class="rem-tag${e?" is-off":""}">${r}</span>`:`<button type="button" class="rem-tag${e?" is-off":""}" data-action="item-remind" data-id="${a.id}" title="${s(i)}" aria-label="${s(`${a.name}：${e?t("不提醒"):l.join("，")}，${i}`)}">${r}</button>`}function zt(a){let n=C[a.status],e=q(a.category),o=I(a.id),l=[`${e.icon} ${s(t(a.subcategory||e.name))}`,P(a)&&`<span class="own-tag">${s(P(a))}</span>`,a.location&&`📍${s(t(a.location))}`,a.daysLeft!=null&&a.qty>0&&`${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}`].filter(Boolean).join(" · "),r=`${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:Ut(a,!!$.invSel)}${a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>`:""}${o?Gt():""}`,i=Units.step(a.du),d=s(a.name),p=$.invSel,c=p?.has(a.id),h=p?`data-row-sel="${a.id}"`:`data-row-open="${s(k("item",a.id))}" data-swipe-del="item" data-swipe-alt="item" data-swipe-alt-label="${s(t("加入购物车"))}" data-swipe-alt-go="${s(t("松手加入"))}"`;return`<li class="inv-row st-${a.status}${c?" is-picked":""}" data-id="${a.id}" ${h}>
    <span class="inv-bar" aria-hidden="true"></span>
    ${p?`<input type="checkbox" class="inv-chk" data-sel-id="${a.id}" ${c?"checked":""} aria-label="${s(t("选择 {name}",{name:a.name}))}">`:""}
    <div class="inv-main"><div class="inv-name">${p?`<span class="inv-link">${d}</span>`:`<a href="${s(k("item",a.id))}" class="inv-link">${d}</a>`}${r}</div><div class="inv-meta">${l}</div></div>
    <div class="inv-qty" role="group" aria-label="${s(t("{name} 数量",{name:a.name}))}">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${s(t("{name} 用掉 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">−</button>
      <input type="number" inputmode="decimal" min="0" step="any" value="${S(a.dqty)}" data-inv-qty="${a.id}" data-keep="invq:${a.id}" aria-label="${s(t("{name} 数量",{name:a.name}))}">
      ${wt(`data-inv-unit="${a.id}" aria-label="${s(t("{name} 单位",{name:a.name}))}"`,a.du,{cls:"inv-unit"})}
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${s(t("{name} 补充 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">+</button>
    </div>
    <button type="button" class="swipe-src" data-action="inv-del" data-id="${a.id}">${t("删除 {name}",{name:a.name})}</button>
    <button type="button" class="swipe-alt-src" data-action="inv-shop" data-id="${a.id}">${t("{name} 加入购物车",{name:a.name})}</button>
  </li>`}function La(a="pantry"){if(Nt()==="rows")return Dt(a);$.filter.space!==a&&Object.assign($.filter,{space:a,cat:"all",q:"",status:$.filter.status,loc:"all"});let n=$.filter,e=a==="house",o=a==="gear";o&&(n.status="all");let l=St(),r=l&&n.cat==="all",i=(u,w)=>`<button type="button" class="chip" data-action="cat" data-cat="${u}" aria-pressed="${n.cat===u}">${w}</button>`,d=o&&!l?N("gear"):"",p=$.enriched.filter(j(a)),c=n.cat!=="all"?q(n.cat):null,h=$.catForm&&$.catForm.space===a?$.catForm:null;(!c||!(c.subs||[]).includes(n.sub))&&(n.sub="all");let y=c?(c.subs||[]).map(u=>[u,p.filter(w=>w.category===c.id&&w.subcategory===u).length]).filter(([,u])=>u>0):[],f=y.length>1?`<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${n.sub==="all"}">${t("全部小类")}</button>
        ${y.map(([u,w])=>`<button type="button" class="chip" data-action="inv-sub" data-sub="${s(u)}" aria-pressed="${n.sub===u}">${s(t(u))} <span class="muted">${w}</span></button>`).join("")}</div>`:"",m=y.length>1?`<select id="invSubSel" aria-label="${t("按小类筛选")}"><option value="all">${t("全部小类")}</option>${y.map(([u,w])=>`<option value="${s(u)}" ${n.sub===u?"selected":""}>${s(t(u))} (${w})</option>`).join("")}</select>`:"",v=l&&c?`<div class="inv-filters${m?"":" solo"}">
        <select id="invCatSel" data-search aria-label="${t("按分类筛选")}"><option value="all">${t("全部")}</option>${qt(a,c.id)}</select>${m}</div>`:f;return`
    <section class="section">
      <div class="section-head"><p>${c?t("{n} 件",{n:p.filter(u=>u.category===c.id).length}):t("{n} 件",{n:p.length})}</p>
        <div class="head-acts">${e&&!l?`<a class="btn btn-sm btn-ghost" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:""}
        ${c&&!h?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${c.id}">${t("编辑分类")}</button>`:""}
        ${Mt("cats")}</div></div>
      ${!$.houseEnabled&&!$.gearEnabled?"":`<div class="chips" role="group" aria-label="${t("库存范围")}">
        <button type="button" class="chip" data-action="inv-space" data-space="pantry" aria-pressed="${!e&&!o}">🥫 ${t("日常消耗品")}</button>
        ${$.houseEnabled?`<button type="button" class="chip" data-action="inv-space" data-space="house" aria-pressed="${e}">🧰 ${t("汽车房屋消耗品")}</button>`:""}
        ${$.gearEnabled?`<button type="button" class="chip" data-action="inv-space" data-space="gear" aria-pressed="${o}">🛋️ ${t("家居耐用品")}</button>`:""}</div>`}
      ${e&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>`:""}
      ${o&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>`:""}
      ${d?`<div class="shelf" style="margin-bottom:14px">${d}</div>`:""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${o?t("搜索，例如：被罩、千斤顶、自行车"):e?t("搜索，例如：滤网、电池"):t("搜索物品，例如：纸、蛋")}" value="${s(n.q)}" aria-label="${t("搜索物品")}">
        ${o?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([u,w])=>`<option value="${u}" ${n.status===u?"selected":""}>${t(w)}</option>`).join("")}
        </select>`}
        ${at(p,n)}
        ${e?V(n):""}
        <select id="invSort" aria-label="${t("排序")}">${Ct.filter(([u])=>!(o&&u==="exp")).map(([u,w])=>`<option value="${u}" ${(n.sort||"default")===u?"selected":""}>${t(w)}</option>`).join("")}</select>
        ${J("inv",z(n,U.inv))}
      </div>
      ${l?"":`<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${i("all",t("全部"))}${jt(a,i)}
        <button type="button" class="chip chip-add" data-action="cat-new" data-space="${a}">＋ ${t("新分类")}</button>
      </div>`}
      ${h?W(h):""}
      ${v}
      ${r&&!h?`<div id="dashWrap" data-space="${a}">${nt(a,p)}</div>`:""}
      <div id="invList" ${r?"hidden":""}></div>
      ${F(`${a}${c?`&cat=${c.id}`:""}`,o?t("添加家居耐用品"):t("添加物品"))}
    </section>`}var Ct=[["default","按状态（缺货优先）"],["name","名称 A → Z"],["qty","数量：少 → 多"],["exp","保质期：近 → 远"],["updated","最近更新"]];function Oa(){let a=E("#invRows");if(a)return At(a);let n=$.filter,e=$.enriched.filter(j(n.space)),o=e.filter(m=>B(m,n)),l=E("#invList");if(!l)return;let r=E("#dashWrap");if(r){r.innerHTML=nt(r.dataset.space,e),l.hidden=!0;return}if(!o.length){l.innerHTML=e.length?`<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`:n.space==="house"?`<div class="panel empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></p></div>`:n.space==="gear"?`<div class="panel empty"><strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></p></div>`:`<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;return}let i=G("inv",JSON.stringify(n)),d=i,p=new Map;for(let m of o){let v=p.get(m.category);v?v.push(m):p.set(m.category,[m])}let c=_(n.space),h=new Set(c.filter(m=>m.cats.some(v=>p.has(v.id))).map(m=>m.g.id)),y=h.size>1,f="";l.innerHTML=c.flatMap(m=>m.cats.map(v=>[m.g,v])).map(([m,v])=>{let u=(p.get(v.id)||[]).sort(Y(n.sort));if(!u.length||d<=0)return"";let w=u.slice(0,d);d-=w.length;let b=y&&m.id!==f?`<h2 class="inv-grp-h">${s(tt(m))}</h2>`:"";f=m.id;let x=n.space==="gear"?0:u.filter(g=>g.status!=="ok"&&!I(g.id)).length;return`${b}<div class="cat-group" style="--cat:${v.color}"><div class="cat-group-h"><h3><span class="dot" aria-hidden="true"></span>${v.icon} ${t(v.name)}<span class="muted">（${u.length}）</span></h3>
      ${x?`<button type="button" class="btn btn-sm cat-shop" data-action="inv-cat-shop" data-cat="${v.id}" aria-label="${s(t("{c}：{n} 件要补货，全部加入购物车",{c:t(v.name),n:x}))}">🛒 ${t("全部加入购物车")} <b class="num">${x}</b></button>`:""}</div>
      <div class="items">${w.map(Jt).join("")}</div></div>`}).join("")+R("inv",T(n.space).reduce((m,v)=>m+(p.get(v.id)?.length||0),0),i)}function Jt(a){let n=C[a.status],e=ht.mode==="cloud"?gt(a.updated_by):null,o=t(a.du),l=(a.updated_at||a.created_at)&&`<span title="${s(ut(a))}">${e?`${s(e)} `:""}${t("{d} 更新",{d:$t(a.updated_at||a.created_at)})}</span>`;if(A(a)){let p=[a.subcategory&&`<span>${s(t(a.subcategory))}</span>`,a.location&&`<span>📍${s(t(a.location))}</span>`,a.notes&&`<span class="note" title="${s(a.notes)}">${s(a.notes.length>40?`${a.notes.slice(0,40)}…`:a.notes)}</span>`,l].filter(Boolean).join("");return`<article class="item is-gear" aria-label="${s(`${a.name}，${S(a.dqty)} ${o}${a.location?t("，在{loc}",{loc:t(a.location)}):""}`)}">
      <span class="gear-ico" aria-hidden="true">${q(a.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${s(a.name)}</button></div>
        <div class="item-meta">${p}</div>
        ${a.qty>0?`<div class="item-acts"><button type="button" class="link-name" data-action="gear-broke" data-id="${a.id}" aria-label="${s(a.name)} — ${s(t("损坏了，换新"))}">🔨 ${t("损坏了，换新")}</button></div>`:""}
      </div>
      <div class="qty"><output>${S(a.dqty)}<small>${s(o)}</small></output></div>
    </article>`}let r=[a.subcategory&&`<span>${s(t(a.subcategory))}</span>`,a.location&&`<span>📍${s(t(a.location))}</span>`,a.daysLeft!=null&&`<span>${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}</span>`,a.rate&&`<span title="${a.rateSrc==="manual"?t("手动设置"):t("根据最近使用记录估算")}">${t("日均 {q} {u}",{q:S(a.drate),u:s(o)})}</span>`,l].filter(Boolean).join(""),i=a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>${a.exp==="expired"&&a.qty>0?st(a):""}`:"",d=`${a.name}，${t("剩余 {q} {u}",{q:S(a.dqty),u:o})}，${t(n.label)}`;return`<article class="item st-${a.status}" aria-label="${s(d)}">
    <div class="jar st-${a.status}" role="img" aria-label="${t("存量约 {p}%",{p:Math.round(a.level*100)})}">
      <i style="height:${Math.max(a.qty>0?6:0,a.level*100)}%"></i>
      ${a.minMark!=null?`<span class="tick" style="bottom:${a.minMark*100}%"></span>`:""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${s(a.name)}</button>
        ${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:""}${a.muted?`<span class="badge b-muted" title="${t("已设为不提醒；编辑页里可以恢复")}">🔕 ${t("不提醒")}</span>`:""}${i}</div>
      <div class="item-meta">${r}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${s(t("{name} 用掉 {q} {u}",{name:a.name,q:Units.step(a.du),u:o}))}">−</button>
      <output>${S(a.dqty)}<small>${s(o)}</small></output>
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${s(t("{name} 补充 {q} {u}",{name:a.name,q:Units.step(a.du),u:o}))}">+</button>
    </div>
  </article>`}var Pt=(a,n)=>n?`<button type="button" class="rs-tag is-in" data-action="shop-remove-item" data-id="${a.id}" title="${s(t("点一下移出购物车"))}" aria-label="${s(t("{name}：已加入购物车，点一下移出",{name:a.name}))}">✓ ${t("已加入")}</button>`:`<button type="button" class="rs-tag" data-action="shop-add-item" data-id="${a.id}" title="${s(t("点一下加入购物车"))}" aria-label="${s(t("{name}：未加入购物车，点一下加入",{name:a.name}))}">${t("未加入")}</button>`;function Vt(a,n=8){return a.length?`<ul class="restock-list rs-list">${a.slice(0,n).map(e=>{let o=!!I(e.id),l=o?`data-swipe-del="rs" data-swipe-alt="rs" data-swipe-alt-label="${s(t("移出购物车"))}" data-swipe-alt-go="${s(t("松手移出"))}"`:`data-swipe-del="rs" data-swipe-left-label="${s(t("加入购物车"))}" data-swipe-left-go="${s(t("松手加入"))}"`;return`<li class="rs-row ${o?"rs-in":""}" ${l}>
      <span class="badge ${C[e.status].cls}">${t(C[e.status].label)}</span>
      <div class="grow"><span class="rs-name"><button type="button" class="link-name" data-action="edit" data-id="${e.id}">${s(e.name)}</button>${Pt(e,o)}</span>
        <small>${t("剩 {q} {u}",{q:S(e.dqty),u:s(t(e.du))})}${e.daysLeft!=null&&e.qty>0?t("，约够 {d} 天",{d:Math.max(0,Math.floor(e.daysLeft))}):""}${o?"":t("，建议买 {q} {u}",{q:S(e.dsuggest),u:s(t(e.du))})}</small></div>
      ${o?`<button type="button" class="swipe-alt-src" data-action="shop-remove-item" data-id="${e.id}">${t("移出购物车")}</button>`:`<button type="button" class="swipe-src" data-action="shop-add-item" data-id="${e.id}">${t("加入购物车")}</button>`}
    </li>`}).join("")}</ul>`:""}var Wt=()=>`<p class="muted rs-hint"><span class="rs-hint-touch">${t("点「未加入」加入购物车，点「已加入」移出；也可 ← 左滑加入 · 右滑移出 →")}</span><span class="rs-hint-mouse">${t("点「未加入」加入购物车，点「已加入」移出")}</span></p>`;function N(a,n=""){let e=$.enriched.filter(j(a)).filter(o=>!n||ft(o,n,!0));return rt(a).map(o=>{let l=e.filter(p=>p.category===o.id);if(!l.length)return"";if(a==="gear"){let p=[...new Set(l.map(c=>c.location).filter(Boolean))];return`<button type="button" class="shelf-cell" style="--cat:${o.color}" data-action="goto-cat" data-space="${a}" data-cat="${o.id}">
        <span class="ico" aria-hidden="true">${o.icon}</span><h3>${t(o.name)}</h3>
        <p>${t("{n} 种",{n:l.length})}${p.length?t("，在{locs}{etc}",{locs:s(it(p.slice(0,2).map(c=>t(c)))),etc:p.length>2?t("等"):""}):""}</p>
      </button>`}let r=p=>l.filter(c=>c.status===p).length,i=(p,c)=>r(p)?`<i style="width:${r(p)/l.length*100}%;background:${c}"></i>`:"",d=l.length-r("ok");return`<button type="button" class="shelf-cell" style="--cat:${o.color}" data-action="goto-cat" data-space="${a}" data-cat="${o.id}"${n?` data-owner="${s(n)}"`:""}>
      <span class="ico" aria-hidden="true">${o.icon}</span><h3>${t(o.name)}</h3>
      <p>${t("{n} 种",{n:l.length})}${d?t("，{n} 种需补",{n:d}):t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${i("out","var(--out)")}${i("low","var(--low)")}${i("soon","var(--mustard)")}${i("ok","var(--pine)")}</div>
    </button>`}).join("")}var _t={pantry:"日常消耗品",house:"汽车房屋消耗品",gear:"家居耐用品"};function Kt(){let a=$.items.filter(e=>e.cat_check).sort((e,o)=>ct(e.name,o.name));if(!a.length)return"";let n=(e,o)=>{let l=q(e);return`${l.icon} ${s(t(l.name))}${o?` · ${s(t(o))}`:""}`};return`<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${a.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类细化时，这些物品是按名称猜着搬的。放对了点「没错」；放错了点「改回…」或「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${a.slice(0,30).map(e=>{let o=bt(e),l=r=>t(_t[q(r).space]||"");return`<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${e.id}">${s(e.name)}</button>
          <small>${t("现在：")}${n(e.category,e.subcategory)}<span class="muted">（${l(e.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${e.id}">${t("没错")}</button>
          ${o?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${e.id}" data-cat="${o[0]}" data-sub="${s(o[1])}" title="${s(t(_t[q(o[0]).space]||""))}">${e.cat_prev?t("改回"):t("改成")} ${n(o[0],o[1])}</button>`:""}
        </div></li>`}).join("")}</ul>${a.length>30?`<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示",{n:a.length-30})}</p>`:""}</div>
    </section>`}var Lt="hmh-pv-fold",Ot=()=>{try{return JSON.parse(localStorage.getItem(Lt)||"{}")}catch{return{}}};function za(a,n){let e=Ot();e[a]=n?1:0;try{localStorage.setItem(Lt,JSON.stringify(e))}catch{}}function Yt(a,n){if(a==="gear")return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="gear" data-cat="all"><span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3><p>${t("{n} 种",{n:n.length})}</p></button>`;let e=r=>n.filter(i=>i.status===r).length,o=n.length-e("ok"),l=(r,i)=>e(r)?`<i style="width:${e(r)/n.length*100}%;background:${i}"></i>`:"";return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="${a}" data-cat="all">
    <span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3>
    <p>${t("{n} 种",{n:n.length})}${o?t("，{n} 种需补",{n:o}):t("，都充足")}</p>
    <div class="mix" aria-hidden="true">${l("out","var(--out)")}${l("low","var(--low)")}${l("soon","var(--mustard)")}${l("ok","var(--pine)")}</div></button>`}function et(a,n,e,o,l,r){let i=f=>o.filter(m=>m.status===f).length,d=o.filter(f=>f.exp).length,p=[["out",t("缺货"),i("out")],["low",t("少货"),i("low")],["soon",t("即将告罄"),i("soon")],...a==="pantry"?[["exp",t("临期或过期"),d]]:[]],c=p.reduce((f,m)=>f+m[2],0),h=Ot()[a]!==0,y=a==="gear"?t("{n} 种，长期用的东西，只记数量和位置",{n:o.length}):o.length?c?p.filter(f=>f[2]).map(f=>`${f[1]} ${f[2]}`).join(" · "):t("{n} 种，都充足",{n:o.length}):t("还没有物品");return`<details class="pv-card" data-fold="${a}" ${h?"open":""}>
    <summary><span class="pv-ico" aria-hidden="true">${n}</span><span class="pv-ttl"><b>${s(e)}</b><small class="${c?"pv-bad":""}">${s(y)}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
    <div class="pv-body">
      ${l?`<div class="shelf">${Yt(a,o)}${l}</div>`:r}
    </div></details>`}var st=a=>`<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${a.id}" aria-label="${s(t("{name} 过期了，扔掉剩下的",{name:a.name}))}">🗑 ${t("扔掉")}</button>`;function Zt(){let a=$.shopping.filter(n=>n.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${k("shopping","list")}" aria-label="${s(t("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${t("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`}function Ja(){let a=$.houseEnabled,n=$.enriched.filter(j("pantry")),e=a?$.enriched.filter(j("house")):[],o=[...n,...e],l=(c,h)=>c.filter(y=>y.status===h).length,r=vt(o),i=n.filter(c=>c.exp).sort((c,h)=>c.expDays-h.expDays),d=N("pantry"),p=a?N("house"):"";return`${Kt()}
    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${r.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${t("全部加入购物车")}</button>`:""}${Zt()}</div></div>
      ${r.length?Wt():""}
      <div class="panel">${r.length?Vt(r):`<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
      ${r.length?mt({id:"restock",title:t("该补货了"),question:t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),context:()=>[t("要补：{s}",{s:r.slice(0,15).map(c=>c.name||c.item?.name).filter(Boolean).join("、")}),t("家庭人数 {n}",{n:$.members?.length||1})]}):""}
    </section>

    <section class="section" aria-labelledby="h-alert">
      <h2 id="h-alert" class="sr-only">${t("储藏概览")}</h2>
      <div class="pv-cards">
        ${et("pantry","🥫",t("日常消耗品"),n,d,`<div class="empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=pantry">${t("添加第一件物品")}</a></div>`)}
        ${a?et("house","🧰",t("汽车房屋消耗品"),e,p,`<div class="empty"><strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></div>`):""}
        ${$.gearEnabled?et("gear","🛋️",t("家居耐用品"),$.enriched.filter(j("gear")),N("gear"),`<div class="empty"><strong>${t("还没有家居耐用品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></div>`):""}
      </div>
    </section>

    ${i.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${i.slice(0,6).map(c=>`<li>
        <span class="badge b-exp">${c.exp==="expired"?t("已过期"):c.expDays===0?t("今天到期"):t("{d} 天后到期",{d:c.expDays})}</span>
        <div class="grow"><span class="name">${s(c.name)}</span><small>${s(t(c.location||""))} ${t("剩 {q} {u}",{q:S(c.dqty),u:s(t(c.du))})}</small></div>${c.exp==="expired"&&c.qty>0?st(c):""}</li>`).join("")}</ul></div>
    </section>`:""}

    ${F("pantry",t("添加物品"))}<div class="fab-spacer" aria-hidden="true"></div>
`}export{Vt as a,Wt as b,N as c,za as d,st as e,Ja as f,Nt as g,F as h,_a as i,Gt as j,zt as k,La as l,Oa as m,Jt as n};
