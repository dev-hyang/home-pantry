import{a as w,b as j,d as B,f as D}from"./chunk-AIMUOHNM.js";import{a as q}from"./chunk-SGRK7JTI.js";import"./chunk-DHI43QVT.js";import"./chunk-LJRZ5CKB.js";import"./chunk-JW25AF6V.js";import"./chunk-56PLQF5I.js";import"./chunk-3RUPEWUW.js";import{b as k}from"./chunk-7UDOVY43.js";import{c as x}from"./chunk-4ZY67OD5.js";import"./chunk-MHSLMDCJ.js";import"./chunk-TZBLDSUG.js";import{a as r,f as b}from"./chunk-DZDSB6EA.js";import{I as v,k as s,t as i,u as f,v as y}from"./chunk-FTWC6REB.js";document.addEventListener("toggle",a=>{let t=a.target;t?.matches?.("details[data-ask-q]")&&((r.ovAskOpen||={})[t.dataset.askQ]=t.open)},!0);var m=(a,t)=>`<span class="ui-badge" data-tone="${a}" data-size="sm">${i(t)}</span>`;function S(a,t,c,p){let n=r.enriched.filter(v(a)),l=h=>n.filter(g=>g.status===h).length,e=l("out"),o=l("low")+l("soon"),d=a==="pantry"?n.filter(h=>h.exp).length:0,$=a==="gear"?n.length?"":m("neutral",s("空")):n.length?e||o||d?[e&&m("danger",s("缺货 {n}",{n:e})),o&&m("warn",s("少货 {n}",{n:o})),d&&m("caution",s("临期 {n}",{n:d}))].filter(Boolean).join(""):m("ok",s("充足")):m("neutral",s("空")),u=a==="gear"?n.reduce((h,g)=>h+f(g.qty),0):n.length;return`<a class="ov-card ${e?"has-out":o||d?"has-low":""}" href="${i(p)}" aria-label="${i(`${c}，${s("共 {n} 件",{n:u})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${t}</span><span class="ov-total"><b>${u}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${i(c)}</span><span class="ov-tags">${$}</span></a>`}function C(){let a=q.filter(([,,,,c])=>c()).map(([c,p,n,l])=>S(c,p,s(n),l())),t=`<a class="ov-card ov-scan" href="${i(b("pantry","scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${s("录入购物")}</span><span class="ov-tags"><small class="muted">${s("拍小票或粘贴订单，一次入库")}</small></span></a>`;return`<div class="ov-grid">${a.join("")}${t}</div>`}function E(a,t,c){let p=(o,d=$=>$.name)=>o.slice(0,15).map(d).filter(Boolean).join("、"),n=[s("家庭人数 {n}",{n:r.members?.length||1})],l=t.length?[s("要补：{s}",{s:p(t,o=>o.name||o.item?.name)})]:[];return`<div class="ov-asks">${[["restock",s("要补的东西怎么安排采购最省钱？"),s("该补货了"),s("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),[...n,...l],t.length],["eat-first",s("快过期的怎么先吃完？"),s("先吃这些"),s("这些快到期的食材，怎么在过期前吃完或用掉？"),[...n,s("临期：{s}",{s:p(c)})],c.length],["often-out",s("总缺货的东西怎么办？"),s("经常缺货"),s("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"),[...n,...l,s("共 {n} 件物品",{n:a.length})],a.length],["overstock",s("有没有囤太多的？"),s("囤货检查"),s("按家里人数，哪些东西可能囤得太多、可以先不买？"),[...n,s("共 {n} 件物品",{n:a.length})],a.length],["home-supplies",s("滤网、电池这类多久换？"),s("汽车房屋消耗品"),s("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"),[...n,s("共 {n} 件汽车房屋消耗品",{n:r.enriched.filter(v("house")).length})],r.houseEnabled]].filter(o=>o[5]).map(([o,d,$,u,h])=>`<details class="ov-ask" data-ask-q="${o}"${r.ovAskOpen?.[o]?" open":""}><summary><span>${i(d)}</span><span class="pv-chev" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${x({id:`pantry-ov-${o}`,title:$,question:u,context:h})}</div></details>`).join("")}</div>`}var O=()=>{let a=r.shopping.filter(t=>t.status!=="bought").length;return`<a class="btn btn-sm cart-btn" href="${b("shopping","list")}" aria-label="${i(s("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${s("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`};function U(){let a=r.houseEnabled,t=r.enriched.filter(v("pantry")),c=a?r.enriched.filter(v("house")):[],p=[...t,...c],n=k(p),l=t.filter(e=>e.exp).sort((e,o)=>e.expDays-o.expDays);return`${B()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${s("储藏概览")}</h2>${C()}</section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${s("该补货了")}</h2>
        <div class="head-acts">${n.length?`<button type="button" class="btn btn-sm btn-add-all" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${s("全部加入购物车")}</button>`:""}${O()}</div></div>
      ${n.length?j():""}
      <div class="panel">${n.length?w(n):`<div class="empty"><strong>${s("库存都很充足")}</strong>${s("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${l.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${s("先吃这些")}</h2><p>${s("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${l.slice(0,6).map(e=>`<li>
        <span class="badge b-exp">${e.exp==="expired"?s("已过期"):e.expDays===0?s("今天到期"):s("{d} 天后到期",{d:e.expDays})}</span>
        <div class="grow"><span class="name">${i(e.name)}</span><small>${i(s(e.location||""))} ${s("剩 {q} {u}",{q:y(e.dqty),u:i(s(e.du))})}</small></div>${e.exp==="expired"&&e.qty>0?D(e):""}</li>`).join("")}</ul></div>
    </section>`:""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${s("问咩咩")}</h2><p>${s("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${E(p,n,l)}
    </section>
`}export{U as viewDashboard};
