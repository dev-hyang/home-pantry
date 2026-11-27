import{a as j,b as C,d as S,f as B}from"./chunk-7MBGT3RA.js";import{b as D}from"./chunk-QCRV5WLZ.js";import{a as q}from"./chunk-3RZ55MIV.js";import{c as w}from"./chunk-5VTIAMUI.js";import"./chunk-EWAFSHDN.js";import"./chunk-4OWGH42J.js";import"./chunk-2ESCUXK7.js";import"./chunk-L5N4KBTL.js";import"./chunk-VRGDSI5B.js";import"./chunk-PDKHQIUC.js";import"./chunk-U7BPE6PK.js";import{b as k}from"./chunk-JZX5V3I5.js";import{c as x}from"./chunk-XHHQGSOE.js";import"./chunk-LLPU6SNV.js";import"./chunk-NT6EAL2B.js";import"./chunk-TZBLDSUG.js";import{a as i,f as u}from"./chunk-IJ5ZXLIN.js";import{I as m,k as s,t as l,u as b,v as y}from"./chunk-ZX3ZM2PC.js";var E={restock:{days:7,kind:"restock",icon:"📥",name:"最近入库",how:"补货入库"},fresh:{days:30,kind:"new",icon:"🆕",name:"新物品",how:"第一次建进库存"}},O=()=>i.enriched.filter(a=>D().some(n=>m(n)(a)));function Q(a){let n=O().filter(d=>w(d,a.days,a.kind)).length,r=`${u("pantry","inventory")}?added=${a.days}&kind=${a.kind}`;return`<a class="ov-card" href="${l(r)}" aria-label="${l(`${s(a.name)}，${s("近 {d} 天",{d:a.days})}，${s("共 {n} 件",{n})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${a.icon}</span><span class="ov-total"><b>${n}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${l(s(a.name))}</span><span class="ov-tags"><small class="muted">${l(s("近 {d} 天",{d:a.days}))} · ${l(s(a.how))}</small></span></a>`}var z=()=>[E.restock,E.fresh].map(Q).join("");document.addEventListener("toggle",a=>{let n=a.target;n?.matches?.("details[data-ask-q]")&&((i.ovAskOpen||={})[n.dataset.askQ]=n.open)},!0);var $=(a,n)=>`<span class="ui-badge" data-tone="${a}" data-size="sm">${l(n)}</span>`;function A(a,n,r,d){let e=i.enriched.filter(m(a)),c=h=>e.filter(g=>g.status===h).length,t=c("out"),o=c("low")+c("soon"),p=a==="pantry"?e.filter(h=>h.exp).length:0,v=a==="gear"?e.length?"":$("neutral",s("空")):e.length?t||o||p?[t&&$("danger",s("缺货 {n}",{n:t})),o&&$("warn",s("少货 {n}",{n:o})),p&&$("caution",s("临期 {n}",{n:p}))].filter(Boolean).join(""):$("ok",s("充足")):$("neutral",s("空")),f=a==="gear"?e.reduce((h,g)=>h+b(g.qty),0):e.length;return`<a class="ov-card ${t?"has-out":o||p?"has-low":""}" href="${l(d)}" aria-label="${l(`${r}，${s("共 {n} 件",{n:f})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${n}</span><span class="ov-total"><b>${f}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${l(r)}</span><span class="ov-tags">${v}</span></a>`}function H(){let a=q.filter(([,,,,r])=>r()).map(([r,d,e,c])=>A(r,d,s(e),c())),n=`<a class="ov-card ov-scan" href="${l(u("pantry","scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${s("录入购物")}</span><span class="ov-tags"><small class="muted">${s("拍小票或粘贴订单，一次入库")}</small></span></a>`;return`<div class="ov-grid">${a.join("")}${n}</div>`}function I(a,n,r){let d=(o,p=v=>v.name)=>o.slice(0,15).map(p).filter(Boolean).join("、"),e=[s("家庭人数 {n}",{n:i.members?.length||1})],c=n.length?[s("要补：{s}",{s:d(n,o=>o.name||o.item?.name)})]:[];return`<div class="ov-asks">${[["restock",s("要补的东西怎么安排采购最省钱？"),s("该补货了"),s("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),[...e,...c],n.length],["eat-first",s("快过期的怎么先吃完？"),s("先吃这些"),s("这些快到期的食材，怎么在过期前吃完或用掉？"),[...e,s("临期：{s}",{s:d(r)})],r.length],["often-out",s("总缺货的东西怎么办？"),s("经常缺货"),s("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"),[...e,...c,s("共 {n} 件物品",{n:a.length})],a.length],["overstock",s("有没有囤太多的？"),s("囤货检查"),s("按家里人数，哪些东西可能囤得太多、可以先不买？"),[...e,s("共 {n} 件物品",{n:a.length})],a.length],["home-supplies",s("滤网、电池这类多久换？"),s("汽车房屋消耗品"),s("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"),[...e,s("共 {n} 件汽车房屋消耗品",{n:i.enriched.filter(m("house")).length})],i.houseEnabled]].filter(o=>o[5]).map(([o,p,v,f,h])=>`<details class="ov-ask" data-ask-q="${o}"${i.ovAskOpen?.[o]?" open":""}><summary><span>${l(p)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${x({id:`pantry-ov-${o}`,title:v,question:f,context:h})}</div></details>`).join("")}</div>`}var L=()=>{let a=i.shopping.filter(n=>n.status!=="bought").length;return`<a class="ui-btn cart-btn" data-size="sm" href="${u("shopping","list")}" aria-label="${l(s("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${s("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`};function ss(){let a=i.houseEnabled,n=i.enriched.filter(m("pantry")),r=a?i.enriched.filter(m("house")):[],d=[...n,...r],e=k(d),c=n.filter(t=>t.exp).sort((t,o)=>t.expDays-o.expDays);return`${S()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${s("储藏概览")}</h2>${H()}</section>

    <section class="section" aria-labelledby="h-recent">
      <div class="section-head"><h2 id="h-recent">${s("最近动态")}</h2><p>${s("点进去看清单，数字和清单对得上")}</p></div>
      <div class="ov-grid">${z()}</div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${s("该补货了")}</h2>
        <div class="head-acts">${e.length?`<button type="button" class="ui-btn" data-size="sm" data-tone="soft" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${s("全部加入购物车")}</button>`:""}${L()}</div></div>
      ${e.length?C():""}
      <div class="panel">${e.length?j(e):`<div class="empty"><strong>${s("库存都很充足")}</strong>${s("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${c.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${s("先吃这些")}</h2><p>${s("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${c.slice(0,6).map(t=>`<li>
        <span class="badge b-exp">${t.exp==="expired"?s("已过期"):t.expDays===0?s("今天到期"):s("{d} 天后到期",{d:t.expDays})}</span>
        <div class="grow"><span class="name">${l(t.name)}</span><small>${l(s(t.location||""))} ${s("剩 {q} {u}",{q:y(t.dqty),u:l(s(t.du))})}</small></div>${t.exp==="expired"&&t.qty>0?B(t):""}</li>`).join("")}</ul></div>
    </section>`:""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${s("问咩咩")}</h2><p>${s("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${I(d,e,c)}
    </section>
`}export{ss as viewDashboard};
