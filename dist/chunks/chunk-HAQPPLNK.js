import{e as h,g as y,i as S}from"./chunk-46ACOTMF.js";import{f as g,j as b,m as f}from"./chunk-U5B2REL2.js";import{a as p,f as $}from"./chunk-NIZSID7P.js";import{d as v,k as n,t as a}from"./chunk-SRSA6JA7.js";var k=(t,s)=>v==="en"?s:t,m=()=>window.GUIDES||{KINDS:[],GUIDES:{},REGION:{note:["",""]}},l=t=>Array.isArray(t)?k(t[0],t[1]):String(t??""),E=(t,s)=>`hmh-plan-chk-${t}-${s}`,I=(t,s)=>{try{return new Set(JSON.parse(localStorage.getItem(E(t,s))||"[]"))}catch{return new Set}};function A(t,s,e,i){let r=I(t,s);i?r.add(e):r.delete(e);try{localStorage.setItem(E(t,s),JSON.stringify([...r]))}catch{}}var G=()=>$("house","plan"),x=t=>`${$("house","plan")}?k=${t}`;function w(){let t=m();return t.KINDS.map(s=>{let e=t.GUIDES[s];return`<a class="hv-card hv-add" href="${a(x(s))}"><span class="hv-ico" aria-hidden="true">${e.icon}</span><span class="hv-txt"><b>${a(k("我想"+e.name[0],e.name[1]))}</b><small>${a(l(s.startsWith("buy")?["看指南、列清单、比一比","Guide, checklists, compare"]:["看指南，再从已有的开始卖出清单","Guide, then start the sell checklist"]))}</small></span></a>`}).join("")}function J(){let t=m(),s=p.route?.q?.get("k"),e=p.route?.q?.get("p");return e?S(e):s&&t.GUIDES[s]?H(s):`<section class="section menu-page house-landing">
    <div class="section-head"><h2>🧭 ${n("买卖计划")}</h2></div>
    <p class="muted">${n("还在想、还没买 / 卖：先看指南。指南不会创建房产或车辆；买到手以后，再在房屋首页「添加」。")}</p>
    <div class="hv-grid">${w()}</div>
    ${(p.plans||[]).length?`<div class="section-head"><h3>${n("我的计划")}</h3></div>${h()}`:""}
    <p class="muted plan-note">${a(l(t.REGION.note))}</p>
  </section>`}function j(t){if(t==="sell_home"){let e=f().filter(i=>(i.status||"owned")!=="renting");return`<section class="section"><div class="panel"><strong>${n("从哪套房产开始卖出清单？")}</strong>
      ${e.length?`<div class="hv-grid">${e.map(i=>`<button type="button" class="hv-card" data-action="plan-open-property" data-id="${i.id}"><span class="hv-ico" aria-hidden="true">🏠</span><span class="hv-txt"><b>${a(i.name)}</b>${i.address?`<small>${a(i.address)}</small>`:""}</span></button>`).join("")}</div>
      <p class="muted">${n("进入房屋后打开「交易」页，点「开始卖出」。")}</p>`:`<p class="muted">${n("你名下还没有房产。先在房屋首页添加。")}</p>`}</div></section>`}let s=b();return`<section class="section"><div class="panel"><strong>${n("从哪辆车开始卖车清单？")}</strong>
    ${s.length?`<div class="hv-grid">${s.map(e=>`<a class="hv-card" href="${a($("house","deal"))}?asset=${e.id}"><span class="hv-ico" aria-hidden="true">🚗</span><span class="hv-txt"><b>${a(g(e))}</b><small>${n("打开它的交易页")}</small></span></a>`).join("")}</div>`:`<p class="muted">${n("你名下还没有车辆。先在房屋首页添加。")}</p>`}</div></section>`}function N(t,s,e){let i=(c,o="tips")=>`<ul class="${o}">${c.map(d=>`<li>${a(l(d))}</li>`).join("")}</ul>`,r=(s.decisions||[]).map(c=>`<div class="plan-dec"><b>${a(l(c.q))}</b>
      <div class="plan-opts">${c.options.map(o=>`<div class="plan-opt"><b>${a(l(o.name))}</b><small>👍 ${a(l(o.pros))}</small><small>⚠️ ${a(l(o.cons))}</small></div>`).join("")}</div>
      ${c.ask?.length?`<p class="muted"><b>${n("可以这样问")}</b></p>${i(c.ask)}`:""}</div>`).join(""),u="";if(s.checklist){let c=I(t,s.id);u=`<fieldset class="plan-chk"><legend><b>${a(l(s.checklist.title))}</b> <small class="muted">${n("勾选只保存在这台设备上")}</small></legend>
      ${s.checklist.items.map((o,d)=>`<label class="plan-chk-row"><input type="checkbox" data-action="plan-check" data-kind="${t}" data-stage="${s.id}" data-idx="${d}" ${c.has(d)?"checked":""}><span>${a(l(o))}</span></label>`).join("")}</fieldset>`}return`<details class="panel plan-stage" ${e?"open":""}><summary><b>${a(l(s.title))}</b><span class="mch" aria-hidden="true">›</span></summary>
    <div class="plan-body"><p class="muted">${a(l(s.why))}</p>
    <p><b>${n("怎么做")}</b></p>${i(s.steps)}
    ${r}
    ${s.pitfalls?.length?`<p><b>${n("常见的坑")}</b></p>${i(s.pitfalls)}`:""}
    ${u}
    ${s.tip?`<p class="plan-tip">💡 ${a(l(s.tip))}</p>`:""}</div></details>`}function D(t){let s=p.planEdit?.type==="plan"&&!p.planEdit.id;return`<section class="section"><div class="section-head"><h3>${n("我的计划")}</h3><p>${n("把候选、对比和出价记在这里，全家一起看")}</p></div>
    ${h(t)}
    ${s?y(t):`<p><button type="button" class="btn btn-primary" data-action="plan-new" data-kind="${t}">＋ ${n("新建计划")}</button></p>`}</section>`}function H(t){let s=m().GUIDES[t];return`<section class="section menu-page plan-page">
    <p class="plan-back"><a class="link-name" href="${a(G())}">‹ ${n("买卖计划")}</a></p>
    <div class="section-head"><h2>${s.icon} ${a(l(s.name))}</h2></div>
    <p class="muted">${a(l(s.intro))}</p>
    <p class="muted plan-note">${a(l(m().REGION.note))} ${n("仅供参考，不是法律或财务建议。")}</p>
    ${t.startsWith("sell")?j(t):D(t)}
    ${s.stages.map((e,i)=>N(t,e,i===0)).join("")}
  </section>`}export{A as a,G as b,x as c,w as d,J as e};
