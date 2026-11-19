import{a as v,b as S,e as j}from"./chunk-WK4QF4YM.js";import{Ja as _}from"./chunk-3J22DRZR.js";import{a as u,f as h,i as B}from"./chunk-UVTSSMY7.js";import{$ as E,O as I,V as y,d as w,k as s,t as n,u as m}from"./chunk-TXLJSMAI.js";var b=(e,a)=>Units.money(m(e),a||Units.region.currency),q=[["installment","分期"],["payoff","一次性结清"]],L=e=>s((q.find(([a])=>a===e)||q[0])[1]);function K(e,a){let d=u.route?.q?.get("focus")||null,o=h("bill",e.id),r=S(e.id,u.assess,u.assessItems),l=e.currency,p=t=>{let f=e.pays.find(i=>i.id===t);return f?y(f.paid_on):""},$=t=>`<li><span class="badge ${v(t)?"b-ok":""}">${v(t)?s("已缴"):s("待缴")}</span>
        <div class="grow">${n(y(t.due_on))}<small>${[L(t.kind),t.payment_id?s("{d} 缴",{d:p(t.payment_id)||"—"}):t.settled_on?s("已缴（无缴费记录）"):null].filter(Boolean).map(n).join(" · ")}</small></div><b>${b(t.amount,l)}</b></li>`,g=r.map((t,f)=>{let i=t.rows.filter(k=>!v(k)),c=t.rows.filter(v),C=c.reduce((k,D)=>k+m(D.amount),0);return`<details class="panel prof-card as-card" id="as-${n(t.id)}" ${d?t.id===d?"open data-as-focus":"":f===0||!t.done?"open":""}>
      <summary class="prof-head"><span class="mi" aria-hidden="true">📣</span>
        <div class="prof-t"><h3>${n(t.name)}</h3><small>${t.done?`<span class="badge b-ok">${s("已缴清")}</span> `:t.status==="closed"?`<span class="badge">${s("已关闭")}</span> `:""}${s("共 {total} · 已缴 {paid} · 剩余 {left}",{total:b(t.total,l),paid:b(t.paid,l),left:b(t.remaining,l)})}</small>
          ${t.notes?`<small class="as-desc">${n(t.notes)}</small>`:""}</div>
        <a class="btn btn-sm btn-ghost prof-edit" href="${o}?sec=assess&edit=${t.id}">${s("编辑")}</a><span class="mch" aria-hidden="true">›</span></summary>
      ${i.length?`<ul class="restock-list as-items">${i.map($).join("")}</ul>`:`<p class="muted as-none">${s("没有待缴的期了")}</p>`}
      ${c.length?`<details class="as-paid"><summary>${s("已缴 {n} 期 · {m}",{n:c.length,m:b(C,l)})}<span class="mch" aria-hidden="true">›</span></summary><ul class="restock-list as-items">${c.map($).join("")}</ul></details>`:""}
    </details>`}).join("");return`<section class="section">${a}
    <div class="section-head"><h2>${s("特别摊派")}</h2><p>${n(e.name)}</p></div>
    ${g?`<div class="prof-grid bill-detail-grid one-col as-list">${g}</div>`:`<div class="panel empty"><strong>${s("还没有特别摊派")}</strong>${s("HOA 临时收的大额费用（屋顶、电梯、停车场…）可以记在这里：分期、一次性结清，或前几期分期、最后一次结清。")}</div>`}
    <a class="fab" href="${o}?sec=assess&edit=new" aria-label="${n(s("新增摊派"))}" title="${n(s("新增摊派"))}">＋</a>
  </section>`}var H=(e={},a=!1)=>a?`<li class="as-row is-paid" data-id="${n(e.id||"")}">   <!-- 已关联缴费：锁定，只读显示；隐藏域让保存时仍能读到这一期 -->
    <input type="hidden" name="as_due" value="${n(e.due_on||"")}"><input type="hidden" name="as_amt" value="${m(e.amount).toFixed(2)}"><input type="hidden" name="as_kind" value="${n(e.kind||"installment")}">
    <div class="as-line"><b class="as-date">${n(y(e.due_on))}</b><span class="as-kindtxt">${n(L(e.kind))}</span><b class="as-money">${b(e.amount)}</b><span class="badge b-ok">${s("已缴")}</span></div></li>`:`<li class="as-row" data-id="${n(e.id||"")}">
    <div class="as-line"><select name="as_kind" aria-label="${n(s("类型"))}">${q.map(([d,o])=>`<option value="${d}" ${e.kind===d?"selected":""}>${n(s(o))}</option>`).join("")}</select>
      <button type="button" class="btn btn-ghost as-del" data-as-del aria-label="${n(s("删除这一期"))}" title="${n(s("删除这一期"))}">✕</button></div>
    <div class="as-fields">
      <label>${w==="en"?"Due date":"到期日"}<input type="date" name="as_due" required value="${n(e.due_on||"")}"></label>
      <label>${w==="en"?"Amount":"金额"}<input type="number" name="as_amt" inputmode="decimal" min="0.01" step="0.01" required value="${e.amount!=null?m(e.amount).toFixed(2):""}"></label></div>
    <label class="as-settled"><input type="checkbox" name="as_settled" ${e.settled_on?"checked":""}><span>${s("已缴（无缴费记录）")}</span></label></li>`;function G(e,a,d){let o=h("bill",e.id),r=a?S(e.id,u.assess,u.assessItems).find(l=>l.id===a.id)?.rows||[]:[];return`<section class="section form-page">${d}
    <div class="section-head"><h2>${a?s("编辑摊派"):s("新增摊派")}</h2><p>${n(e.name)}</p></div>
    <form id="assessForm" class="panel" novalidate data-bill="${n(e.id)}" data-id="${n(a?.id||"")}">
      <div class="form-grid">
        <label class="span-2">${s("名称")}<input name="name" required maxlength="80" placeholder="${n(s("例如：2026 屋顶更换"))}" value="${n(a?.name||"")}"></label>
        <label>${s("状态")}<select name="status"><option value="active" ${a?.status!=="closed"?"selected":""}>${s("进行中")}</option><option value="closed" ${a?.status==="closed"?"selected":""}>${s("已关闭（不再计入费用）")}</option></select></label>
        <label class="span-2">${s("备注")}<input name="notes" maxlength="1000" placeholder="${n(s("通知函编号、原因、和 HOA 的约定…"))}" value="${n(a?.notes||"")}"></label>
      </div>
      <h3 class="as-h">${s("付款计划")}</h3>
      <details class="as-gen" ${a?"":"open"}><summary>${s("快速生成分期")}</summary>
        <div class="form-grid">
          <label>${s("期数")}<input name="g_count" type="number" inputmode="numeric" min="1" max="120" placeholder="3"></label>
          <label>${s("每期金额 / 总额")}<span class="as-gen2"><input name="g_amt" type="number" inputmode="decimal" min="0.01" step="0.01" aria-label="${n(s("金额"))}"><select name="g_mode" aria-label="${n(s("金额含义"))}"><option value="each">${s("每期")}</option><option value="total">${s("总额")}</option></select></span></label>
          <label>${s("第一期到期日")}<input name="g_start" type="date" value="${I()}"></label>
          <div class="as-gen-go"><button type="button" class="btn btn-sm" data-as-gen>${s("生成分期")}</button></div>
        </div>
        <small class="muted">${s("每月一期；总额除不尽的零头放在最后一期。生成后每一期都能改日期和金额。")}</small></details>
      <ul class="as-rows" id="asRows">${r.map(l=>H(l,!!l.payment_id)).join("")}</ul>
      <p class="as-total muted" id="asTotal" role="status">${n(T(r.length,r.reduce((l,p)=>l+m(p.amount),0)))}</p>
      <div class="form-actions"><button type="button" class="btn btn-sm btn-ghost" data-as-add="installment">＋ ${s("加一期分期")}</button><button type="button" class="btn btn-sm btn-ghost" data-as-add="payoff">＋ ${s("加一次性结清")}</button></div>
      <p id="assessError" class="form-error" role="alert"></p>
      ${a?`<p class="muted" style="font-size:13px;margin:6px 0 0">${s("已缴的期锁定，不能改；要改请先到缴费记录里取消勾选或删除那笔缴费。")}</p>`:""}
      <div class="form-actions form-actions-split sticky-actions">
        <button type="button" class="btn btn-ghost" data-action="assess-cancel">${s("取消")}</button>
        <button type="submit" class="btn btn-primary">${a?s("保存修改"):s("添加摊派")}</button></div>
    </form>
    ${a?`<div class="danger-zone"><button type="button" class="btn btn-danger-ghost" data-action="assess-del" data-id="${n(a.id)}">${s("删除这笔摊派")}</button><small class="muted">${s("连同它的付款计划一起删除；已缴的缴费记录保留，只是不再关联。")}</small></div>`:""}
  </section>`}var T=(e,a)=>e?s("共 {n} 期，合计 {m}",{n:e,m:b(a)}):s("还没有任何一期：用上面的“快速生成分期”，或点“加一期分期 / 加一次性结清”。"),A=()=>{let e=document.getElementById("assessForm");if(!e)return;let a=[...e.querySelectorAll(".as-row")],d=a.reduce((r,l)=>r+m(l.querySelector('[name="as_amt"]').value),0),o=document.getElementById("asTotal");o&&(o.textContent=T(a.length,d))},F=e=>{let a=document.getElementById("asRows");a&&(a.insertAdjacentHTML("beforeend",e.map(d=>H(d)).join("")),A())};document.addEventListener("click",e=>{let a=document.getElementById("assessForm");if(!a)return;e.target.closest("[data-as-del]")&&(e.target.closest(".as-row").remove(),A());let d=e.target.closest("[data-as-add]");if(d){let o=[...a.querySelectorAll('.as-row [name="as_due"]')].map(r=>r.value).filter(Boolean).sort().pop();F([{due_on:o||I(),amount:null,kind:d.dataset.asAdd}])}if(e.target.closest("[data-as-gen]")){let o=a.elements,r=o.g_mode.value==="total",l=j({count:o.g_count.value,total:r?o.g_amt.value:null,each:r?null:o.g_amt.value,start:o.g_start.value});if(!l.length||!(m(o.g_amt.value)>0)){document.getElementById("assessError").textContent=s("填上期数、金额和第一期到期日再生成。");return}document.getElementById("assessError").textContent="",F(l)}});document.addEventListener("input",e=>{e.target.closest("#assessForm")&&e.target.name==="as_amt"&&A()});async function J(e){let a=e.elements,d=document.getElementById("assessError"),o=e.dataset.bill,r=e.dataset.id||null,l=t=>(d.textContent=t,!1),p=a.name.value.trim();if(!p)return l(s("请填名称。"));let $=[...e.querySelectorAll(".as-row")].map(t=>({id:t.dataset.id||null,paid:t.classList.contains("is-paid"),due_on:t.querySelector('[name="as_due"]').value,amount:Math.round(m(t.querySelector('[name="as_amt"]').value)*100)/100,kind:t.querySelector('[name="as_kind"]').value,settled:!!t.querySelector('[name="as_settled"]')?.checked}));if(!$.length)return l(s("至少要有一期。"));if($.some(t=>!t.paid&&(!t.due_on||!(t.amount>0))))return l(s("每一期都要填到期日和大于 0 的金额。"));let g=e.querySelector('button[type="submit"]');g.disabled=!0;try{let t=await _.saveAssess({id:r,bill_id:o,name:p,status:a.status.value,notes:a.notes.value.trim()||null}),f=new Set($.filter(i=>i.id).map(i=>i.id));for(let i of u.assessItems.filter(c=>c.assessment_id===t&&!c.payment_id&&!f.has(c.id)))await _.deleteAssessItem(i.id);for(let i of $)i.paid||await _.saveAssessItem({id:i.id,assessment_id:t,due_on:i.due_on,amount:i.amount,kind:i.kind,payment_id:null,settled_on:i.settled?u.assessItems.find(c=>c.id===i.id)?.settled_on||i.due_on:null});return E(r?s("已保存修改"):s("已添加 {name}",{name:p})),!0}catch(t){return g.disabled=!1,l(s("保存失败：{msg}",{msg:t.message}))}}var O=e=>`${h("bill",e)}?sec=assess`,Q=e=>B(O(e),{replace:!0});export{K as a,G as b,J as c,O as d,Q as e};
