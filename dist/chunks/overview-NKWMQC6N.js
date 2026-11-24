import{a as q,b as j,d as B,f as D}from"./chunk-4Q52NEET.js";import{a as w}from"./chunk-IDNIVLFK.js";import"./chunk-AUWVMCPB.js";import"./chunk-7FBRRZL5.js";import"./chunk-IWS5M6XV.js";import"./chunk-U5B2REL2.js";import"./chunk-FPOPCEWA.js";import{b as k}from"./chunk-WNSV4D3P.js";import{c as x}from"./chunk-NORUUQG7.js";import"./chunk-YHVWWTQR.js";import"./chunk-TZBLDSUG.js";import{a as r,f as b}from"./chunk-NIZSID7P.js";import{I as u,k as s,t as i,u as f,v as y}from"./chunk-SRSA6JA7.js";document.addEventListener("toggle",a=>{let t=a.target;t?.matches?.("details[data-ask-q]")&&((r.ovAskOpen||={})[t.dataset.askQ]=t.open)},!0);var m=(a,t)=>`<span class="ui-badge" data-tone="${a}" data-size="sm">${i(t)}</span>`;function S(a,t,c,d){let n=r.enriched.filter(u(a)),l=h=>n.filter(g=>g.status===h).length,e=l("out"),o=l("low")+l("soon"),p=a==="pantry"?n.filter(h=>h.exp).length:0,$=a==="gear"?n.length?"":m("neutral",s("空")):n.length?e||o||p?[e&&m("danger",s("缺货 {n}",{n:e})),o&&m("warn",s("少货 {n}",{n:o})),p&&m("caution",s("临期 {n}",{n:p}))].filter(Boolean).join(""):m("ok",s("充足")):m("neutral",s("空")),v=a==="gear"?n.reduce((h,g)=>h+f(g.qty),0):n.length;return`<a class="ov-card ${e?"has-out":o||p?"has-low":""}" href="${i(d)}" aria-label="${i(`${c}，${s("共 {n} 件",{n:v})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${t}</span><span class="ov-total"><b>${v}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${i(c)}</span><span class="ov-tags">${$}</span></a>`}function C(){let a=w.filter(([,,,,c])=>c()).map(([c,d,n,l])=>S(c,d,s(n),l())),t=`<a class="ov-card ov-scan" href="${i(b("pantry","scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${s("录入购物")}</span><span class="ov-tags"><small class="muted">${s("拍小票或粘贴订单，一次入库")}</small></span></a>`;return`<div class="ov-grid">${a.join("")}${t}</div>`}function E(a,t,c){let d=(o,p=$=>$.name)=>o.slice(0,15).map(p).filter(Boolean).join("、"),n=[s("家庭人数 {n}",{n:r.members?.length||1})],l=t.length?[s("要补：{s}",{s:d(t,o=>o.name||o.item?.name)})]:[];return`<div class="ov-asks">${[["restock",s("要补的东西怎么安排采购最省钱？"),s("该补货了"),s("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),[...n,...l],t.length],["eat-first",s("快过期的怎么先吃完？"),s("先吃这些"),s("这些快到期的食材，怎么在过期前吃完或用掉？"),[...n,s("临期：{s}",{s:d(c)})],c.length],["often-out",s("总缺货的东西怎么办？"),s("经常缺货"),s("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"),[...n,...l,s("共 {n} 件物品",{n:a.length})],a.length],["overstock",s("有没有囤太多的？"),s("囤货检查"),s("按家里人数，哪些东西可能囤得太多、可以先不买？"),[...n,s("共 {n} 件物品",{n:a.length})],a.length],["home-supplies",s("滤网、电池这类多久换？"),s("汽车房屋消耗品"),s("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"),[...n,s("共 {n} 件汽车房屋消耗品",{n:r.enriched.filter(u("house")).length})],r.houseEnabled]].filter(o=>o[5]).map(([o,p,$,v,h])=>`<details class="ov-ask" data-ask-q="${o}"${r.ovAskOpen?.[o]?" open":""}><summary><span>${i(p)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${x({id:`pantry-ov-${o}`,title:$,question:v,context:h})}</div></details>`).join("")}</div>`}var O=()=>{let a=r.shopping.filter(t=>t.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${b("shopping","list")}" aria-label="${i(s("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${s("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`};function U(){let a=r.houseEnabled,t=r.enriched.filter(u("pantry")),c=a?r.enriched.filter(u("house")):[],d=[...t,...c],n=k(d),l=t.filter(e=>e.exp).sort((e,o)=>e.expDays-o.expDays);return`${B()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${s("储藏概览")}</h2>${C()}</section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${s("该补货了")}</h2>
        <div class="head-acts">${n.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${s("全部加入购物车")}</button>`:""}${O()}</div></div>
      ${n.length?j():""}
      <div class="panel">${n.length?q(n):`<div class="empty"><strong>${s("库存都很充足")}</strong>${s("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${l.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${s("先吃这些")}</h2><p>${s("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${l.slice(0,6).map(e=>`<li>
        <span class="badge b-exp">${e.exp==="expired"?s("已过期"):e.expDays===0?s("今天到期"):s("{d} 天后到期",{d:e.expDays})}</span>
        <div class="grow"><span class="name">${i(e.name)}</span><small>${i(s(e.location||""))} ${s("剩 {q} {u}",{q:y(e.dqty),u:i(s(e.du))})}</small></div>${e.exp==="expired"&&e.qty>0?D(e):""}</li>`).join("")}</ul></div>
    </section>`:""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${s("问咩咩")}</h2><p>${s("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${E(d,n,l)}
    </section>
`}export{U as viewDashboard};
