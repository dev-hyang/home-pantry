import{a as St}from"./chunk-ZOXFL762.js";import{a as qt,b as Y,c as jt,d as Z,f as Q,h as X}from"./chunk-42AXHQP4.js";import{a as kt}from"./chunk-2NONGMU3.js";import{d as R,h as U}from"./chunk-25OM4N6I.js";import{a as z,c as J,d as P}from"./chunk-ODWCT35Q.js";import{g as wt,u as V}from"./chunk-F6SV7QAR.js";import{a as D}from"./chunk-CDMLPH5A.js";import{e as W,f as xt,h as K,i as _,j as B}from"./chunk-MEMT6UEX.js";import{t as T}from"./chunk-AZ7DTPWL.js";import{b as gt,d as ft,e as I}from"./chunk-TQQE5DWU.js";import{c as yt}from"./chunk-VNBVUBHR.js";import{Ja as vt,x as ht}from"./chunk-AAEMM72F.js";import{a as u,b as C,f as k}from"./chunk-GDQHM6TU.js";import{F as j,G as pt,H as ut,I as q,J as G,N as $t,V as mt,X as bt,k as t,m as rt,n as dt,s as F,t as o,u as M,v as S}from"./chunk-V3GMCPAN.js";var Mt=()=>window.matchMedia("(max-width: 640px)").matches||document.documentElement.classList.contains("force-phone"),at=a=>`${a.icon} ${t(a.name)}`;function Ct(a,n){let e=l=>`<option value="${o(l.id)}" ${l.id===n?"selected":""}>${l.icon} ${o(t(l.name))}</option>`,s=_(a);return s.length<2?s.flatMap(l=>l.cats).map(e).join(""):s.map(l=>`<optgroup label="${o(t(l.g.name))}">${l.cats.map(e).join("")}</optgroup>`).join("")}function _t(a,n){let e=_(a),s=l=>n(l.id,`${l.icon} ${t(l.name)}`);return e.length<2?e.flatMap(l=>l.cats).map(s).join(""):e.map(l=>`<span class="chip-grp" aria-hidden="true">${o(t(l.g.name))}</span>${l.cats.map(s).join("")}`).join("")}function tt(a){let n=a.filter(s=>s.status==="out").length,e=a.filter(s=>s.status==="low"||s.status==="soon"||s.exp).length;return{out:n,warn:e,kind:a.length?n?"out":e?"warn":"ok":"none"}}var Ft=(a,n)=>n.length?a.kind==="out"?`<span class="badge b-out"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 缺货",{n:a.out})}${a.warn?` · ${t("{n} 少货",{n:a.warn})}`:""}</span>`:a.kind==="warn"?`<span class="badge b-low"><i class="b-ic" data-g="!" aria-hidden="true"></i>${t("{n} 少货 / 临期",{n:a.warn})}</span>`:`<span class="badge b-ok"><i class="b-ic" data-g="✓" aria-hidden="true"></i>${t("充足")}</span>`:`<span class="badge b-none">${t("空")}</span>`,Dt=a=>!!a.q.trim()||a.status!=="all"||(a.loc||"all")!=="all";function nt(a,{all:n=!1}={}){let e=[...n?[["all","全部组别"]]:[],["pantry","日常消耗品"],...u.houseEnabled?[["house","汽车房屋消耗品"]]:[],...u.gearEnabled?[["gear","家居耐用品"]]:[]];return e.filter(([s])=>s!=="all").length<2?"":`<select id="invSpaceSel" aria-label="${t("库存范围")}">${e.map(([s,l])=>`<option value="${s}" ${a===s?"selected":""}>${t(l)}</option>`).join("")}</select>`}function st(a,n){let e=new Set(a.map(d=>d.location).filter(Boolean));if(!e.size)return"";let s=wt().map(d=>({...d,locs:d.locs.filter(p=>e.has(p.name))})).filter(d=>d.locs.length),l=new Set(s.flatMap(d=>d.locs.map(p=>p.name))),r=[...e].filter(d=>!l.has(d)),i=d=>`<option value="${o(d)}" ${n.loc===d?"selected":""}>${o(t(d))}</option>`;return`<select id="invLoc" aria-label="${t("按位置筛选")}"><option value="all">${t("全部位置")}</option>
    ${s.map(d=>`<optgroup label="${o(t(d.name))}">${d.locs.map(p=>i(p.name)).join("")}</optgroup>`).join("")}
    ${r.length?`<optgroup label="${t("其他")}">${r.map(i).join("")}</optgroup>`:""}</select>`}function et(a,n){let e=u.filter,s=Dt(e),l=s?n.filter(b=>B(b,e,{withCat:!1})):n,r=!s&&!!u.catSort,i=T(a),d=a==="gear";if(s){let b=i.map(x=>{let g=l.filter(O=>O.category===x.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:tt(g),A=`<span class="tile-top"><span class="tile-ico" style="--cat:${x.color}" aria-hidden="true">${x.icon}</span><b class="tile-count">${g.length}</b></span>
        <span class="tile-name">${o(t(x.name))}</span>${g.length?`<span class="badge b-none">${o(g.slice(0,3).map(O=>O.name).join(" · "))}${g.length>3?" …":""}</span>`:`<span class="badge b-none">${t("无")}</span>`}`;return`<button type="button" class="tile st-${L.kind} ${g.length?"is-hit":"is-dim"}" data-action="cat" data-cat="${x.id}" ${g.length?"":"disabled"}>${A}</button>`}).join("");return`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件符合")}</span><small>${l.length?t("点格子进入分类，筛选条件会保留"):t("换个关键词或筛选试试")}</small></div>
        <button type="button" class="stat" data-action="inv-clear"><b>✕</b><span>${t("清除")}</span></button></div>
      <div class="cat-dash" id="catDash">${b}</div>`}let p=d?null:tt(l),c=d?0:l.filter(b=>b.exp).length,h=d?0:l.filter(b=>b.status==="low"||b.status==="soon").length,y=(b,x,g,L)=>`<button type="button" class="stat ${L}" data-action="goto-status" data-space="${a}" data-status="${g}" ${b?"":"disabled"}><b>${b}</b><span>${x}</span></button>`,f=d?`<div class="dash-sum"><div class="sum-main"><b>${l.length}</b><span>${t("件家居耐用品")}</span></div></div>`:`<div class="dash-sum">
        <div class="sum-main"><b>${l.length}</b><span>${t("件物品")}</span><small>${p.kind==="ok"?t("库存都充足"):t("{n} 件要补货",{n:p.out+h})}</small></div>
        <div class="sum-stats">${y(p.out,t("缺货"),"out","s-out")}${y(h,t("少货"),"low","s-warn")}${y(c,t("临期"),"exp","s-exp")}</div>
      </div>`,$=(b,x)=>{let g=l.filter(H=>H.category===b.id),L=d?{kind:g.length?"ok":"none",out:0,warn:0}:tt(g),A=d?g.reduce((H,Nt)=>H+M(Nt.qty),0):g.length,O=r?`<span class="tile-sort"><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="-1" ${x===0?"disabled":""} aria-label="${t("往前")}">‹</button><button type="button" data-action="cat-move" data-cat="${b.id}" data-dir="1" ${x===i.length-1?"disabled":""} aria-label="${t("往后")}">›</button></span>`:"",it=`<span class="tile-top"><span class="tile-ico" style="--cat:${b.color}" aria-hidden="true">${b.icon}</span><b class="tile-count">${A}</b></span>
      <span class="tile-name">${o(t(b.name))}</span>
      ${d?g.length?`<span class="badge b-none">${t("{n} 种",{n:g.length})}</span>`:`<span class="badge b-none">${t("空")}</span>`:Ft(L,g)}${O}`,ct=`tile st-${L.kind} ${g.length?"":"is-empty"}`;return r?`<div class="${ct} is-sorting">${it}</div>`:`<button type="button" class="${ct}" data-action="cat" data-cat="${b.id}">${it}</button>`},v=r?[]:_(a,i),m=r||v.length<2?i.map($).join(""):v.map(b=>`<h4 class="cat-grp-h">${o(at(b.g))}</h4>${b.cats.map(x=>$(x,i.indexOf(x))).join("")}`).join(""),w=r?"":`<button type="button" class="tile tile-add" data-action="cat-new" data-space="${a}"><span class="tile-top"><span class="tile-ico" style="--cat:#8a948f" aria-hidden="true">＋</span></span><span class="tile-name">${t("新分类")}</span><span class="badge b-none">${t("自定义")}</span></button>`;return`${f}<div class="cat-dash" id="catDash">${m}${w}</div>
    <p class="muted dash-foot"><button type="button" class="link-name" data-action="cat-sort">${r?t("完成排序"):t("调整顺序")}</button></p>`}function Et(){try{return localStorage.getItem(qt)==="cats"?"cats":"rows"}catch{return"rows"}}var Lt=a=>`<div class="view-bar">${kt([["rows","物品","☰"],["cats","分类","▦"]],a,{action:"inv-view",attr:"view"})}</div>`,At=a=>!!a.alert_mute_until&&String(a.alert_mute_until)>$t(),Ht=()=>u.filter.space==="house"&&u.houseEnabled?"house":u.filter.space==="gear"?"gear":"pantry",E=(a,n)=>String(a).includes("&cat=")?`<a class="fab" href="${k("item","new")}?space=${a}" aria-label="${o(n)}" title="${o(n)}"><span aria-hidden="true">＋</span></a>`:`<button type="button" class="fab" data-action="add-item-pick" aria-label="${o(n)}" title="${o(n)}"><span aria-hidden="true">＋</span></button>`;function Gt(a){let n=u.filter;n.space!==a&&Object.assign(n,{space:a,cat:"all"});let e=u.enriched.filter(l=>a==="all"?Y().some(r=>q(r)(l)):q(a)(l)),s=n.cat!=="all"?j(n.cat):null;return`<section class="section inv-rows-page">
      <div class="section-head"><h2>${t("库存")}</h2><div class="head-acts">
        ${Lt("rows")}</div></div>
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${t("搜索物品，例如：纸、蛋")}" value="${o(n.q)}" aria-label="${t("搜索物品")}">
        ${nt(a,{all:!0})}
        ${a==="gear"?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([l,r])=>`<option value="${l}" ${n.status===l?"selected":""}>${t(r)}</option>`).join("")}
        </select>`}
        ${st(e,n)}
        ${K(n)}
        <select id="invSort" aria-label="${t("排序")}">${Ot.map(([l,r])=>`<option value="${l}" ${(n.sort||"default")===l?"selected":""}>${t(r)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${s?`<div class="chips inv-catchip"><button type="button" class="chip" data-action="cat" data-cat="all" aria-pressed="true" aria-label="${o(t("清除分类：{c}",{c:t(s.name)}))}">${s.icon} ${o(t(s.name))} <span aria-hidden="true">✕</span></button></div>`:""}
      <div id="invRows" class="${u.invSel?"sel-mode":""}"></div>
      ${u.invSel?Rt():E(Ht(),t("添加物品"))}
    </section>`}function Rt(){let a=u.invSel.size?"":"disabled";return`<div class="inv-selbar" role="toolbar" aria-label="${o(t("多选操作"))}">
    <span class="inv-seln" aria-live="polite">${o(Q())}</span>
    <button type="button" class="btn btn-sm btn-ghost" data-action="inv-sel-all">${t("全选")}</button>
    <button type="button" class="btn btn-sm btn-primary" data-action="inv-select">${t("完成")}</button>
    <span class="spacer"></span>
    <button type="button" class="btn btn-sm" data-action="inv-sel-shop" ${a}>🛒 ${t("加入购物车")}</button>
    <button type="button" class="btn btn-sm" data-action="inv-sel-mute" ${a}>🔕 ${t("不提醒")}</button>
    <button type="button" class="btn btn-sm btn-danger-ghost" data-action="inv-sel-del" ${a}>🗑 ${t("删除")}</button>
  </div>`}function Ut(a){let n=u.filter,e=n.cat!=="all"?j(n.cat):null,s=(()=>{try{return JSON.parse(localStorage.getItem("hmh-pv-fold")||"{}")}catch{return{}}})(),l=(i,d,p)=>{if(e&&ut(e.id)!==i)return"";let c=u.enriched.filter(q(i)),h=c.filter(jt).sort(Z(n.sort)),y=i==="gear"?[]:X(i),f=R(`inv-${i}`,JSON.stringify(n)),$=h.slice(0,f),v=h.length?`<ul class="inv-list">${$.map(Vt).join("")}</ul>${U(`inv-${i}`,h.length,f)}`:`<div class="empty">${c.length?`<strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或筛选试试。")}`:i==="house"?`<strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:i==="gear"?`<strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}`:`<strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}`}</div>`;return`<details class="pv-card inv-sec" data-fold="${i}" id="invSec-${i}" ${s[i]!==0?"open":""}>
      <summary><span class="pv-ico" aria-hidden="true">${d}</span><span class="pv-ttl"><b>${o(p)}</b><small>${h.length===c.length?t("{n} 件",{n:c.length}):t("{a} / {b} 件符合",{a:h.length,b:c.length})}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
      <div class="pv-body">${y.length&&!u.invSel?`<div class="inv-sec-bar"><span class="muted">${t("{n} 件要补货",{n:y.length})}</span><button type="button" class="btn btn-sm" data-action="inv-sec-shop" data-space="${i}">🛒 ${t("全部加入购物车")}</button></div>`:""}${v}</div></details>`},r={pantry:["🥫",t("日常消耗品")],house:["🧰",t("汽车房屋消耗品")],gear:["🛋️",t("家居耐用品")]};a.innerHTML=`<div class="pv-cards">${Y().filter(i=>n.space==="all"||i===n.space).map(i=>l(i,...r[i])).join("")}</div>`}var Ba=a=>`<span class="badge ${C[a.status].cls}">${t(C[a.status].label)}</span>`,zt=()=>`<span class="rs-tag is-in is-static" title="${o(t("已加入购物车"))}" aria-label="${o(t("已加入购物车"))}" role="img">✓🛒</span>`,Jt=a=>At(a)||M(a.min_quantity)<=0&&M(a.lead_days)<=0;function Pt(a,n){if(G(a))return"";let e=Jt(a),s=Units.factor(a.unit),l=e?[]:[M(a.min_quantity)>0&&t("少货线 {q} {u}",{q:S(M(a.min_quantity)*s),u:o(t(a.du))}),M(a.lead_days)>0&&t("提前 {d} 天",{d:M(a.lead_days)})].filter(Boolean),r=e?`🔕 ${t("不提醒")}`:`🔔 ${l.join(" · ")}`,i=e?t("点一下设置提醒"):t("点一下修改提醒设置");return n?`<span class="rem-tag${e?" is-off":""}">${r}</span>`:`<button type="button" class="rem-tag${e?" is-off":""}" data-action="item-remind" data-id="${a.id}" title="${o(i)}" aria-label="${o(`${a.name}：${e?t("不提醒"):l.join("，")}，${i}`)}">${r}</button>`}function Vt(a){let n=C[a.status],e=j(a.category),s=I(a.id),l=[`${e.icon} ${o(t(a.subcategory||e.name))}`,W(a)&&`<span class="own-tag">${o(W(a))}</span>`,a.location&&`📍${o(t(a.location))}`,a.daysLeft!=null&&a.qty>0&&`${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}`].filter(Boolean).join(" · "),r=`${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:Pt(a,!!u.invSel)}${a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>`:""}${s?zt():""}`,i=Units.step(a.du),d=o(a.name),p=u.invSel,c=p?.has(a.id),h=p?`data-row-sel="${a.id}"`:`data-row-open="${o(k("item",a.id))}" data-swipe-del="item" data-swipe-alt="item" data-swipe-alt-label="${o(t("加入购物车"))}" data-swipe-alt-go="${o(t("松手加入"))}"`,y=p?"":D([{label:t("详情"),href:k("item",a.id),first:!0},{label:t("加入购物车"),action:"inv-shop",data:{id:a.id}},{label:t("多选"),action:"inv-sel-start",data:{id:a.id}},{label:t("删除"),action:"inv-del",data:{id:a.id},danger:!0}],a.name);return`<li class="inv-row st-${a.status}${c?" is-picked":""}" data-id="${a.id}" ${h} ${y}>
    <span class="inv-bar" aria-hidden="true"></span>
    ${p?`<input type="checkbox" class="inv-chk" data-sel-id="${a.id}" ${c?"checked":""} aria-label="${o(t("选择 {name}",{name:a.name}))}">`:""}
    <div class="inv-main"><div class="inv-name">${p?`<span class="inv-link">${d}</span>`:`<a href="${o(k("item",a.id))}" class="inv-link">${d}</a>`}${r}</div><div class="inv-meta">${l}</div></div>
    <div class="inv-qty" role="group" aria-label="${o(t("{name} 数量",{name:a.name}))}">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${o(t("{name} 用掉 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">−</button>
      <input type="number" inputmode="decimal" min="0" step="any" value="${S(a.dqty)}" data-inv-qty="${a.id}" data-keep="invq:${a.id}" aria-label="${o(t("{name} 数量",{name:a.name}))}">
      ${St(`data-inv-unit="${a.id}" aria-label="${o(t("{name} 单位",{name:a.name}))}"`,a.du,{cls:"inv-unit"})}
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${o(t("{name} 补充 {q} {u}",{name:a.name,q:i,u:t(a.du)}))}">+</button>
    </div>
    <button type="button" class="swipe-src" data-action="inv-del" data-id="${a.id}">${t("删除 {name}",{name:a.name})}</button>
    <button type="button" class="swipe-alt-src" data-action="inv-shop" data-id="${a.id}">${t("{name} 加入购物车",{name:a.name})}</button>
  </li>`}function Na(a="all"){if(Et()==="rows")return Gt(a);a==="all"&&(a="pantry"),u.filter.space!==a&&Object.assign(u.filter,{space:a,cat:"all",q:"",status:u.filter.status,loc:"all"});let n=u.filter,e=a==="house",s=a==="gear";s&&(n.status="all");let l=Mt(),r=l&&n.cat==="all",i=(m,w)=>`<button type="button" class="chip" data-action="cat" data-cat="${m}" aria-pressed="${n.cat===m}">${w}</button>`,d=s&&!l?N("gear"):"",p=u.enriched.filter(q(a)),c=n.cat!=="all"?j(n.cat):null,h=u.catForm&&u.catForm.space===a?u.catForm:null;(!c||!(c.subs||[]).includes(n.sub))&&(n.sub="all");let y=c?(c.subs||[]).map(m=>[m,p.filter(w=>w.category===c.id&&w.subcategory===m).length]).filter(([,m])=>m>0):[],f=y.length>1?`<div class="chips" role="group" aria-label="${t("按小类筛选")}">
        <button type="button" class="chip" data-action="inv-sub" data-sub="all" aria-pressed="${n.sub==="all"}">${t("全部小类")}</button>
        ${y.map(([m,w])=>`<button type="button" class="chip" data-action="inv-sub" data-sub="${o(m)}" aria-pressed="${n.sub===m}">${o(t(m))} <span class="muted">${w}</span></button>`).join("")}</div>`:"",$=y.length>1?`<select id="invSubSel" aria-label="${t("按小类筛选")}"><option value="all">${t("全部小类")}</option>${y.map(([m,w])=>`<option value="${o(m)}" ${n.sub===m?"selected":""}>${o(t(m))} (${w})</option>`).join("")}</select>`:"",v=l&&c?`<div class="inv-filters${$?"":" solo"}">
        <select id="invCatSel" data-search aria-label="${t("按分类筛选")}"><option value="all">${t("全部")}</option>${Ct(a,c.id)}</select>${$}</div>`:f;return`
    <section class="section">
      <div class="section-head"><h2>${t("库存")}</h2>
        <div class="head-acts">${e&&!l?`<a class="btn btn-sm btn-ghost" href="${k("house","template")}">${t("按房屋资料推荐")}</a>`:""}
        ${c&&!h?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-edit" data-cat="${c.id}">${t("编辑分类")}</button>`:""}
        ${Lt("cats")}</div></div>
      ${e&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("滤网、电池、融雪盐这类要消耗、要补货的房屋用品；设备页的“相关耗材”会指到这里。")}</p>`:""}
      ${s&&!l?`<p class="muted" style="margin:-4px 0 12px;font-size:13px">${t("床品、电器、自行车、千斤顶、工具这类耐用品：只记有几件、放在哪，不算消耗、不提醒补货。")}</p>`:""}
      ${d?`<div class="shelf" style="margin-bottom:14px">${d}</div>`:""}
      <div class="toolbar">
        <input type="search" id="invSearch" placeholder="${s?t("搜索，例如：被罩、千斤顶、自行车"):e?t("搜索，例如：滤网、电池"):t("搜索物品，例如：纸、蛋")}" value="${o(n.q)}" aria-label="${t("搜索物品")}">
        ${nt(a)}
        ${s?"":`<select id="invStatus" aria-label="${t("按提醒筛选")}">
          ${[["all","全部状态"],["alert","需要补货"],["out","缺货"],["low","少货"],["soon","即将告罄"],["exp","临期或过期"],["ok","充足"]].map(([m,w])=>`<option value="${m}" ${n.status===m?"selected":""}>${t(w)}</option>`).join("")}
        </select>`}
        ${st(p,n)}
        ${e?K(n):""}
        <select id="invSort" aria-label="${t("排序")}">${Ot.filter(([m])=>!(s&&m==="exp")).map(([m,w])=>`<option value="${m}" ${(n.sort||"default")===m?"selected":""}>${t(w)}</option>`).join("")}</select>
        ${P("inv",J(n,z.inv))}
      </div>
      ${l?"":`<div class="chips" role="group" aria-label="${t("按分类筛选")}">
        ${i("all",t("全部"))}${_t(a,i)}
        <button type="button" class="chip chip-add" data-action="cat-new" data-space="${a}">＋ ${t("新分类")}</button>
      </div>`}
      ${h?V(h):""}
      ${v}
      ${r&&!h?`<div id="dashWrap" data-space="${a}">${et(a,p)}</div>`:""}
      <div id="invList" ${r?"hidden":""}></div>
      ${E(`${a}${c?`&cat=${c.id}`:""}`,s?t("添加家居耐用品"):t("添加物品"))}
    </section>`}var Ot=[["default","按状态（缺货优先）"],["name","名称 A → Z"],["qty","数量：少 → 多"],["exp","保质期：近 → 远"],["updated","最近更新"]];function Fa(){let a=F("#invRows");if(a)return Ut(a);let n=u.filter,e=u.enriched.filter(q(n.space)),s=e.filter($=>B($,n)),l=F("#invList");if(!l)return;let r=F("#dashWrap");if(r){r.innerHTML=et(r.dataset.space,e),l.hidden=!0;return}if(!s.length){l.innerHTML=e.length?`<div class="panel empty"><strong>${t("没有符合条件的物品")}</strong>${t("换个关键词或分类试试。")}</div>`:n.space==="house"?`<div class="panel empty"><strong>${t("还没有汽车房屋消耗品")}</strong>${t("按你家的房型和设施，一次加好常用的滤网、电池、融雪盐等。")}<p><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></p></div>`:n.space==="gear"?`<div class="panel empty"><strong>${t("还没有家居耐用品")}</strong>${t("床单被罩、电热毯、旅行床、自行车、千斤顶、园艺工具……这些只需要记数量和位置的东西都放这里。")}<p><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></p></div>`:`<div class="panel empty"><strong>${t("库存还是空的")}</strong>${t("从最常用的几样开始，例如鸡蛋、大米、抽纸。")}</div>`;return}let i=R("inv",JSON.stringify(n)),d=i,p=new Map;for(let $ of s){let v=p.get($.category);v?v.push($):p.set($.category,[$])}let c=_(n.space),h=new Set(c.filter($=>$.cats.some(v=>p.has(v.id))).map($=>$.g.id)),y=h.size>1,f="";l.innerHTML=c.flatMap($=>$.cats.map(v=>[$.g,v])).map(([$,v])=>{let m=(p.get(v.id)||[]).sort(Z(n.sort));if(!m.length||d<=0)return"";let w=m.slice(0,d);d-=w.length;let b=y&&$.id!==f?`<h2 class="inv-grp-h">${o(at($))}</h2>`:"";f=$.id;let x=n.space==="gear"?0:m.filter(g=>g.status!=="ok"&&!I(g.id)).length;return`${b}<div class="cat-group" style="--cat:${v.color}"><div class="cat-group-h"><h3><span class="dot" aria-hidden="true"></span>${v.icon} ${t(v.name)}<span class="muted">（${m.length}）</span></h3>
      ${x?`<button type="button" class="btn btn-sm cat-shop" data-action="inv-cat-shop" data-cat="${v.id}" aria-label="${o(t("{c}：{n} 件要补货，全部加入购物车",{c:t(v.name),n:x}))}">🛒 ${t("全部加入购物车")} <b class="ui-badge" data-shape="count">${x}</b></button>`:""}</div>
      <div class="items">${w.map(Wt).join("")}</div></div>`}).join("")+U("inv",T(n.space).reduce(($,v)=>$+(p.get(v.id)?.length||0),0),i)}function Wt(a){let n=C[a.status],e=vt.mode==="cloud"?ft(a.updated_by):null,s=t(a.du),l=(a.updated_at||a.created_at)&&`<span title="${o(bt(a))}">${e?`${o(e)} `:""}${t("{d} 更新",{d:mt(a.updated_at||a.created_at)})}</span>`;if(G(a)){let p=[a.subcategory&&`<span>${o(t(a.subcategory))}</span>`,a.location&&`<span>📍${o(t(a.location))}</span>`,a.notes&&`<span class="note" title="${o(a.notes)}">${o(a.notes.length>40?`${a.notes.slice(0,40)}…`:a.notes)}</span>`,l].filter(Boolean).join("");return`<article class="item is-gear" aria-label="${o(`${a.name}，${S(a.dqty)} ${s}${a.location?t("，在{loc}",{loc:t(a.location)}):""}`)}">
      <span class="gear-ico" aria-hidden="true">${j(a.category).icon}</span>
      <div class="item-main">
        <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${o(a.name)}</button></div>
        <div class="item-meta">${p}</div>
        ${a.qty>0?`<div class="item-acts"><button type="button" class="link-name" data-action="gear-broke" data-id="${a.id}" aria-label="${o(a.name)} — ${o(t("损坏了，换新"))}">🔨 ${t("损坏了，换新")}</button></div>`:""}
      </div>
      <div class="qty"><output>${S(a.dqty)}<small>${o(s)}</small></output></div>
    </article>`}let r=[a.subcategory&&`<span>${o(t(a.subcategory))}</span>`,a.location&&`<span>📍${o(t(a.location))}</span>`,a.daysLeft!=null&&`<span>${t("约够 {d} 天",{d:Math.max(0,Math.floor(a.daysLeft))})}</span>`,a.rate&&`<span title="${a.rateSrc==="manual"?t("手动设置"):t("根据最近使用记录估算")}">${t("日均 {q} {u}",{q:S(a.drate),u:o(s)})}</span>`,l].filter(Boolean).join(""),i=a.exp?`<span class="badge b-exp">${a.exp==="expired"?t("已过期"):t("{d} 天内到期",{d:a.expDays})}</span>${a.exp==="expired"&&a.qty>0?ot(a):""}`:"",d=`${a.name}，${t("剩余 {q} {u}",{q:S(a.dqty),u:s})}，${t(n.label)}`;return`<article class="item st-${a.status}" aria-label="${o(d)}">
    <div class="jar st-${a.status}" role="img" aria-label="${t("存量约 {p}%",{p:Math.round(a.level*100)})}">
      <i style="height:${Math.max(a.qty>0?6:0,a.level*100)}%"></i>
      ${a.minMark!=null?`<span class="tick" style="bottom:${a.minMark*100}%"></span>`:""}
    </div>
    <div class="item-main">
      <div class="item-title"><button type="button" data-action="edit" data-id="${a.id}">${o(a.name)}</button>
        ${a.status!=="ok"?`<span class="badge ${n.cls}">${t(n.label)}</span>`:""}${a.muted?`<span class="badge b-muted" title="${t("已设为不提醒；编辑页里可以恢复")}">🔕 ${t("不提醒")}</span>`:""}${i}</div>
      <div class="item-meta">${r}</div>
    </div>
    <div class="qty">
      <button type="button" data-action="consume" data-id="${a.id}" aria-label="${o(t("{name} 用掉 {q} {u}",{name:a.name,q:Units.step(a.du),u:s}))}">−</button>
      <output>${S(a.dqty)}<small>${o(s)}</small></output>
      <button type="button" data-action="restock" data-id="${a.id}" aria-label="${o(t("{name} 补充 {q} {u}",{name:a.name,q:Units.step(a.du),u:s}))}">+</button>
    </div>
  </article>`}var Kt=(a,n)=>n?`<button type="button" class="rs-tag is-in" data-action="shop-remove-item" data-id="${a.id}" title="${o(t("点一下移出购物车"))}" aria-label="${o(t("{name}：已加入购物车，点一下移出",{name:a.name}))}">✓ ${t("已加入")}</button>`:`<button type="button" class="rs-tag" data-action="shop-add-item" data-id="${a.id}" title="${o(t("点一下加入购物车"))}" aria-label="${o(t("{name}：未加入购物车，点一下加入",{name:a.name}))}">${t("未加入")}</button>`;function Yt(a,n=8){return a.length?`<ul class="restock-list rs-list">${a.slice(0,n).map(e=>{let s=!!I(e.id),l=s?`data-swipe-del="rs" data-swipe-alt="rs" data-swipe-alt-label="${o(t("移出购物车"))}" data-swipe-alt-go="${o(t("松手移出"))}"`:`data-swipe-del="rs" data-swipe-left-label="${o(t("加入购物车"))}" data-swipe-left-go="${o(t("松手加入"))}"`;return`<li class="rs-row ${s?"rs-in":""}" ${l} ${D([{label:t("编辑"),action:"edit",data:{id:e.id},first:!0},s?{label:t("移出购物车"),action:"shop-remove-item",data:{id:e.id}}:{label:t("加入购物车"),action:"shop-add-item",data:{id:e.id}}],e.name)}>
      <span class="badge ${C[e.status].cls}">${t(C[e.status].label)}</span>
      <div class="grow"><span class="rs-name"><button type="button" class="link-name" data-action="edit" data-id="${e.id}">${o(e.name)}</button>${Kt(e,s)}</span>
        <small>${t("剩 {q} {u}",{q:S(e.dqty),u:o(t(e.du))})}${e.daysLeft!=null&&e.qty>0?t("，约够 {d} 天",{d:Math.max(0,Math.floor(e.daysLeft))}):""}${s?"":t("，建议买 {q} {u}",{q:S(e.dsuggest),u:o(t(e.du))})}</small></div>
      ${s?`<button type="button" class="swipe-alt-src" data-action="shop-remove-item" data-id="${e.id}">${t("移出购物车")}</button>`:`<button type="button" class="swipe-src" data-action="shop-add-item" data-id="${e.id}">${t("加入购物车")}</button>`}
    </li>`}).join("")}</ul>`:""}var Zt=()=>`<p class="muted rs-hint"><span class="rs-hint-touch">${t("点「未加入」加入购物车，点「已加入」移出；也可 ← 左滑加入 · 右滑移出 →")}</span><span class="rs-hint-mouse">${t("点「未加入」加入购物车，点「已加入」移出")}</span></p>`;function N(a,n=""){let e=u.enriched.filter(q(a)).filter(s=>!n||xt(s,n,!0));return pt(a).map(s=>{let l=e.filter(p=>p.category===s.id);if(!l.length)return"";if(a==="gear"){let p=[...new Set(l.map(c=>c.location).filter(Boolean))];return`<button type="button" class="shelf-cell" style="--cat:${s.color}" data-action="goto-cat" data-space="${a}" data-cat="${s.id}">
        <span class="ico" aria-hidden="true">${s.icon}</span><h3>${t(s.name)}</h3>
        <p>${t("{n} 种",{n:l.length})}${p.length?t("，在{locs}{etc}",{locs:o(rt(p.slice(0,2).map(c=>t(c)))),etc:p.length>2?t("等"):""}):""}</p>
      </button>`}let r=p=>l.filter(c=>c.status===p).length,i=(p,c)=>r(p)?`<i style="width:${r(p)/l.length*100}%;background:${c}"></i>`:"",d=l.length-r("ok");return`<button type="button" class="shelf-cell" style="--cat:${s.color}" data-action="goto-cat" data-space="${a}" data-cat="${s.id}"${n?` data-owner="${o(n)}"`:""}>
      <span class="ico" aria-hidden="true">${s.icon}</span><h3>${t(s.name)}</h3>
      <p>${t("{n} 种",{n:l.length})}${d?t("，{n} 种需补",{n:d}):t("，都充足")}</p>
      <div class="mix" aria-hidden="true">${i("out","var(--out)")}${i("low","var(--low)")}${i("soon","var(--mustard)")}${i("ok","var(--pine)")}</div>
    </button>`}).join("")}var It={pantry:"日常消耗品",house:"汽车房屋消耗品",gear:"家居耐用品"};function Qt(){let a=u.items.filter(e=>e.cat_check).sort((e,s)=>dt(e.name,s.name));if(!a.length)return"";let n=(e,s)=>{let l=j(e);return`${l.icon} ${o(t(l.name))}${s?` · ${o(t(s))}`:""}`};return`<section class="section" aria-labelledby="h-catcheck">
      <div class="section-head"><h2 id="h-catcheck">${t("请确认分类")} <span class="muted">${a.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" data-action="cat-check-all">${t("全部没错")}</button></div>
      <p class="muted cat-check-tip">${t("分类细化时，这些物品是按名称猜着搬的。放对了点「没错」；放错了点「改回…」或「改成…」，连着的花费也跟着换。")}</p>
      <div class="panel"><ul class="restock-list cat-check">${a.slice(0,30).map(e=>{let s=ht(e),l=r=>t(It[j(r).space]||"");return`<li>
        <div class="grow"><button type="button" class="link-name" data-action="edit" data-id="${e.id}">${o(e.name)}</button>
          <small>${t("现在：")}${n(e.category,e.subcategory)}<span class="muted">（${l(e.category)}）</span></small></div>
        <div class="cat-check-acts">
          <button type="button" class="btn btn-sm" data-action="cat-check-ok" data-id="${e.id}">${t("没错")}</button>
          ${s?`<button type="button" class="btn btn-sm btn-ghost" data-action="cat-check-alt" data-id="${e.id}" data-cat="${s[0]}" data-sub="${o(s[1])}" title="${o(t(It[j(s[0]).space]||""))}">${e.cat_prev?t("改回"):t("改成")} ${n(s[0],s[1])}</button>`:""}
        </div></li>`}).join("")}</ul>${a.length>30?`<p class="muted cat-check-more">${t("还有 {n} 件，确认完这些再显示",{n:a.length-30})}</p>`:""}</div>
    </section>`}var Tt="hmh-pv-fold",Bt=()=>{try{return JSON.parse(localStorage.getItem(Tt)||"{}")}catch{return{}}};function Ya(a,n){let e=Bt();e[a]=n?1:0;try{localStorage.setItem(Tt,JSON.stringify(e))}catch{}}function Xt(a,n){if(a==="gear")return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="gear" data-cat="all"><span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3><p>${t("{n} 种",{n:n.length})}</p></button>`;let e=r=>n.filter(i=>i.status===r).length,s=n.length-e("ok"),l=(r,i)=>e(r)?`<i style="width:${e(r)/n.length*100}%;background:${i}"></i>`:"";return`<button type="button" class="shelf-cell shelf-all" style="--cat:var(--pine)" data-action="goto-cat" data-space="${a}" data-cat="all">
    <span class="ico" aria-hidden="true">🗂️</span><h3>${t("全部分类")}</h3>
    <p>${t("{n} 种",{n:n.length})}${s?t("，{n} 种需补",{n:s}):t("，都充足")}</p>
    <div class="mix" aria-hidden="true">${l("out","var(--out)")}${l("low","var(--low)")}${l("soon","var(--mustard)")}${l("ok","var(--pine)")}</div></button>`}function lt(a,n,e,s,l,r){let i=f=>s.filter($=>$.status===f).length,d=s.filter(f=>f.exp).length,p=[["out",t("缺货"),i("out")],["low",t("少货"),i("low")],["soon",t("即将告罄"),i("soon")],...a==="pantry"?[["exp",t("临期或过期"),d]]:[]],c=p.reduce((f,$)=>f+$[2],0),h=Bt()[a]!==0,y=a==="gear"?t("{n} 种，长期用的东西，只记数量和位置",{n:s.length}):s.length?c?p.filter(f=>f[2]).map(f=>`${f[1]} ${f[2]}`).join(" · "):t("{n} 种，都充足",{n:s.length}):t("还没有物品");return`<details class="pv-card" data-fold="${a}" ${h?"open":""}>
    <summary><span class="pv-ico" aria-hidden="true">${n}</span><span class="pv-ttl"><b>${o(e)}</b><small class="${c?"pv-bad":""}">${o(y)}</small></span><span class="pv-chev" aria-hidden="true">▾</span></summary>
    <div class="pv-body">
      ${l?`<div class="shelf">${Xt(a,s)}${l}</div>`:r}
    </div></details>`}var ot=a=>`<button type="button" class="btn btn-sm btn-ghost discard-btn" data-action="discard" data-id="${a.id}" aria-label="${o(t("{name} 过期了，扔掉剩下的",{name:a.name}))}">🗑 ${t("扔掉")}</button>`;function ta(){let a=u.shopping.filter(n=>n.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${k("shopping","list")}" aria-label="${o(t("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${t("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`}function Za(){let a=u.houseEnabled,n=u.enriched.filter(q("pantry")),e=a?u.enriched.filter(q("house")):[],s=[...n,...e],l=(c,h)=>c.filter(y=>y.status===h).length,r=gt(s),i=n.filter(c=>c.exp).sort((c,h)=>c.expDays-h.expDays),d=N("pantry"),p=a?N("house"):"";return`${Qt()}
    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${t("该补货了")}</h2>
        <div class="head-acts">${r.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${t("全部加入购物车")}</button>`:""}${ta()}</div></div>
      ${r.length?Zt():""}
      <div class="panel">${r.length?Yt(r):`<div class="empty"><strong>${t("库存都很充足")}</strong>${t("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
      ${r.length?yt({id:"restock",title:t("该补货了"),question:t("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),context:()=>[t("要补：{s}",{s:r.slice(0,15).map(c=>c.name||c.item?.name).filter(Boolean).join("、")}),t("家庭人数 {n}",{n:u.members?.length||1})]}):""}
    </section>

    <section class="section" aria-labelledby="h-alert">
      <h2 id="h-alert" class="sr-only">${t("储藏概览")}</h2>
      <div class="pv-cards">
        ${lt("pantry","🥫",t("日常消耗品"),n,d,`<div class="empty"><strong>${t("还没有物品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=pantry">${t("添加第一件物品")}</a></div>`)}
        ${a?lt("house","🧰",t("汽车房屋消耗品"),e,p,`<div class="empty"><strong>${t("还没有汽车房屋消耗品")}</strong><a class="btn btn-primary" href="${k("house","template")}">${t("按房屋资料推荐")}</a></div>`):""}
        ${u.gearEnabled?lt("gear","🛋️",t("家居耐用品"),u.enriched.filter(q("gear")),N("gear"),`<div class="empty"><strong>${t("还没有家居耐用品")}</strong><a class="btn btn-primary" href="${k("item","new")}?space=gear">${t("添加第一件家居耐用品")}</a></div>`):""}
      </div>
    </section>

    ${i.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${t("先吃这些")}</h2><p>${t("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${i.slice(0,6).map(c=>`<li>
        <span class="badge b-exp">${c.exp==="expired"?t("已过期"):c.expDays===0?t("今天到期"):t("{d} 天后到期",{d:c.expDays})}</span>
        <div class="grow"><span class="name">${o(c.name)}</span><small>${o(t(c.location||""))} ${t("剩 {q} {u}",{q:S(c.dqty),u:o(t(c.du))})}</small></div>${c.exp==="expired"&&c.qty>0?ot(c):""}</li>`).join("")}</ul></div>
    </section>`:""}

    ${E("pantry",t("添加物品"))}<div class="fab-spacer" aria-hidden="true"></div>
`}export{Yt as a,Zt as b,N as c,Ya as d,ot as e,Za as f,Et as g,E as h,Ba as i,zt as j,Vt as k,Na as l,Fa as m,Wt as n};
