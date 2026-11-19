import{a as xt}from"./chunk-WE2SO5EA.js";import{b as kt,c as Y,d as St,e as Z,g as Q,i as X}from"./chunk-L467QQOY.js";import{g as K}from"./chunk-R3XCOAC2.js";import{d as yt}from"./chunk-DPQNEAUK.js";import{a as F}from"./chunk-JXMTTL6S.js";import{d as R,h as U}from"./chunk-W6QE3GHO.js";import{a as z,c as J,d as P}from"./chunk-VDMZKFLO.js";import{e as V,f as wt,h as W,i as _,j as B}from"./chunk-DAWUMDIC.js";import{b as T}from"./chunk-AIT6F4KS.js";import{b as gt,d as ft,e as I}from"./chunk-5H3Y3AYN.js";import{c as bt}from"./chunk-V63XTQWG.js";import{Ja as vt,x as ht}from"./chunk-GLK2X4GQ.js";import{a as u,b as C,f as k}from"./chunk-UVTSSMY7.js";import{G as q,H as dt,I as pt,J as j,K as G,O as ut,W as $t,Y as mt,k as t,m as ct,n as rt,s as E,t as e,u as M,v as S}from"./chunk-HJFFSHZB.js";var qt=()=>window.matchMedia("(max-width: 640px)").matches||document.documentElement.classList.contains("force-phone"),at=a=>`${a.icon} ${t(a.name)}`;function jt(a,n){let s=l=>`<option value="${e(l.id)}" ${l.id===n?"selected":""}>${l.icon} ${e(t(l.name))}</option>`,o=_(a);return o.length<2?o.flatMap(l=>l.cats).map(s).join(""):o.map(l=>`<optgroup label="${e(t(l.g.name))}">${l.cats.map(s).join("")}</optgroup>`).join("")}function Mt(a,n){let s=_(a),o=l=>n(l.id,`${l.icon} ${t(l.name)}`);return s.length<2?s.flatMap(l=>l.cats).map(o).join(""):s.map(l=>`<span class="chip-grp" aria-hidden="true">${e(t(l.g.name))}</span>${l.cats.map(o).join("")}`).join("")}function tt(a){let n=a.filter(o=>o.status==="out").length,s=a.filter(o=>o.status==="low"||o.status==="soon"||o.exp).length;return{out:n,warn:s,kind:a.length?n?"out":s?"warn":"ok":"none"}}var Bt=(a,n)=>n.length?a.kind==="out"?`<span class="badge b-out"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 缺货",{n:a.out})}${a.warn?` · ${t("{n} 少货",{n:a.warn})}`:""}</span>`:a.kind==="warn"?`<span class="badge b-low"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 少货 / 临期",{n:a.warn})}</span>`:`<span class="badge b-ok"><i class="b-ic" data-g="✓" aria-hidden="true"></i>${t("充足")}</span>`:`<span class="badge b-none">${t("空")}</span>`,Nt=a=>!!a.q.trim()||a.status!=="all"||(a.loc||"all")!=="all";function nt(a,n){let s=new Set(a.map(d=>d.location).filter(Boolean));if(!s.size)return"";let o=yt().map(d=>({...d,locs:d.locs.filter(p=>s.has(p.name))})).filter(d=>d.locs.length),l=new Set(o.flatMap(d=>d.locs.map(p=>p.name))),r=[...s].filter(d=>!l.has(d)),i=d=>`<option value="${e(d)}" ${n.loc===d?"selected":""}>${e(t(d))}</option>`;return`<select id="invLoc" aria-label="${t("按位置筛选")}"><option value="all">${t("全部位置")}</option>
    ${o.map(d=>`<optgroup label="${e(t(d.name))}">${d.locs.map(p=>i(p.name)).join("")}</optgroup>`).join("")}
    ${r.length?`<optgroup label="${t("其他")}">${r.map(i).join("")}</optgroup>`:""}</select>`}function st(a,n){let s=u.filter,o=Nt(s),l=o?n.filter(b=>B(b,s,{withCat:!1})):n,r=!o&&!!u.catSort,i=T(a),d=a==="gear";if(o){let b=i.map(x=>{let g=l.filter(O=>O.category===x.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:tt(g),A=`<span class="tile-top"><span class="tile-ico" style="--cat:${x.color}" aria-hidden="true">${x.icon}</span><b class="tile-count">${g.length}</b></span>
        <span class="tile-name">${e(t(x.name))}</span>${g.length?`<span class="badge b-none">${e(g.slice(0,3).map(O=>O.name).join(" · "))}${g.length>3?" …":""}</span>`:`<span class="badge b-none">${t("无")}</span>`}`;return`<button type="button" class="tile st-${L.kind} ${g.length?"is-hit":"is-dim"}" data-action="cat" data-cat="${x.id}" ${g.length?"":"disabled"}>${A}</button>`}).join("");return`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件符合")}</span><small>${l.length?t("点格子进入分类，筛选条件会保留"):t("换个关键词或筛选试试")}</small></div>
        <button type="button" class="stat" data-action="inv-clear"><b>✕</b><span>${t("清除")}</span></button></div>
      <div class="cat-dash" id="catDash">${b}</div>`}let p=d?null:tt(l),c=d?0:l.filter(b=>b.exp).length,h=d?0:l.filter(b=>b.status==="low"||b.status==="soon").length,y=(b,x,g,L)=>`<button type="button" class="stat ${L}" data-action="goto-status" data-space="${a}" data-status="${g}" ${b?"":"disabled"}><b>${b}</b><span>${x}</span></button>`,f=d?`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件家居耐用品")}</span></div></div>`:`<div class="dash-sum">
        <div class="sum-main"><b>${l.length}</b><span>${t("件物品")}</span><small>${p.kind==="ok"?t("库存都充足"):t("{n} 件要补货",{n:p.out+h})}</small></div>
        <div class="sum-stats">${y(p.out,t("缺货"),"out","s-out")}${y(h,t("少货"),"low","s-warn")}${y(c,t("临期"),"exp","s-exp")}</div>
      </div>`,m=(b,x)=>{let g=l.filter(H=>H.category===b.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:tt(g),A=d?g.reduce((H,Tt)=>H+M(Tt.qty),0):g.length,O=r?`<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="-1" ${x===0?"disabled":""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="1" ${x===i.length-1?"disabled":""} aria-label="${t("往后")}">›</button></span>`:"",lt=`<span class="tile-top"><span class="tile-ico" style="--cat:${b.color}" aria-hidden="true">${b.icon}</span><b class="tile-count">${A}</b></span>
      <span class="tile-name">${e(t(b.name))}</span>
      ${d?g.length?`<span class="badge b-none">${t("{n} 种",{n:g.length})}</span>`:`<span class="badge b-none">${t("空")}</span>`:Bt(L,g)}${O}`,it=`tile st-${L.kind} ${g.length?"":"is-empty"}`;return r?`<div class="${it} is-sorting">${lt}</div>`:`<button type="button" class="${it}" data-action="cat" data-cat="${b.id}">${lt}</button>`},v=r?[]:_(a,i),$=r||v.length<2?i.map(m).join(""):v.map(b=>`<h4 class="cat-grp-h">${e(at(b.g))}</h4>${b.cats.map(x=>m(x,i.indexOf(x))).join("")}`).join(""),w=r?"":`<button type="button" class="tile tile-add" data-action="cat-new" data-space="${a}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="badge b-none">${t("自定义")}</span></button>`;return`${f}<div class="cat-dash" id="catDash">${$}${w}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${r?t("完成排序"):t("调整顺序")}</button></p>`}function Et(){try{return localStorage.getItem(kt)==="cats"?"cats":"rows"}catch{return"rows"}}var Ct=a=>`<div class="seg inv-seg" role="group" aria-label="${e(t("怎么看"))}">${[["rows","☰","物品"],["cats","▦","分类"]].map(([n,s,o])=>`<button type="button" class="seg-btn" data-action="inv-view" data-view="${n}" aria-pressed="${a===n}"><span aria-hidden="true">${s}</span> ${t(o)}</button>`).join("")}</div>`,Ft=a=>!!a.alert_mute_until&&String(a.alert_mute_until)>ut(),Dt=()=>u.filter.space==="house"&&u.houseEnabled?"house":u.filter.space==="gear"?"gear":"pantry",D=(a,n)=>String(a).includes("&cat=")?`<a class="fab" href="${k("item","new")}?space=${a}" aria-label="${e(n)}" title="${e(n)}"><span aria-hidden="true">＋</span></a>`:`<button type="button" class="fab" data-action="add-item-pick" aria-label="${e(n)}" title="${e(n)}"><span aria-hidden="true">＋</span></button>`;function At(a){let n=u.filter;n.space!==a&&Object.assign(n,{space:a,cat:"all"});let s=Y(),o=u.enriched.filter(r=>s.some(i=>j(i)(r))),l=n.cat!=="all"?q(n.cat):null;return`<section class="section inv-rows-page">
      <div class="section-head"><p>${t("{n} 件",{n:o.length})}</p><div class="head-acts">
        <button type="button" class="btn btn-sm ${u.invSel?"btn-primary":"btn-ghost"}" data-action="inv-select" aria-pressed="${!!u.invSel}">${u.invSel?t("完成"):`☑ ${t("多选")}`}</button>${Ct("rows")}</div></div>
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${t("搜索物品，例如：纸、蛋")}" value="${e(n.q)}" aria-label="${t("搜索物品")}">
        <select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([r,i])=>`<option value="${r}" ${n.status===r?"selected":""}>${t(i)}</option>`).join("")}
        </select>
        ${nt(o,n)}
        ${W(n)}
        <select id="invSort" aria-label="${t("排序")}">${_t.map(([r,i])=>`<option value="${r}" ${(n.sort||"default")===r?"selected":""}>${t(i)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${l?`<div class="chips inv-catchip"><button type="button" class="chip" data-action="cat" data-cat="all" aria-pressed="true" aria-label="${e(t("清除分类：{c}",{c:t(l.name)}))}">${l.icon} ${e(t(l.name))} <span aria-hidden="true">✕</span></button></div>`:""}
      <div id="invRows" class="${u.invSel?"sel-mode":""}"></div>
      ${u.invSel?Ht():D(Dt(),t("添加物品"))}
    </section>`}function Ht(){let a=u.invSel.size?"":"disabled";return`<div class="inv-selbar" role="toolbar" aria-label="${e(t("多选操作"))}">
    <span class="inv-seln" aria-live="polite">${e(Q())}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-action="inv-sel-all">${t("全选")}</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-action="inv-sel-shop" ${a}>🛒 ${t("加入购物车")}</button>
    <button type="button" class="btn btn-sm" data-action="inv-sel-mute" ${a}>🔕 ${t("不提醒")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-action="inv-sel-del" ${a}>🗑 ${t("删除")}</button>
  </div>`}function Gt(a){let n=u.filter,s=n.cat!=="all"?q(n.cat):null,o=(()=>{try{return JSON.parse(localStorage.getItem("hmh-pv-fold")||"{}")}catch{return{}}})(),l=(i,d,p)=>{if(s&&pt(s.id)!==i)return"";let c=u.enriched.filter(j(i)),h=c.filter(St).sort(Z(n.sort)),y=i==="gear"?[]:X(i),f=R(`inv-${i}`,JSON.stringify(n)),m=h.slice(0,f),v=h.length?`<ul class="inv-list">${m.map(Jt).join("")}</ul>${U(`inv-${i}`,h.length,f)}`:`<div class="empty">${c.length?`<strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或筛选试试。")}`:i==="house"?`<strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:i==="gear"?`<strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}`:`<strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}`}</div>`;return`<details class="pv-card inv-sec" data-fold="${i}" id="invSec-${i}" ${o[i]!==0?"open":""}>
      <summary><span class="pv-ico" aria-hidden="true">${d}</span><span class="pv-ttl"><b>${e(p)}</b><small>${h.length===c.length?t("{n} 件",{n:c.length}):t("{a} / {b} 件符合",{a:h.length,b:c.length})}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
      <div class="pv-body">${y.length&&!u.invSel?`<div class="inv-sec-bar"><span class="muted">${t("{n} 件要补货",{n:y.length})}</span><button type="button" class="btn btn-sm" data-action="inv-sec-shop" data-space="${i}">🛒 ${t("全部加入购物车")}</button></div>`:""}${v}</div></details>`},r={pantry:["🥫",t("日常消耗品")],house:["🧰",t("汽车房屋消耗品")],gear:["🛋️",t("家居耐用品")]};a.innerHTML=`<div class="pv-cards">${Y().map(i=>l(i,...r[i])).join("")}</div>`}var Oa=a=>`<span class="badge ${C[a.status].cls}">${t(C[a.status].label)}</span>`,Rt=()=>`<span class="rs-tag is-in is-static" title="${e(t("已加入购物车"))}" aria-label="${e(t("已加入购物车"))}" role="img">✓🛒</span>`,Ut=a=>Ft(a)||M(a.min_quantity)<=0&&M(a.lead_days)<=0;function zt(a,n){if(G(a))return"";let s=Ut(a),o=Units.factor(a.unit),l=s?[]:[M(a.min_quantity)>0&&t("少货线 {q} {u}",{q:S(M(a.min_quantity)*o),u:e(t(a.du))}),M(a.lead_days)>0&&t("提前 {d} 天",{d:M(a.lead_days)})].filter(Boolean),r=s?`🔕 ${t("不提醒")}`:`🔔 ${l.join(" · ")}`,i=s?t("点一下设置提醒"):t("点一下修改提醒设置");return n?`<span class="rem-tag${s?" is-off":""}">${r}</span>`:`<button type="button" class="rem-tag${s?" is-off":""}" data-action="item-remind" data-id="${a.id}" title="${e(i)}" aria-label="${e(`${a.name}：${s?t("不提醒"):l.join("，")}，${i}`)}">${r}</button>`}function Jt(a){let n=C[a.status],s=q(a.category),o=I(a.id),l=[`${s.icon} ${e(t(a.subcategory||s.name))}`,V(a)&&`<span class="own-tag">${e(V(a))}</span>`,a.location&&`📍${e(t(a.location))}`,a.daysLeft!=null&&a.qty>0&&`${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}`].filter(Boolean).join(" · "),r=`${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:zt(a,!!u.invSel)}${a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>`:""}${o?Rt():""}`,i=Units.step(a.du),d=e(a.name),p=u.invSel,c=p?.has(a.id),h=p?`data-row-sel="${a.id}"`:`data-row-open="${e(k("item",a.id))}" data-swipe-del="item" data-swipe-alt="item" data-swipe-alt-label="${e(t("加入购物车"))}" data-swipe-alt-go="${e(t("松手加入"))}"`,y=p?"":F([{label:t("详情"),href:k("item",a.id),first:!0},{label:t("加入购物车"),action:"inv-shop",data:{id:a.id}},{label:t("删除"),action:"inv-del",data:{id:a.id},danger:!0}],a.name);return`<li class="inv-row st-${a.status}${c?" is-picked":""}" data-id="${a.id}" ${h} ${y}>
    <span class="inv-bar" aria-hidden="true"></span>
    ${p?`<input type="checkbox" class="inv-chk" data-sel-id="${a.id}" ${c?"checked":""} aria-label="${e(t("选择 {name}",{name:a.name}))}">`:""}
    <div class="inv-main"><div class="inv-name">${p?`<span class="inv-link">${d}</span>`:`<a href="${e(k("item",a.id))}" class="inv-link">${d}</a>`}${r}</div><div class="inv-meta">${l}</div></div>
    <div class="inv-qty" role="group" aria-label="${e(t("{name} 数量",{name:a.name}))}">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${e(t("{name} 用掉 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">−</button>
      <input type="number" inputmode="decimal" min="0" step="any" value="${S(a.dqty)}" data-inv-qty="${a.id}" data-keep="invq:${a.id}" aria-label="${e(t("{name} 数量",{name:a.name}))}">
      ${xt(`data-inv-unit="${a.id}" aria-label="${e(t("{name} 单位",{name:a.name}))}"`,a.du,{cls:"inv-unit"})}
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${e(t("{name} 补充 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">+</button>
    </div>
    <button type="button" class="swipe-src" data-action="inv-del" data-id="${a.id}">${t("删除 {name}",{name:a.name})}</button>
    <button type="button" class="swipe-alt-src" data-action="inv-shop" data-id="${a.id}">${t("{name} 加入购物车",{name:a.name})}</button>
  </li>`}function Ia(a="pantry"){if(Et()==="rows")return At(a);u.filter.space!==a&&Object.assign(u.filter,{space:a,cat:"all",q:"",status:u.filter.status,loc:"all"});let n=u.filter,s=a==="house",o=a==="gear";o&&(n.status="all");let l=qt(),r=l&&n.cat==="all",i=($,w)=>`<button type="button" class="chip" data-action="cat" data-cat="${$}" aria-pressed="${n.cat===$}">${w}</button>`,d=o&&!l?N("gear"):"",p=u.enriched.filter(j(a)),c=n.cat!=="all"?q(n.cat):null,h=u.catForm&&u.catForm.space===a?u.catForm:null;(!c||!(c.subs||[]).includes(n.sub))&&(n.sub="all");let y=c?(c.subs||[]).map($=>[$,p.filter(w=>w.category===c.id&&w.subcategory===$).length]).filter(([,$])=>$>0):[],f=y.length>1?`<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${n.sub==="all"}">${t("全部小类")}</button>
        ${y.map(([$,w])=>`<button type="button" class="chip" data-action="inv-sub" data-sub="${e($)}" aria-pressed="${n.sub===$}">${e(t($))} <span class="muted">${w}</span></button>`).join("")}</div>`:"",m=y.length>1?`<select id="invSubSel" aria-label="${t("按小类筛选")}"><option value="all">${t("全部小类")}</option>${y.map(([$,w])=>`<option value="${e($)}" ${n.sub===$?"selected":""}>${e(t($))} (${w})</option>`).join("")}</select>`:"",v=l&&c?`<div class="inv-filters${m?"":" solo"}">
        <select id="invCatSel" data-search aria-label="${t("按分类筛选")}"><option value="all">${t("全部")}</option>${jt(a,c.id)}</select>${m}</div>`:f;return`
    <section class="section">
      <div class="section-head"><p>${c?t("{n} 件",{n:p.filter($=>$.category===c.id).length}):t("{n} 件",{n:p.length})}</p>
        <div class="head-acts">${s&&!l?`<a class="btn btn-sm btn-ghost" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:""}
        ${c&&!h?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${c.id}">${t("编辑分类")}</button>`:""}
        ${Ct("cats")}</div></div>
      ${!u.houseEnabled&&!u.gearEnabled?"":`<div class="chips" role="group" aria-label="${t("库存范围")}">
        <button type="button" class="chip" data-action="inv-space" data-space="pantry" aria-pressed="${!s&&!o}">🥫 ${t("日常消耗品")}</button>
        ${u.houseEnabled?`<button type="button" class="chip" data-action="inv-space" data-space="house" aria-pressed="${s}">🧰 ${t("汽车房屋消耗品")}</button>`:""}
        ${u.gearEnabled?`<button type="button" class="chip" data-action="inv-space" data-space="gear" aria-pressed="${o}">🛋️ ${t("家居耐用品")}</button>`:""}</div>`}
      ${s&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>`:""}
      ${o&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>`:""}
      ${d?`<div class="shelf" style="margin-bottom:14px">${d}</div>`:""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${o?t("搜索，例如：被罩、千斤顶、自行车"):s?t("搜索，例如：滤网、电池"):t("搜索物品，例如：纸、蛋")}" value="${e(n.q)}" aria-label="${t("搜索物品")}">
        ${o?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([$,w])=>`<option value="${$}" ${n.status===$?"selected":""}>${t(w)}</option>`).join("")}
        </select>`}
        ${nt(p,n)}
        ${s?W(n):""}
        <select id="invSort" aria-label="${t("排序")}">${_t.filter(([$])=>!(o&&$==="exp")).map(([$,w])=>`<option value="${$}" ${(n.sort||"default")===$?"selected":""}>${t(w)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${l?"":`<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${i("all",t("全部"))}${Mt(a,i)}
        <button type="button" class="chip chip-add" data-action="cat-new" data-space="${a}">＋ ${t("新分类")}</button>
      </div>`}
      ${h?K(h):""}
      ${v}
      ${r&&!h?`<div id="dashWrap" data-space="${a}">${st(a,p)}</div>`:""}
      <div id="invList" ${r?"hidden":""}></div>
      ${D(`${a}${c?`&cat=${c.id}`:""}`,o?t("添加家居耐用品"):t("添加物品"))}
    </section>`}var _t=[["default","按状态（缺货优先）"],["name","名称 A → Z"],["qty","数量：少 → 多"],["exp","保质期：近 → 远"],["updated","最近更新"]];function Ta(){let a=E("#invRows");if(a)return Gt(a);let n=u.filter,s=u.enriched.filter(j(n.space)),o=s.filter(m=>B(m,n)),l=E("#invList");if(!l)return;let r=E("#dashWrap");if(r){r.innerHTML=st(r.dataset.space,s),l.hidden=!0;return}if(!o.length){l.innerHTML=s.length?`<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`:n.space==="house"?`<div class="panel empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></p></div>`:n.space==="gear"?`<div class="panel empty"><strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></p></div>`:`<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;return}let i=R("inv",JSON.stringify(n)),d=i,p=new Map;for(let m of o){let v=p.get(m.category);v?v.push(m):p.set(m.category,[m])}let c=_(n.space),h=new Set(c.filter(m=>m.cats.some(v=>p.has(v.id))).map(m=>m.g.id)),y=h.size>1,f="";l.innerHTML=c.flatMap(m=>m.cats.map(v=>[m.g,v])).map(([m,v])=>{let $=(p.get(v.id)||[]).sort(Z(n.sort));if(!$.length||d<=0)return"";let w=$.slice(0,d);d-=w.length;let b=y&&m.id!==f?`<h2 class="inv-grp-h">${e(at(m))}</h2>`:"";f=m.id;let x=n.space==="gear"?0:$.filter(g=>g.status!=="ok"&&!I(g.id)).length;return`${b}<div class="cat-group" style="--cat:${v.color}"><div class="cat-group-h"><h3><span class="dot" aria-hidden="true"></span>${v.icon} ${t(v.name)}<span class="muted">（${$.length}）</span></h3>
      ${x?`<button type="button" class="btn btn-sm cat-shop" data-action="inv-cat-shop" data-cat="${v.id}" aria-label="${e(t("{c}：{n} 件要补货，全部加入购物车",{c:t(v.name),n:x}))}">🛒 ${t("全部加入购物车")} <b class="ui-badge" data-shape="count">${x}</b></button>`:""}</div>
      <div class="items">${w.map(Pt).join("")}</div></div>`}).join("")+U("inv",T(n.space).reduce((m,v)=>m+(p.get(v.id)?.length||0),0),i)}function Pt(a){let n=C[a.status],s=vt.mode==="cloud"?ft(a.updated_by):null,o=t(a.du),l=(a.updated_at||a.created_at)&&`<span title="${e(mt(a))}">${s?`${e(s)} `:""}${t("{d} 更新",{d:$t(a.updated_at||a.created_at)})}</span>`;if(G(a)){let p=[a.subcategory&&`<span>${e(t(a.subcategory))}</span>`,a.location&&`<span>📍${e(t(a.location))}</span>`,a.notes&&`<span class="note" title="${e(a.notes)}">${e(a.notes.length>40?`${a.notes.slice(0,40)}…`:a.notes)}</span>`,l].filter(Boolean).join("");return`<article class="item is-gear" aria-label="${e(`${a.name}，${S(a.dqty)} ${o}${a.location?t("，在{loc}",{loc:t(a.location)}):""}`)}">
      <span class="gear-ico" aria-hidden="true">${q(a.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${e(a.name)}</button></div>
        <div class="item-meta">${p}</div>
        ${a.qty>0?`<div class="item-acts"><button type="button" class="link-name" data-action="gear-broke" data-id="${a.id}" aria-label="${e(a.name)} — ${e(t("损坏了，换新"))}">🔨 ${t("损坏了，换新")}</button></div>`:""}
      </div>
      <div class="qty"><output>${S(a.dqty)}<small>${e(o)}</small></output></div>
    </article>`}let r=[a.subcategory&&`<span>${e(t(a.subcategory))}</span>`,a.location&&`<span>📍${e(t(a.location))}</span>`,a.daysLeft!=null&&`<span>${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}</span>`,a.rate&&`<span title="${a.rateSrc==="manual"?t("手动设置"):t("根据最近使用记录估算")}">${t("日均 {q} {u}",{q:S(a.drate),u:e(o)})}</span>`,l].filter(Boolean).join(""),i=a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>${a.exp==="expired"&&a.qty>0?et(a):""}`:"",d=`${a.name}，${t("剩余 {q} {u}",{q:S(a.dqty),u:o})}，${t(n.label)}`;return`<article class="item st-${a.status}" aria-label="${e(d)}">
    <div class="jar st-${a.status}" role="img" aria-label="${t("存量约 {p}%",{p:Math.round(a.level*100)})}">
      <i style="height:${Math.max(a.qty>0?6:0,a.level*100)}%"></i>
      ${a.minMark!=null?`<span class="tick" style="bottom:${a.minMark*100}%"></span>`:""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${e(a.name)}</button>
        ${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:""}${a.muted?`<span class="badge b-muted" title="${t("已设为不提醒；编辑页里可以恢复")}">🔕 ${t("不提醒")}</span>`:""}${i}</div>
      <div class="item-meta">${r}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${e(t("{name} 用掉 {q} {u}",{name:a.name,q:Units.step(a.du),u:o}))}">−</button>
      <output>${S(a.dqty)}<small>${e(o)}</small></output>
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${e(t("{name} 补充 {q} {u}",{name:a.name,q:Units.step(a.du),u:o}))}">+</button>
    </div>
  </article>`}var Vt=(a,n)=>n?`<button type="button" class="rs-tag is-in" data-action="shop-remove-item" data-id="${a.id}" title="${e(t("点一下移出购物车"))}" aria-label="${e(t("{name}：已加入购物车，点一下移出",{name:a.name}))}">✓ ${t("已加入")}</button>`:`<button type="button" class="rs-tag" data-action="shop-add-item" data-id="${a.id}" title="${e(t("点一下加入购物车"))}" aria-label="${e(t("{name}：未加入购物车，点一下加入",{name:a.name}))}">${t("未加入")}</button>`;function Wt(a,n=8){return a.length?`<ul class="restock-list rs-list">${a.slice(0,n).map(s=>{let o=!!I(s.id),l=o?`data-swipe-del="rs" data-swipe-alt="rs" data-swipe-alt-label="${e(t("移出购物车"))}" data-swipe-alt-go="${e(t("松手移出"))}"`:`data-swipe-del="rs" data-swipe-left-label="${e(t("加入购物车"))}" data-swipe-left-go="${e(t("松手加入"))}"`;return`<li class="rs-row ${o?"rs-in":""}" ${l} ${F([{label:t("编辑"),action:"edit",data:{id:s.id},first:!0},o?{label:t("移出购物车"),action:"shop-remove-item",data:{id:s.id}}:{label:t("加入购物车"),action:"shop-add-item",data:{id:s.id}}],s.name)}>
      <span class="badge ${C[s.status].cls}">${t(C[s.status].label)}</span>
      <div class="grow"><span class="rs-name"><button type="button" class="link-name" data-action="edit" data-id="${s.id}">${e(s.name)}</button>${Vt(s,o)}</span>
        <small>${t("剩 {q} {u}",{q:S(s.dqty),u:e(t(s.du))})}${s.daysLeft!=null&&s.qty>0?t("，约够 {d} 天",{d:Math.max(0,Math.floor(s.daysLeft))}):""}${o?"":t("，建议买 {q} {u}",{q:S(s.dsuggest),u:e(t(s.du))})}</small></div>
      ${o?`<button type="button" class="swipe-alt-src" data-action="shop-remove-item" data-id="${s.id}">${t("移出购物车")}</button>`:`<button type="button" class="swipe-src" data-action="shop-add-item" data-id="${s.id}">${t("加入购物车")}</button>`}
    </li>`}).join("")}</ul>`:""}var Kt=()=>`<p class="muted rs-hint"><span class="rs-hint-touch">${t("点「未加入」加入购物车，点「已加入」移出；也可 ← 左滑加入 · 右滑移出 →")}</span><span class="rs-hint-mouse">${t("点「未加入」加入购物车，点「已加入」移出")}</span></p>`;function N(a,n=""){let s=u.enriched.filter(j(a)).filter(o=>!n||wt(o,n,!0));return dt(a).map(o=>{let l=s.filter(p=>p.category===o.id);if(!l.length)return"";if(a==="gear"){let p=[...new Set(l.map(c=>c.location).filter(Boolean))];return`<button type="button" class="shelf-cell" style="--cat:${o.color}" data-action="goto-cat" data-space="${a}" data-cat="${o.id}">
        <span class="ico" aria-hidden="true">${o.icon}</span><h3>${t(o.name)}</h3>
        <p>${t("{n} 种",{n:l.length})}${p.length?t("，在{locs}{etc}",{locs:e(ct(p.slice(0,2).map(c=>t(c)))),etc:p.length>2?t("等"):""}):""}</p>
      </button>`}let r=p=>l.filter(c=>c.status===p).length,i=(p,c)=>r(p)?`<i style="width:${r(p)/l.length*100}%;background:${c}"></i>`:"",d=l.length-r("ok");return`<button type="button" class="shelf-cell" style="--cat:${o.color}" data-action="goto-cat" data-space="${a}" data-cat="${o.id}"${n?` data-owner="${e(n)}"`:""}>
      <span class="ico" aria-hidden="true">${o.icon}</span><h3>${t(o.name)}</h3>
      <p>${t("{n} 种",{n:l.length})}${d?t("，{n} 种需补",{n:d}):t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${i("out","var(--out)")}${i("low","var(--low)")}${i("soon","var(--mustard)")}${i("ok","var(--pine)")}</div>
    </button>`}).join("")}var Lt={pantry:"日常消耗品",house:"汽车房屋消耗品",gear:"家居耐用品"};function Yt(){let a=u.items.filter(s=>s.cat_check).sort((s,o)=>rt(s.name,o.name));if(!a.length)return"";let n=(s,o)=>{let l=q(s);return`${l.icon} ${e(t(l.name))}${o?` · ${e(t(o))}`:""}`};return`<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${a.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类细化时，这些物品是按名称猜着搬的。放对了点「没错」；放错了点「改回…」或「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${a.slice(0,30).map(s=>{let o=ht(s),l=r=>t(Lt[q(r).space]||"");return`<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${s.id}">${e(s.name)}</button>
          <small>${t("现在：")}${n(s.category,s.subcategory)}<span class="muted">（${l(s.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${s.id}">${t("没错")}</button>
          ${o?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${s.id}" data-cat="${o[0]}" data-sub="${e(o[1])}" title="${e(t(Lt[q(o[0]).space]||""))}">${s.cat_prev?t("改回"):t("改成")} ${n(o[0],o[1])}</button>`:""}
        </div></li>`}).join("")}</ul>${a.length>30?`<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示",{n:a.length-30})}</p>`:""}</div>
    </section>`}var Ot="hmh-pv-fold",It=()=>{try{return JSON.parse(localStorage.getItem(Ot)||"{}")}catch{return{}}};function Va(a,n){let s=It();s[a]=n?1:0;try{localStorage.setItem(Ot,JSON.stringify(s))}catch{}}function Zt(a,n){if(a==="gear")return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="gear" data-cat="all"><span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3><p>${t("{n} 种",{n:n.length})}</p></button>`;let s=r=>n.filter(i=>i.status===r).length,o=n.length-s("ok"),l=(r,i)=>s(r)?`<i style="width:${s(r)/n.length*100}%;background:${i}"></i>`:"";return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="${a}" data-cat="all">
    <span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3>
    <p>${t("{n} 种",{n:n.length})}${o?t("，{n} 种需补",{n:o}):t("，都充足")}</p>
    <div class="mix" aria-hidden="true">${l("out","var(--out)")}${l("low","var(--low)")}${l("soon","var(--mustard)")}${l("ok","var(--pine)")}</div></button>`}function ot(a,n,s,o,l,r){let i=f=>o.filter(m=>m.status===f).length,d=o.filter(f=>f.exp).length,p=[["out",t("缺货"),i("out")],["low",t("少货"),i("low")],["soon",t("即将告罄"),i("soon")],...a==="pantry"?[["exp",t("临期或过期"),d]]:[]],c=p.reduce((f,m)=>f+m[2],0),h=It()[a]!==0,y=a==="gear"?t("{n} 种，长期用的东西，只记数量和位置",{n:o.length}):o.length?c?p.filter(f=>f[2]).map(f=>`${f[1]} ${f[2]}`).join(" · "):t("{n} 种，都充足",{n:o.length}):t("还没有物品");return`<details class="pv-card" data-fold="${a}" ${h?"open":""}>
    <summary><span class="pv-ico" aria-hidden="true">${n}</span><span class="pv-ttl"><b>${e(s)}</b><small class="${c?"pv-bad":""}">${e(y)}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
    <div class="pv-body">
      ${l?`<div class="shelf">${Zt(a,o)}${l}</div>`:r}
    </div></details>`}var et=a=>`<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${a.id}" aria-label="${e(t("{name} 过期了，扔掉剩下的",{name:a.name}))}">🗑 ${t("扔掉")}</button>`;function Qt(){let a=u.shopping.filter(n=>n.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${k("shopping","list")}" aria-label="${e(t("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${t("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`}function Wa(){let a=u.houseEnabled,n=u.enriched.filter(j("pantry")),s=a?u.enriched.filter(j("house")):[],o=[...n,...s],l=(c,h)=>c.filter(y=>y.status===h).length,r=gt(o),i=n.filter(c=>c.exp).sort((c,h)=>c.expDays-h.expDays),d=N("pantry"),p=a?N("house"):"";return`${Yt()}
    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${r.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${t("全部加入购物车")}</button>`:""}${Qt()}</div></div>
      ${r.length?Kt():""}
      <div class="panel">${r.length?Wt(r):`<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
      ${r.length?bt({id:"restock",title:t("该补货了"),question:t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),context:()=>[t("要补：{s}",{s:r.slice(0,15).map(c=>c.name||c.item?.name).filter(Boolean).join("、")}),t("家庭人数 {n}",{n:u.members?.length||1})]}):""}
    </section>

    <section class="section" aria-labelledby="h-alert">
      <h2 id="h-alert" class="sr-only">${t("储藏概览")}</h2>
      <div class="pv-cards">
        ${ot("pantry","🥫",t("日常消耗品"),n,d,`<div class="empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=pantry">${t("添加第一件物品")}</a></div>`)}
        ${a?ot("house","🧰",t("汽车房屋消耗品"),s,p,`<div class="empty"><strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></div>`):""}
        ${u.gearEnabled?ot("gear","🛋️",t("家居耐用品"),u.enriched.filter(j("gear")),N("gear"),`<div class="empty"><strong>${t("还没有家居耐用品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></div>`):""}
      </div>
    </section>

    ${i.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${i.slice(0,6).map(c=>`<li>
        <span class="badge b-exp">${c.exp==="expired"?t("已过期"):c.expDays===0?t("今天到期"):t("{d} 天后到期",{d:c.expDays})}</span>
        <div class="grow"><span class="name">${e(c.name)}</span><small>${e(t(c.location||""))} ${t("剩 {q} {u}",{q:S(c.dqty),u:e(t(c.du))})}</small></div>${c.exp==="expired"&&c.qty>0?et(c):""}</li>`).join("")}</ul></div>
    </section>`:""}

    ${D("pantry",t("添加物品"))}<div class="fab-spacer" aria-hidden="true"></div>
`}export{Wt as a,Kt as b,N as c,Va as d,et as e,Wa as f,Et as g,D as h,Oa as i,Rt as j,Jt as k,Ia as l,Ta as m,Pt as n};
