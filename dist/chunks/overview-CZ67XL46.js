import{a as g,c as A,d as H,e as I,g as L,i as N}from"./chunk-AQS2EDWE.js";import{a as D,b as E,d as O,f as z}from"./chunk-S7LH3FF2.js";import{b as Q}from"./chunk-UUIT4JSX.js";import"./chunk-KBVGM2QK.js";import{a as B}from"./chunk-M56ELWJM.js";import{c as q}from"./chunk-CKH2EYYZ.js";import"./chunk-DIDQ5H5Y.js";import"./chunk-CFLU3LAW.js";import"./chunk-MZKEYF6Q.js";import"./chunk-M2REP3TG.js";import"./chunk-XXZYNAGJ.js";import"./chunk-GNZVLWWQ.js";import"./chunk-U7BPE6PK.js";import{b as C}from"./chunk-A6QJ5IER.js";import"./chunk-EE6UBRTX.js";import{a as S}from"./chunk-R7B6UZHA.js";import{c as j}from"./chunk-E4S3KOY3.js";import"./chunk-JKUWSCY7.js";import"./chunk-N5R53P5Q.js";import"./chunk-TZBLDSUG.js";import{d as $}from"./chunk-LM6XNZSS.js";import{a as d}from"./chunk-U5HZKQ5I.js";import{f as r,g as k,h as x,o as w,u as h}from"./chunk-3WVUBITM.js";import{k as s}from"./chunk-WHLDLVFW.js";var F={restock:{days:7,kind:"all",icon:"📥",name:"最近入库",how:"补货或新入库"},fresh:{days:30,kind:"new",icon:"🆕",name:"新物品",how:"第一次建进库存"}},R=()=>d.enriched.filter(a=>Q().some(n=>h(n)(a)));function T(a){let n=R().filter(l=>q(l,a.days,a.kind)).length,t=`${$("pantry","inventory")}?added=${a.days}&kind=${a.kind}`;return`<a class="ov-card" href="${r(t)}" aria-label="${r(`${s(a.name)}，${s("近 {d} 天",{d:a.days})}，${s("共 {n} 件",{n})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${a.icon}</span><span class="ov-total"><b>${n}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${r(s(a.name))}</span><span class="ov-tags"><small class="muted">${r(s("近 {d} 天",{d:a.days}))} · ${r(s(a.how))}</small></span></a>`}var M=()=>[F.restock,F.fresh].map(T).join("");function y(a,n,t,l,e){let i=`${$("pantry","buys")}?sort=${a}&range=90`;return`<a class="ov-card" href="${r(i)}" aria-label="${r(`${t}，${e||""} ${l}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${n}</span><span class="ov-total"><b>${r(l)}</b></span></span>
    <span class="ov-name">${r(t)}</span><span class="ov-tags"><small class="muted">${r(e||"")}</small></span></a>`}function U(a){let n=a?I(a):0,t=a&&n?H(a)[0]:null,l=t&&A(t);return y("deals","🏷️",s("特价命中"),a?s("{n} 样",{n}):"…",a?l?`${t.name} · ${L(l)}`:s("常买的东西现在没有特价"):s("正在读取…"))}function P(){let a=N(90),n=S(),t=!a.groups,l=t?null:g(a.groups,"count")[0],e=t||!n?null:g(a.groups,"spend")[0],i=o=>o?`${o.name} · ${s("近 {d} 天",{d:90})}`:t?s("正在读取…"):s("近 90 天还没有购买记录");return[y("count","🛍️",s("最常购买"),t?"…":l?s("{n} 次",{n:l.n}):"—",i(l)),n?y("spend","💸",s("花费最多"),t?"…":e?w(e.spend):"—",i(e)):"",U(a.groups)].join("")}document.addEventListener("toggle",a=>{let n=a.target;n?.matches?.("details[data-ask-q]")&&((d.ovAskOpen||={})[n.dataset.askQ]=n.open)},!0);var u=(a,n)=>`<span class="ui-badge" data-tone="${a}" data-size="sm">${r(n)}</span>`;function V(a,n,t,l){let e=d.enriched.filter(h(a)),i=m=>e.filter(b=>b.status===m).length,o=i("out"),c=i("low")+i("soon"),p=a==="pantry"?e.filter(m=>m.exp).length:0,v=a==="gear"?e.length?"":u("neutral",s("空")):e.length?o||c||p?[o&&u("danger",s("缺货 {n}",{n:o})),c&&u("warn",s("少货 {n}",{n:c})),p&&u("caution",s("临期 {n}",{n:p}))].filter(Boolean).join(""):u("ok",s("充足")):u("neutral",s("空")),f=a==="gear"?e.reduce((m,b)=>m+k(b.qty),0):e.length;return`<a class="ov-card ${o?"has-out":c||p?"has-low":""}" href="${r(l)}" aria-label="${r(`${t}，${s("共 {n} 件",{n:f})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${n}</span><span class="ov-total"><b>${f}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${r(t)}</span><span class="ov-tags">${v}</span></a>`}function _(){let a=B.filter(([,,,,t])=>t()).map(([t,l,e,i])=>V(t,l,s(e),i())),n=`<a class="ov-card ov-scan" href="${r($("pantry","scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${s("录入购物")}</span><span class="ov-tags"><small class="muted">${s("拍小票或粘贴订单，一次入库")}</small></span></a>`;return`<div class="ov-grid">${a.join("")}${n}</div>`}function G(a,n,t){let l=(c,p=v=>v.name)=>c.slice(0,15).map(p).filter(Boolean).join("、"),e=[s("家庭人数 {n}",{n:d.members?.length||1})],i=n.length?[s("要补：{s}",{s:l(n,c=>c.name||c.item?.name)})]:[];return`<div class="ov-asks">${[["restock",s("要补的东西怎么安排采购最省钱？"),s("该补货了"),s("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),[...e,...i],n.length],["eat-first",s("快过期的怎么先吃完？"),s("先吃这些"),s("这些快到期的食材，怎么在过期前吃完或用掉？"),[...e,s("临期：{s}",{s:l(t)})],t.length],["often-out",s("总缺货的东西怎么办？"),s("经常缺货"),s("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"),[...e,...i,s("共 {n} 件物品",{n:a.length})],a.length],["overstock",s("有没有囤太多的？"),s("囤货检查"),s("按家里人数，哪些东西可能囤得太多、可以先不买？"),[...e,s("共 {n} 件物品",{n:a.length})],a.length],["home-supplies",s("滤网、电池这类多久换？"),s("汽车房屋消耗品"),s("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"),[...e,s("共 {n} 件汽车房屋消耗品",{n:d.enriched.filter(h("house")).length})],d.houseEnabled]].filter(c=>c[5]).map(([c,p,v,f,m])=>`<details class="ov-ask" data-ask-q="${c}"${d.ovAskOpen?.[c]?" open":""}><summary><span>${r(p)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${j({id:`pantry-ov-${c}`,title:v,question:f,context:m})}</div></details>`).join("")}</div>`}var J=()=>{let a=d.shopping.filter(n=>n.status!=="bought").length;return`<a class="ui-btn cart-btn" data-size="sm" href="${$("shopping","list")}" aria-label="${r(s("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${s("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`};function ys(){let a=d.houseEnabled,n=d.enriched.filter(h("pantry")),t=a?d.enriched.filter(h("house")):[],l=[...n,...t],e=C(l),i=n.filter(o=>o.exp).sort((o,c)=>o.expDays-c.expDays);return`${O()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${s("储藏概览")}</h2>${_()}</section>

    <section class="section" aria-labelledby="h-recent">
      <div class="section-head"><h2 id="h-recent">${s("最近动态")}</h2><p>${s("点进去看清单，数字和清单对得上")}</p></div>
      <div class="ov-grid">${M()}</div>
    </section>

    <section class="section" aria-labelledby="h-buys">
      <div class="section-head"><h2 id="h-buys">${s("购买洞察")}</h2><p>${s("近 90 天，点进去看每一笔")}</p></div>
      <div class="ov-grid">${P()}</div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${s("该补货了")}</h2>
        <div class="head-acts">${e.length?`<button type="button" class="ui-btn" data-size="sm" data-tone="soft" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${s("全部加入购物车")}</button>`:""}${J()}</div></div>
      ${e.length?E():""}
      <div class="panel">${e.length?D(e):`<div class="empty"><strong>${s("库存都很充足")}</strong>${s("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${i.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${s("先吃这些")}</h2><p>${s("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${i.slice(0,6).map(o=>`<li>
        <span class="badge b-exp">${o.exp==="expired"?s("已过期"):o.expDays===0?s("今天到期"):s("{d} 天后到期",{d:o.expDays})}</span>
        <div class="grow"><span class="name">${r(o.name)}</span><small>${r(s(o.location||""))} ${s("剩 {q} {u}",{q:x(o.dqty),u:r(s(o.du))})}</small></div>${o.exp==="expired"&&o.qty>0?z(o):""}</li>`).join("")}</ul></div>
    </section>`:""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${s("问咩咩")}</h2><p>${s("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${G(l,e,i)}
    </section>
`}export{ys as viewDashboard};
