import{a as g,c as Q}from"./chunk-7BC3GCG4.js";import{a as S,b as D,d as E,f as O}from"./chunk-LTDE55Z2.js";import{b as z}from"./chunk-7HW5RXZY.js";import{a as B}from"./chunk-AXEOVYAK.js";import{c as q}from"./chunk-ODSL4VWT.js";import"./chunk-ZVTK4QOD.js";import"./chunk-7OG34CX2.js";import"./chunk-VK6PE6KB.js";import"./chunk-ITC5WZ52.js";import"./chunk-2R4WKNO7.js";import"./chunk-PL6DHJUT.js";import"./chunk-U7BPE6PK.js";import{b as w}from"./chunk-7IWMPAJA.js";import{a as C}from"./chunk-QOZBXYGX.js";import{c as j}from"./chunk-EC5IDWWV.js";import"./chunk-J56PQEHL.js";import"./chunk-XL4L5W65.js";import"./chunk-TZBLDSUG.js";import{a as d,f as $}from"./chunk-VOLP3UXO.js";import{C as x,I as h,k as s,t as o,u as y,v as k}from"./chunk-E7PPBQL6.js";var A={restock:{days:7,kind:"restock",icon:"📥",name:"最近入库",how:"补货入库"},fresh:{days:30,kind:"new",icon:"🆕",name:"新物品",how:"第一次建进库存"}},N=()=>d.enriched.filter(a=>z().some(n=>h(n)(a)));function F(a){let n=N().filter(l=>q(l,a.days,a.kind)).length,r=`${$("pantry","inventory")}?added=${a.days}&kind=${a.kind}`;return`<a class="ov-card" href="${o(r)}" aria-label="${o(`${s(a.name)}，${s("近 {d} 天",{d:a.days})}，${s("共 {n} 件",{n})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${a.icon}</span><span class="ov-total"><b>${n}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${o(s(a.name))}</span><span class="ov-tags"><small class="muted">${o(s("近 {d} 天",{d:a.days}))} · ${o(s(a.how))}</small></span></a>`}var H=()=>[A.restock,A.fresh].map(F).join("");function I(a,n,r,l,e){let i=`${$("pantry","buys")}?sort=${a}&range=90`;return`<a class="ov-card" href="${o(i)}" aria-label="${o(`${r}，${e||""} ${l}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${n}</span><span class="ov-total"><b>${o(l)}</b></span></span>
    <span class="ov-name">${o(r)}</span><span class="ov-tags"><small class="muted">${o(e||"")}</small></span></a>`}function L(){let a=Q(90),n=C(),r=!a.groups,l=r?null:g(a.groups,"count")[0],e=r||!n?null:g(a.groups,"spend")[0],i=t=>t?`${t.name} · ${s("近 {d} 天",{d:90})}`:r?s("正在读取…"):s("近 90 天还没有购买记录");return[I("count","🛍️",s("最常购买"),r?"…":l?s("{n} 次",{n:l.n}):"—",i(l)),n?I("spend","💸",s("花费最多"),r?"…":e?x(e.spend):"—",i(e)):""].join("")}document.addEventListener("toggle",a=>{let n=a.target;n?.matches?.("details[data-ask-q]")&&((d.ovAskOpen||={})[n.dataset.askQ]=n.open)},!0);var u=(a,n)=>`<span class="ui-badge" data-tone="${a}" data-size="sm">${o(n)}</span>`;function M(a,n,r,l){let e=d.enriched.filter(h(a)),i=m=>e.filter(b=>b.status===m).length,t=i("out"),c=i("low")+i("soon"),p=a==="pantry"?e.filter(m=>m.exp).length:0,v=a==="gear"?e.length?"":u("neutral",s("空")):e.length?t||c||p?[t&&u("danger",s("缺货 {n}",{n:t})),c&&u("warn",s("少货 {n}",{n:c})),p&&u("caution",s("临期 {n}",{n:p}))].filter(Boolean).join(""):u("ok",s("充足")):u("neutral",s("空")),f=a==="gear"?e.reduce((m,b)=>m+y(b.qty),0):e.length;return`<a class="ov-card ${t?"has-out":c||p?"has-low":""}" href="${o(l)}" aria-label="${o(`${r}，${s("共 {n} 件",{n:f})}`)}">
    <span class="ov-top"><span class="ov-ico" aria-hidden="true">${n}</span><span class="ov-total"><b>${f}</b><small>${s("件")}</small></span></span>
    <span class="ov-name">${o(r)}</span><span class="ov-tags">${v}</span></a>`}function P(){let a=B.filter(([,,,,r])=>r()).map(([r,l,e,i])=>M(r,l,s(e),i())),n=`<a class="ov-card ov-scan" href="${o($("pantry","scan"))}"><span class="ov-top"><span class="ov-ico" aria-hidden="true">🧾</span></span>
    <span class="ov-name">${s("录入购物")}</span><span class="ov-tags"><small class="muted">${s("拍小票或粘贴订单，一次入库")}</small></span></a>`;return`<div class="ov-grid">${a.join("")}${n}</div>`}function R(a,n,r){let l=(c,p=v=>v.name)=>c.slice(0,15).map(p).filter(Boolean).join("、"),e=[s("家庭人数 {n}",{n:d.members?.length||1})],i=n.length?[s("要补：{s}",{s:l(n,c=>c.name||c.item?.name)})]:[];return`<div class="ov-asks">${[["restock",s("要补的东西怎么安排采购最省钱？"),s("该补货了"),s("这些要补的东西怎么安排采购最省钱省时间？哪些可以等？"),[...e,...i],n.length],["eat-first",s("快过期的怎么先吃完？"),s("先吃这些"),s("这些快到期的食材，怎么在过期前吃完或用掉？"),[...e,s("临期：{s}",{s:l(r)})],r.length],["often-out",s("总缺货的东西怎么办？"),s("经常缺货"),s("哪些东西总是缺货？应该怎么调整少货线、一次买多少才不会反复断货？"),[...e,...i,s("共 {n} 件物品",{n:a.length})],a.length],["overstock",s("有没有囤太多的？"),s("囤货检查"),s("按家里人数，哪些东西可能囤得太多、可以先不买？"),[...e,s("共 {n} 件物品",{n:a.length})],a.length],["home-supplies",s("滤网、电池这类多久换？"),s("汽车房屋消耗品"),s("滤网、电池、融雪盐这类汽车房屋消耗品，一般多久换一次，家里该备多少？"),[...e,s("共 {n} 件汽车房屋消耗品",{n:d.enriched.filter(h("house")).length})],d.houseEnabled]].filter(c=>c[5]).map(([c,p,v,f,m])=>`<details class="ov-ask" data-ask-q="${c}"${d.ovAskOpen?.[c]?" open":""}><summary><span>${o(p)}</span><span class="ui-chev" data-dir="down" aria-hidden="true">▾</span></summary>
    <div class="ov-ask-body">${j({id:`pantry-ov-${c}`,title:v,question:f,context:m})}</div></details>`).join("")}</div>`}var T=()=>{let a=d.shopping.filter(n=>n.status!=="bought").length;return`<a class="ui-btn cart-btn" data-size="sm" href="${$("shopping","list")}" aria-label="${o(s("购物车，{n} 项",{n:a}))}"><span aria-hidden="true">🛒</span> ${s("购物车")}${a?` <b class="num">${a}</b>`:""}</a>`};function $s(){let a=d.houseEnabled,n=d.enriched.filter(h("pantry")),r=a?d.enriched.filter(h("house")):[],l=[...n,...r],e=w(l),i=n.filter(t=>t.exp).sort((t,c)=>t.expDays-c.expDays);return`${E()}
    <section class="section" aria-labelledby="h-ov"><h2 id="h-ov" class="sr-only">${s("储藏概览")}</h2>${P()}</section>

    <section class="section" aria-labelledby="h-recent">
      <div class="section-head"><h2 id="h-recent">${s("最近动态")}</h2><p>${s("点进去看清单，数字和清单对得上")}</p></div>
      <div class="ov-grid">${H()}</div>
    </section>

    <section class="section" aria-labelledby="h-buys">
      <div class="section-head"><h2 id="h-buys">${s("购买洞察")}</h2><p>${s("近 90 天，点进去看每一笔")}</p></div>
      <div class="ov-grid">${L()}</div>
    </section>

    <section class="section" aria-labelledby="h-restock">
      <div class="section-head"><h2 id="h-restock">${s("该补货了")}</h2>
        <div class="head-acts">${e.length?`<button type="button" class="ui-btn" data-size="sm" data-tone="soft" data-action="shop-add-alerts" data-space="${a?"all":"pantry"}">＋ ${s("全部加入购物车")}</button>`:""}${T()}</div></div>
      ${e.length?D():""}
      <div class="panel">${e.length?S(e):`<div class="empty"><strong>${s("库存都很充足")}</strong>${s("用掉东西时在“库存”里点一下 −，提醒会更准。")}</div>`}</div>
    </section>

    ${i.length?`<section class="section" aria-labelledby="h-exp">
      <div class="section-head"><h2 id="h-exp">${s("先吃这些")}</h2><p>${s("菜单推荐会优先用到它们")}</p></div>
      <div class="panel"><ul class="restock-list">${i.slice(0,6).map(t=>`<li>
        <span class="badge b-exp">${t.exp==="expired"?s("已过期"):t.expDays===0?s("今天到期"):s("{d} 天后到期",{d:t.expDays})}</span>
        <div class="grow"><span class="name">${o(t.name)}</span><small>${o(s(t.location||""))} ${s("剩 {q} {u}",{q:k(t.dqty),u:o(s(t.du))})}</small></div>${t.exp==="expired"&&t.qty>0?O(t):""}</li>`).join("")}</ul></div>
    </section>`:""}

    <section class="section" aria-labelledby="h-ovask">
      <div class="section-head"><h2 id="h-ovask">${s("问咩咩")}</h2><p>${s("点一个问题展开，再点「问咩咩」得到回答")}</p></div>
      ${R(l,e,i)}
    </section>
`}export{$s as viewDashboard};
