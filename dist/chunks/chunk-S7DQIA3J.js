import{a as St}from"./chunk-NXNAQRBH.js";import{a as kt,b as qt,c as jt,d as Y,f as Z,h as Q}from"./chunk-7UWAC5XD.js";import{a as xt}from"./chunk-MHVXEQTA.js";import{i as yt,r as K}from"./chunk-4MGXO67A.js";import{a as D}from"./chunk-7XFWWEJB.js";import{d as R,h as U}from"./chunk-ASZHTEDT.js";import{a as z,c as J,d as P}from"./chunk-WDZ3BPZL.js";import{e as V,f as wt,h as W,i as _,j as B}from"./chunk-F6VOTJSE.js";import{i as T}from"./chunk-U3PGMDUL.js";import{b as gt,d as ft,e as I}from"./chunk-ASNLHRAF.js";import{c as bt}from"./chunk-QAMGMHJC.js";import{Ja as vt,x as ht}from"./chunk-25KWZFEL.js";import{a as $,b as C,f as S}from"./chunk-JB5BL7MD.js";import{F as q,G as dt,H as pt,I as j,J as G,N as $t,V as ut,X as mt,k as t,m as ct,n as rt,s as F,t as o,u as M,v as k}from"./chunk-DJGTW2W4.js";var Mt=()=>window.matchMedia("(max-width: 640px)").matches||document.documentElement.classList.contains("force-phone"),tt=a=>`${a.icon} ${t(a.name)}`;function Ct(a,n){let s=l=>`<option value="${o(l.id)}" ${l.id===n?"selected":""}>${l.icon} ${o(t(l.name))}</option>`,e=_(a);return e.length<2?e.flatMap(l=>l.cats).map(s).join(""):e.map(l=>`<optgroup label="${o(t(l.g.name))}">${l.cats.map(s).join("")}</optgroup>`).join("")}function _t(a,n){let s=_(a),e=l=>n(l.id,`${l.icon} ${t(l.name)}`);return s.length<2?s.flatMap(l=>l.cats).map(e).join(""):s.map(l=>`<span class="chip-grp" aria-hidden="true">${o(t(l.g.name))}</span>${l.cats.map(e).join("")}`).join("")}function X(a){let n=a.filter(e=>e.status==="out").length,s=a.filter(e=>e.status==="low"||e.status==="soon"||e.exp).length;return{out:n,warn:s,kind:a.length?n?"out":s?"warn":"ok":"none"}}var Ft=(a,n)=>n.length?a.kind==="out"?`<span class="badge b-out"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 缺货",{n:a.out})}${a.warn?` · ${t("{n} 少货",{n:a.warn})}`:""}</span>`:a.kind==="warn"?`<span class="badge b-low"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 少货 / 临期",{n:a.warn})}</span>`:`<span class="badge b-ok"><i class="b-ic" data-g="✓" aria-hidden="true"></i>${t("充足")}</span>`:`<span class="badge b-none">${t("空")}</span>`,Dt=a=>!!a.q.trim()||a.status!=="all"||(a.loc||"all")!=="all";function at(a){let n=[["pantry","日常消耗品"],...$.houseEnabled?[["house","汽车房屋消耗品"]]:[],...$.gearEnabled?[["gear","家居耐用品"]]:[]];return n.length<2?"":`<select id="invSpaceSel" aria-label="${t("库存范围")}">${n.map(([s,e])=>`<option value="${s}" ${a===s?"selected":""}>${t(e)}</option>`).join("")}</select>`}function nt(a,n){let s=new Set(a.map(d=>d.location).filter(Boolean));if(!s.size)return"";let e=yt().map(d=>({...d,locs:d.locs.filter(p=>s.has(p.name))})).filter(d=>d.locs.length),l=new Set(e.flatMap(d=>d.locs.map(p=>p.name))),r=[...s].filter(d=>!l.has(d)),c=d=>`<option value="${o(d)}" ${n.loc===d?"selected":""}>${o(t(d))}</option>`;return`<select id="invLoc" aria-label="${t("按位置筛选")}"><option value="all">${t("全部位置")}</option>
    ${e.map(d=>`<optgroup label="${o(t(d.name))}">${d.locs.map(p=>c(p.name)).join("")}</optgroup>`).join("")}
    ${r.length?`<optgroup label="${t("其他")}">${r.map(c).join("")}</optgroup>`:""}</select>`}function st(a,n){let s=$.filter,e=Dt(s),l=e?n.filter(b=>B(b,s,{withCat:!1})):n,r=!e&&!!$.catSort,c=T(a),d=a==="gear";if(e){let b=c.map(x=>{let g=l.filter(O=>O.category===x.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:X(g),A=`<span class="tile-top"><span class="tile-ico" style="--cat:${x.color}" aria-hidden="true">${x.icon}</span><b class="tile-count">${g.length}</b></span>
        <span class="tile-name">${o(t(x.name))}</span>${g.length?`<span class="badge b-none">${o(g.slice(0,3).map(O=>O.name).join(" · "))}${g.length>3?" …":""}</span>`:`<span class="badge b-none">${t("无")}</span>`}`;return`<button type="button" class="tile st-${L.kind} ${g.length?"is-hit":"is-dim"}" data-action="cat" data-cat="${x.id}" ${g.length?"":"disabled"}>${A}</button>`}).join("");return`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件符合")}</span><small>${l.length?t("点格子进入分类，筛选条件会保留"):t("换个关键词或筛选试试")}</small></div>
        <button type="button" class="stat" data-action="inv-clear"><b>✕</b><span>${t("清除")}</span></button></div>
      <div class="cat-dash" id="catDash">${b}</div>`}let p=d?null:X(l),i=d?0:l.filter(b=>b.exp).length,h=d?0:l.filter(b=>b.status==="low"||b.status==="soon").length,y=(b,x,g,L)=>`<button type="button" class="stat ${L}" data-action="goto-status" data-space="${a}" data-status="${g}" ${b?"":"disabled"}><b>${b}</b><span>${x}</span></button>`,f=d?`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件家居耐用品")}</span></div></div>`:`<div class="dash-sum">
        <div class="sum-main"><b>${l.length}</b><span>${t("件物品")}</span><small>${p.kind==="ok"?t("库存都充足"):t("{n} 件要补货",{n:p.out+h})}</small></div>
        <div class="sum-stats">${y(p.out,t("缺货"),"out","s-out")}${y(h,t("少货"),"low","s-warn")}${y(i,t("临期"),"exp","s-exp")}</div>
      </div>`,m=(b,x)=>{let g=l.filter(H=>H.category===b.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:X(g),A=d?g.reduce((H,Nt)=>H+M(Nt.qty),0):g.length,O=r?`<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="-1" ${x===0?"disabled":""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="1" ${x===c.length-1?"disabled":""} aria-label="${t("往后")}">›</button></span>`:"",lt=`<span class="tile-top"><span class="tile-ico" style="--cat:${b.color}" aria-hidden="true">${b.icon}</span><b class="tile-count">${A}</b></span>
      <span class="tile-name">${o(t(b.name))}</span>
      ${d?g.length?`<span class="badge b-none">${t("{n} 种",{n:g.length})}</span>`:`<span class="badge b-none">${t("空")}</span>`:Ft(L,g)}${O}`,it=`tile st-${L.kind} ${g.length?"":"is-empty"}`;return r?`<div class="${it} is-sorting">${lt}</div>`:`<button type="button" class="${it}" data-action="cat" data-cat="${b.id}">${lt}</button>`},v=r?[]:_(a,c),u=r||v.length<2?c.map(m).join(""):v.map(b=>`<h4 class="cat-grp-h">${o(tt(b.g))}</h4>${b.cats.map(x=>m(x,c.indexOf(x))).join("")}`).join(""),w=r?"":`<button type="button" class="tile tile-add" data-action="cat-new" data-space="${a}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="badge b-none">${t("自定义")}</span></button>`;return`${f}<div class="cat-dash" id="catDash">${u}${w}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${r?t("完成排序"):t("调整顺序")}</button></p>`}function Et(){try{return localStorage.getItem(kt)==="cats"?"cats":"rows"}catch{return"rows"}}var Lt=a=>`<div class="view-bar">${xt([["rows","物品","☰"],["cats","分类","▦"]],a,{action:"inv-view",attr:"view"})}</div>`,At=a=>!!a.alert_mute_until&&String(a.alert_mute_until)>$t(),Ht=()=>$.filter.space==="house"&&$.houseEnabled?"house":$.filter.space==="gear"?"gear":"pantry",E=(a,n)=>String(a).includes("&cat=")?`<a class="fab" href="${S("item","new")}?space=${a}" aria-label="${o(n)}" title="${o(n)}"><span aria-hidden="true">＋</span></a>`:`<button type="button" class="fab" data-action="add-item-pick" aria-label="${o(n)}" title="${o(n)}"><span aria-hidden="true">＋</span></button>`;function Gt(a){let n=$.filter;n.space!==a&&Object.assign(n,{space:a,cat:"all"});let s=$.enriched.filter(j(a)),e=n.cat!=="all"?q(n.cat):null;return`<section class="section inv-rows-page">
      <div class="section-head"><p>${t("{n} 件",{n:s.length})}</p><div class="head-acts">
        <button type="button" class="btn btn-sm ${$.invSel?"btn-primary":"btn-ghost"}" data-action="inv-select" aria-pressed="${!!$.invSel}">${$.invSel?t("完成"):`☑ ${t("多选")}`}</button>${Lt("rows")}</div></div>
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${t("搜索物品，例如：纸、蛋")}" value="${o(n.q)}" aria-label="${t("搜索物品")}">
        ${at(a)}
        ${a==="gear"?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([l,r])=>`<option value="${l}" ${n.status===l?"selected":""}>${t(r)}</option>`).join("")}
        </select>`}
        ${nt(s,n)}
        ${W(n)}
        <select id="invSort" aria-label="${t("排序")}">${Ot.map(([l,r])=>`<option value="${l}" ${(n.sort||"default")===l?"selected":""}>${t(r)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${e?`<div class="chips inv-catchip"><button type="button" class="chip" data-action="cat" data-cat="all" aria-pressed="true" aria-label="${o(t("清除分类：{c}",{c:t(e.name)}))}">${e.icon} ${o(t(e.name))} <span aria-hidden="true">✕</span></button></div>`:""}
      <div id="invRows" class="${$.invSel?"sel-mode":""}"></div>
      ${$.invSel?Rt():E(Ht(),t("添加物品"))}
    </section>`}function Rt(){let a=$.invSel.size?"":"disabled";return`<div class="inv-selbar" role="toolbar" aria-label="${o(t("多选操作"))}">
    <span class="inv-seln" aria-live="polite">${o(Z())}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-action="inv-sel-all">${t("全选")}</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-action="inv-sel-shop" ${a}>🛒 ${t("加入购物车")}</button>
    <button type="button" class="btn btn-sm" data-action="inv-sel-mute" ${a}>🔕 ${t("不提醒")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-action="inv-sel-del" ${a}>🗑 ${t("删除")}</button>
  </div>`}function Ut(a){let n=$.filter,s=n.cat!=="all"?q(n.cat):null,e=(()=>{try{return JSON.parse(localStorage.getItem("hmh-pv-fold")||"{}")}catch{return{}}})(),l=(c,d,p)=>{if(s&&pt(s.id)!==c)return"";let i=$.enriched.filter(j(c)),h=i.filter(jt).sort(Y(n.sort)),y=c==="gear"?[]:Q(c),f=R(`inv-${c}`,JSON.stringify(n)),m=h.slice(0,f),v=h.length?`<ul class="inv-list">${m.map(Vt).join("")}</ul>${U(`inv-${c}`,h.length,f)}`:`<div class="empty">${i.length?`<strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或筛选试试。")}`:c==="house"?`<strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${S("house","template")}">${t("按房屋资料推荐")}</a>`:c==="gear"?`<strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}`:`<strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}`}</div>`;return`<details class="pv-card inv-sec" data-fold="${c}" id="invSec-${c}" ${e[c]!==0?"open":""}>
      <summary><span class="pv-ico" aria-hidden="true">${d}</span><span class="pv-ttl"><b>${o(p)}</b><small>${h.length===i.length?t("{n} 件",{n:i.length}):t("{a} / {b} 件符合",{a:h.length,b:i.length})}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
      <div class="pv-body">${y.length&&!$.invSel?`<div class="inv-sec-bar"><span class="muted">${t("{n} 件要补货",{n:y.length})}</span><button type="button" class="btn btn-sm" data-action="inv-sec-shop" data-space="${c}">🛒 ${t("全部加入购物车")}</button></div>`:""}${v}</div></details>`},r={pantry:["🥫",t("日常消耗品")],house:["🧰",t("汽车房屋消耗品")],gear:["🛋️",t("家居耐用品")]};a.innerHTML=`<div class="pv-cards">${qt().filter(c=>c===n.space).map(c=>l(c,...r[c])).join("")}</div>`}var Ba=a=>`<span class="badge ${C[a.status].cls}">${t(C[a.status].label)}</span>`,zt=()=>`<span class="rs-tag is-in is-static" title="${o(t("已加入购物车"))}" aria-label="${o(t("已加入购物车"))}" role="img">✓🛒</span>`,Jt=a=>At(a)||M(a.min_quantity)<=0&&M(a.lead_days)<=0;function Pt(a,n){if(G(a))return"";let s=Jt(a),e=Units.factor(a.unit),l=s?[]:[M(a.min_quantity)>0&&t("少货线 {q} {u}",{q:k(M(a.min_quantity)*e),u:o(t(a.du))}),M(a.lead_days)>0&&t("提前 {d} 天",{d:M(a.lead_days)})].filter(Boolean),r=s?`🔕 ${t("不提醒")}`:`🔔 ${l.join(" · ")}`,c=s?t("点一下设置提醒"):t("点一下修改提醒设置");return n?`<span class="rem-tag${s?" is-off":""}">${r}</span>`:`<button type="button" class="rem-tag${s?" is-off":""}" data-action="item-remind" data-id="${a.id}" title="${o(c)}" aria-label="${o(`${a.name}：${s?t("不提醒"):l.join("，")}，${c}`)}">${r}</button>`}function Vt(a){let n=C[a.status],s=q(a.category),e=I(a.id),l=[`${s.icon} ${o(t(a.subcategory||s.name))}`,V(a)&&`<span class="own-tag">${o(V(a))}</span>`,a.location&&`📍${o(t(a.location))}`,a.daysLeft!=null&&a.qty>0&&`${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}`].filter(Boolean).join(" · "),r=`${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:Pt(a,!!$.invSel)}${a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>`:""}${e?zt():""}`,c=Units.step(a.du),d=o(a.name),p=$.invSel,i=p?.has(a.id),h=p?`data-row-sel="${a.id}"`:`data-row-open="${o(S("item",a.id))}" data-swipe-del="item" data-swipe-alt="item" data-swipe-alt-label="${o(t("加入购物车"))}" data-swipe-alt-go="${o(t("松手加入"))}"`,y=p?"":D([{label:t("详情"),href:S("item",a.id),first:!0},{label:t("加入购物车"),action:"inv-shop",data:{id:a.id}},{label:t("删除"),action:"inv-del",data:{id:a.id},danger:!0}],a.name);return`<li class="inv-row st-${a.status}${i?" is-picked":""}" data-id="${a.id}" ${h} ${y}>
    <span class="inv-bar" aria-hidden="true"></span>
    ${p?`<input type="checkbox" class="inv-chk" data-sel-id="${a.id}" ${i?"checked":""} aria-label="${o(t("选择 {name}",{name:a.name}))}">`:""}
    <div class="inv-main"><div class="inv-name">${p?`<span class="inv-link">${d}</span>`:`<a href="${o(S("item",a.id))}" class="inv-link">${d}</a>`}${r}</div><div class="inv-meta">${l}</div></div>
    <div class="inv-qty" role="group" aria-label="${o(t("{name} 数量",{name:a.name}))}">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${o(t("{name} 用掉 {q} {u}",{name:a.name,q:c,u:t(a.du)}))}">−</button>
      <input type="number" inputmode="decimal" min="0" step="any" value="${k(a.dqty)}" data-inv-qty="${a.id}" data-keep="invq:${a.id}" aria-label="${o(t("{name} 数量",{name:a.name}))}">
      ${St(`data-inv-unit="${a.id}" aria-label="${o(t("{name} 单位",{name:a.name}))}"`,a.du,{cls:"inv-unit"})}
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${o(t("{name} 补充 {q} {u}",{name:a.name,q:c,u:t(a.du)}))}">+</button>
    </div>
    <button type="button" class="swipe-src" data-action="inv-del" data-id="${a.id}">${t("删除 {name}",{name:a.name})}</button>
    <button type="button" class="swipe-alt-src" data-action="inv-shop" data-id="${a.id}">${t("{name} 加入购物车",{name:a.name})}</button>
  </li>`}function Na(a="pantry"){if(Et()==="rows")return Gt(a);$.filter.space!==a&&Object.assign($.filter,{space:a,cat:"all",q:"",status:$.filter.status,loc:"all"});let n=$.filter,s=a==="house",e=a==="gear";e&&(n.status="all");let l=Mt(),r=l&&n.cat==="all",c=(u,w)=>`<button type="button" class="chip" data-action="cat" data-cat="${u}" aria-pressed="${n.cat===u}">${w}</button>`,d=e&&!l?N("gear"):"",p=$.enriched.filter(j(a)),i=n.cat!=="all"?q(n.cat):null,h=$.catForm&&$.catForm.space===a?$.catForm:null;(!i||!(i.subs||[]).includes(n.sub))&&(n.sub="all");let y=i?(i.subs||[]).map(u=>[u,p.filter(w=>w.category===i.id&&w.subcategory===u).length]).filter(([,u])=>u>0):[],f=y.length>1?`<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${n.sub==="all"}">${t("全部小类")}</button>
        ${y.map(([u,w])=>`<button type="button" class="chip" data-action="inv-sub" data-sub="${o(u)}" aria-pressed="${n.sub===u}">${o(t(u))} <span class="muted">${w}</span></button>`).join("")}</div>`:"",m=y.length>1?`<select id="invSubSel" aria-label="${t("按小类筛选")}"><option value="all">${t("全部小类")}</option>${y.map(([u,w])=>`<option value="${o(u)}" ${n.sub===u?"selected":""}>${o(t(u))} (${w})</option>`).join("")}</select>`:"",v=l&&i?`<div class="inv-filters${m?"":" solo"}">
        <select id="invCatSel" data-search aria-label="${t("按分类筛选")}"><option value="all">${t("全部")}</option>${Ct(a,i.id)}</select>${m}</div>`:f;return`
    <section class="section">
      <div class="section-head"><p>${i?t("{n} 件",{n:p.filter(u=>u.category===i.id).length}):t("{n} 件",{n:p.length})}</p>
        <div class="head-acts">${s&&!l?`<a class="btn btn-sm btn-ghost" href="${S("house","template")}">${t("按房屋资料推荐")}</a>`:""}
        ${i&&!h?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${i.id}">${t("编辑分类")}</button>`:""}
        ${Lt("cats")}</div></div>
      ${s&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>`:""}
      ${e&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>`:""}
      ${d?`<div class="shelf" style="margin-bottom:14px">${d}</div>`:""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${e?t("搜索，例如：被罩、千斤顶、自行车"):s?t("搜索，例如：滤网、电池"):t("搜索物品，例如：纸、蛋")}" value="${o(n.q)}" aria-label="${t("搜索物品")}">
        ${at(a)}
        ${e?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([u,w])=>`<option value="${u}" ${n.status===u?"selected":""}>${t(w)}</option>`).join("")}
        </select>`}
        ${nt(p,n)}
        ${s?W(n):""}
        <select id="invSort" aria-label="${t("排序")}">${Ot.filter(([u])=>!(e&&u==="exp")).map(([u,w])=>`<option value="${u}" ${(n.sort||"default")===u?"selected":""}>${t(w)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${l?"":`<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${c("all",t("全部"))}${_t(a,c)}
        <button type="button" class="chip chip-add" data-action="cat-new" data-space="${a}">＋ ${t("新分类")}</button>
      </div>`}
      ${h?K(h):""}
      ${v}
      ${r&&!h?`<div id="dashWrap" data-space="${a}">${st(a,p)}</div>`:""}
      <div id="invList" ${r?"hidden":""}></div>
      ${E(`${a}${i?`&cat=${i.id}`:""}`,e?t("添加家居耐用品"):t("添加物品"))}
    </section>`}var Ot=[["default","按状态（缺货优先）"],["name","名称 A → Z"],["qty","数量：少 → 多"],["exp","保质期：近 → 远"],["updated","最近更新"]];function Fa(){let a=F("#invRows");if(a)return Ut(a);let n=$.filter,s=$.enriched.filter(j(n.space)),e=s.filter(m=>B(m,n)),l=F("#invList");if(!l)return;let r=F("#dashWrap");if(r){r.innerHTML=st(r.dataset.space,s),l.hidden=!0;return}if(!e.length){l.innerHTML=s.length?`<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`:n.space==="house"?`<div class="panel empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${S("house","template")}">${t("按房屋资料推荐")}</a></p></div>`:n.space==="gear"?`<div class="panel empty"><strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${S("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></p></div>`:`<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;return}let c=R("inv",JSON.stringify(n)),d=c,p=new Map;for(let m of e){let v=p.get(m.category);v?v.push(m):p.set(m.category,[m])}let i=_(n.space),h=new Set(i.filter(m=>m.cats.some(v=>p.has(v.id))).map(m=>m.g.id)),y=h.size>1,f="";l.innerHTML=i.flatMap(m=>m.cats.map(v=>[m.g,v])).map(([m,v])=>{let u=(p.get(v.id)||[]).sort(Y(n.sort));if(!u.length||d<=0)return"";let w=u.slice(0,d);d-=w.length;let b=y&&m.id!==f?`<h2 class="inv-grp-h">${o(tt(m))}</h2>`:"";f=m.id;let x=n.space==="gear"?0:u.filter(g=>g.status!=="ok"&&!I(g.id)).length;return`${b}<div class="cat-group" style="--cat:${v.color}"><div class="cat-group-h"><h3><span class="dot" aria-hidden="true"></span>${v.icon} ${t(v.name)}<span class="muted">（${u.length}）</span></h3>
      ${x?`<button type="button" class="btn btn-sm cat-shop" data-action="inv-cat-shop" data-cat="${v.id}" aria-label="${o(t("{c}：{n} 件要补货，全部加入购物车",{c:t(v.name),n:x}))}">🛒 ${t("全部加入购物车")} <b class="ui-badge" data-shape="count">${x}</b></button>`:""}</div>
      <div class="items">${w.map(Wt).join("")}</div></div>`}).join("")+U("inv",T(n.space).reduce((m,v)=>m+(p.get(v.id)?.length||0),0),c)}function Wt(a){let n=C[a.status],s=vt.mode==="cloud"?ft(a.updated_by):null,e=t(a.du),l=(a.updated_at||a.created_at)&&`<span title="${o(mt(a))}">${s?`${o(s)} `:""}${t("{d} 更新",{d:ut(a.updated_at||a.created_at)})}</span>`;if(G(a)){let p=[a.subcategory&&`<span>${o(t(a.subcategory))}</span>`,a.location&&`<span>📍${o(t(a.location))}</span>`,a.notes&&`<span class="note" title="${o(a.notes)}">${o(a.notes.length>40?`${a.notes.slice(0,40)}…`:a.notes)}</span>`,l].filter(Boolean).join("");return`<article class="item is-gear" aria-label="${o(`${a.name}，${k(a.dqty)} ${e}${a.location?t("，在{loc}",{loc:t(a.location)}):""}`)}">
      <span class="gear-ico" aria-hidden="true">${q(a.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${o(a.name)}</button></div>
        <div class="item-meta">${p}</div>
        ${a.qty>0?`<div class="item-acts"><button type="button" class="link-name" data-action="gear-broke" data-id="${a.id}" aria-label="${o(a.name)} — ${o(t("损坏了，换新"))}">🔨 ${t("损坏了，换新")}</button></div>`:""}
      </div>
      <div class="qty"><output>${k(a.dqty)}<small>${o(e)}</small></output></div>
    </article>`}let r=[a.subcategory&&`<span>${o(t(a.subcategory))}</span>`,a.location&&`<span>📍${o(t(a.location))}</span>`,a.daysLeft!=null&&`<span>${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}</span>`,a.rate&&`<span title="${a.rateSrc==="manual"?t("手动设置"):t("根据最近使用记录估算")}">${t("日均 {q} {u}",{q:k(a.drate),u:o(e)})}</span>`,l].filter(Boolean).join(""),c=a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>${a.exp==="expired"&&a.qty>0?et(a):""}`:"",d=`${a.name}，${t("剩余 {q} {u}",{q:k(a.dqty),u:e})}，${t(n.label)}`;return`<article class="item st-${a.status}" aria-label="${o(d)}">
    <div class="jar st-${a.status}" role="img" aria-label="${t("存量约 {p}%",{p:Math.round(a.level*100)})}">
      <i style="height:${Math.max(a.qty>0?6:0,a.level*100)}%"></i>
      ${a.minMark!=null?`<span class="tick" style="bottom:${a.minMark*100}%"></span>`:""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${o(a.name)}</button>
        ${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:""}${a.muted?`<span class="badge b-muted" title="${t("已设为不提醒；编辑页里可以恢复")}">🔕 ${t("不提醒")}</span>`:""}${c}</div>
      <div class="item-meta">${r}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${o(t("{name} 用掉 {q} {u}",{name:a.name,q:Units.step(a.du),u:e}))}">−</button>
      <output>${k(a.dqty)}<small>${o(e)}</small></output>
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${o(t("{name} 补充 {q} {u}",{name:a.name,q:Units.step(a.du),u:e}))}">+</button>
    </div>
  </article>`}var Kt=(a,n)=>n?`<button type="button" class="rs-tag is-in" data-action="shop-remove-item" data-id="${a.id}" title="${o(t("点一下移出购物车"))}" aria-label="${o(t("{name}：已加入购物车，点一下移出",{name:a.name}))}">✓ ${t("已加入")}</button>`:`<button type="button" class="rs-tag" data-action="shop-add-item" data-id="${a.id}" title="${o(t("点一下加入购物车"))}" aria-label="${o(t("{name}：未加入购物车，点一下加入",{name:a.name}))}">${t("未加入")}</button>`;function Yt(a,n=8){return a.length?`<ul class="restock-list rs-list">${a.slice(0,n).map(s=>{let e=!!I(s.id),l=e?`data-swipe-del="rs" data-swipe-alt="rs" data-swipe-alt-label="${o(t("移出购物车"))}" data-swipe-alt-go="${o(t("松手移出"))}"`:`data-swipe-del="rs" data-swipe-left-label="${o(t("加入购物车"))}" data-swipe-left-go="${o(t("松手加入"))}"`;return`<li class="rs-row ${e?"rs-in":""}" ${l} ${D([{label:t("编辑"),action:"edit",data:{id:s.id},first:!0},e?{label:t("移出购物车"),action:"shop-remove-item",data:{id:s.id}}:{label:t("加入购物车"),action:"shop-add-item",data:{id:s.id}}],s.name)}>
      <span class="badge ${C[s.status].cls}">${t(C[s.status].label)}</span>
      <div class="grow"><span class="rs-name"><button type="button" class="link-name" data-action="edit" data-id="${s.id}">${o(s.name)}</button>${Kt(s,e)}</span>
        <small>${t("剩 {q} {u}",{q:k(s.dqty),u:o(t(s.du))})}${s.daysLeft!=null&&s.qty>0?t("，约够 {d} 天",{d:Math.max(0,Math.floor(s.daysLeft))}):""}${e?"":t("，建议买 {q} {u}",{q:k(s.dsuggest),u:o(t(s.du))})}</small></div>
      ${e?`<button type="button" class="swipe-alt-src" data-action="shop-remove-item" data-id="${s.id}">${t("移出购物车")}</button>`:`<button type="button" class="swipe-src" data-action="shop-add-item" data-id="${s.id}">${t("加入购物车")}</button>`}
    </li>`}).join("")}</ul>`:""}var Zt=()=>`<p class="muted rs-hint"><span class="rs-hint-touch">${t("点「未加入」加入购物车，点「已加入」移出；也可 ← 左滑加入 · 右滑移出 →")}</span><span class="rs-hint-mouse">${t("点「未加入」加入购物车，点「已加入」移出")}</span></p>`;function N(a,n=""){let s=$.enriched.filter(j(a)).filter(e=>!n||wt(e,n,!0));return dt(a).map(e=>{let l=s.filter(p=>p.category===e.id);if(!l.length)return"";if(a==="gear"){let p=[...new Set(l.map(i=>i.location).filter(Boolean))];return`<button type="button" class="shelf-cell" style="--cat:${e.color}" data-action="goto-cat" data-space="${a}" data-cat="${e.id}">
        <span class="ico" aria-hidden="true">${e.icon}</span><h3>${t(e.name)}</h3>
        <p>${t("{n} 种",{n:l.length})}${p.length?t("，在{locs}{etc}",{locs:o(ct(p.slice(0,2).map(i=>t(i)))),etc:p.length>2?t("等"):""}):""}</p>
      </button>`}let r=p=>l.filter(i=>i.status===p).length,c=(p,i)=>r(p)?`<i style="width:${r(p)/l.length*100}%;background:${i}"></i>`:"",d=l.length-r("ok");return`<button type="button" class="shelf-cell" style="--cat:${e.color}" data-action="goto-cat" data-space="${a}" data-cat="${e.id}"${n?` data-owner="${o(n)}"`:""}>
      <span class="ico" aria-hidden="true">${e.icon}</span><h3>${t(e.name)}</h3>
      <p>${t("{n} 种",{n:l.length})}${d?t("，{n} 种需补",{n:d}):t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${c("out","var(--out)")}${c("low","var(--low)")}${c("soon","var(--mustard)")}${c("ok","var(--pine)")}</div>
    </button>`}).join("")}var It={pantry:"日常消耗品",house:"汽车房屋消耗品",gear:"家居耐用品"};function Qt(){let a=$.items.filter(s=>s.cat_check).sort((s,e)=>rt(s.name,e.name));if(!a.length)return"";let n=(s,e)=>{let l=q(s);return`${l.icon} ${o(t(l.name))}${e?` · ${o(t(e))}`:""}`};return`<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${a.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类细化时，这些物品是按名称猜着搬的。放对了点「没错」；放错了点「改回…」或「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${a.slice(0,30).map(s=>{let e=ht(s),l=r=>t(It[q(r).space]||"");return`<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${s.id}">${o(s.name)}</button>
          <small>${t("现在：")}${n(s.category,s.subcategory)}<span class="muted">（${l(s.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${s.id}">${t("没错")}</button>
          ${e?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${s.id}" data-cat="${e[0]}" data-sub="${o(e[1])}" title="${o(t(It[q(e[0]).space]||""))}">${s.cat_prev?t("改回"):t("改成")} ${n(e[0],e[1])}</button>`:""}
        </div></li>`}).join("")}</ul>${a.length>30?`<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示",{n:a.length-30})}</p>`:""}</div>
    </section>`}var Tt="hmh-pv-fold",Bt=()=>{try{return JSON.parse(localStorage.getItem(Tt)||"{}")}catch{return{}}};function Ya(a,n){let s=Bt();s[a]=n?1:0;try{localStorage.setItem(Tt,JSON.stringify(s))}catch{}}function Xt(a,n){if(a==="gear")return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="gear" data-cat="all"><span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3><p>${t("{n} 种",{n:n.length})}</p></button>`;let s=r=>n.filter(c=>c.status===r).length,e=n.length-s("ok"),l=(r,c)=>s(r)?`<i style="width:${s(r)/n.length*100}%;background:${c}"></i>`:"";return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="${a}" data-cat="all">
    <span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3>
    <p>${t("{n} 种",{n:n.length})}${e?t("，{n} 种需补",{n:e}):t("，都充足")}</p>
    <div class="mix" aria-hidden="true">${l("out","var(--out)")}${l("low","var(--low)")}${l("soon","var(--mustard)")}${l("ok","var(--pine)")}</div></button>`}function ot(a,n,s,e,l,r){let c=f=>e.filter(m=>m.status===f).length,d=e.filter(f=>f.exp).length,p=[["out",t("缺货"),c("out")],["low",t("少货"),c("low")],["soon",t("即将告罄"),c("soon")],...a==="pantry"?[["exp",t("临期或过期"),d]]:[]],i=p.reduce((f,m)=>f+m[2],0),h=Bt()[a]!==0,y=a==="gear"?t("{n} 种，长期用的东西，只记数量和位置",{n:e.length}):e.length?i?p.filter(f=>f[2]).map(f=>`${f[1]} ${f[2]}`).join(" · "):t("{n} 种，都充足",{n:e.length}):t("还没有物品");return`<details class="pv-card" data-fold="${a}" ${h?"open":""}>
    <summary><span class="pv-ico" aria-hidden="true">${n}</span><span class="pv-ttl"><b>${o(s)}</b><small class="${i?"pv-bad":""}">${o(y)}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
    <div class="pv-body">
      ${l?`<div class="shelf">${Xt(a,e)}${l}</div>`:r}
    </div></details>`}var et=a=>`<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${a.id}" aria-label="${o(t("{name} 过期了，扔掉剩下的",{name:a.name}))}">🗑 ${t("扔掉")}</button>`;function ta(){let a=$.shopping.filter(n=>n.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${S("shopping","list")}" aria-label="${o(t("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${t("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`}function Za(){let a=$.houseEnabled,n=$.enriched.filter(j("pantry")),s=a?$.enriched.filter(j("house")):[],e=[...n,...s],l=(i,h)=>i.filter(y=>y.status===h).length,r=gt(e),c=n.filter(i=>i.exp).sort((i,h)=>i.expDays-h.expDays),d=N("pantry"),p=a?N("house"):"";return`${Qt()}
    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${r.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${t("全部加入购物车")}</button>`:""}${ta()}</div></div>
      ${r.length?Zt():""}
      <div class="panel">${r.length?Yt(r):`<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
      ${r.length?bt({id:"restock",title:t("该补货了"),question:t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),context:()=>[t("要补：{s}",{s:r.slice(0,15).map(i=>i.name||i.item?.name).filter(Boolean).join("、")}),t("家庭人数 {n}",{n:$.members?.length||1})]}):""}
    </section>

    <section class="section" aria-labelledby="h-alert">
      <h2 id="h-alert" class="sr-only">${t("储藏概览")}</h2>
      <div class="pv-cards">
        ${ot("pantry","🥫",t("日常消耗品"),n,d,`<div class="empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${S("item","new")}?space=pantry">${t("添加第一件物品")}</a></div>`)}
        ${a?ot("house","🧰",t("汽车房屋消耗品"),s,p,`<div class="empty"><strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${S("house","template")}">${t("按房屋资料推荐")}</a></div>`):""}
        ${$.gearEnabled?ot("gear","🛋️",t("家居耐用品"),$.enriched.filter(j("gear")),N("gear"),`<div class="empty"><strong>${t("还没有家居耐用品")}</strong><a class="btn btn-primary" href="${S("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></div>`):""}
      </div>
    </section>

    ${c.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${c.slice(0,6).map(i=>`<li>
        <span class="badge b-exp">${i.exp==="expired"?t("已过期"):i.expDays===0?t("今天到期"):t("{d} 天后到期",{d:i.expDays})}</span>
        <div class="grow"><span class="name">${o(i.name)}</span><small>${o(t(i.location||""))} ${t("剩 {q} {u}",{q:k(i.dqty),u:o(t(i.du))})}</small></div>${i.exp==="expired"&&i.qty>0?et(i):""}</li>`).join("")}</ul></div>
    </section>`:""}

    ${E("pantry",t("添加物品"))}<div class="fab-spacer" aria-hidden="true"></div>
`}export{Yt as a,Zt as b,N as c,Ya as d,et as e,Za as f,Et as g,E as h,Ba as i,zt as j,Vt as k,Na as l,Fa as m,Wt as n};
