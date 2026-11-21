import{c as $,d as f,h as y,l as h}from"./chunk-NLUMCHNJ.js";import{a as b}from"./chunk-LUS5SUU7.js";import{a as p}from"./chunk-CYBFXKK4.js";import{N as r,U as c,k as n,t as s}from"./chunk-OQQ6NGWX.js";var u=()=>Units.region.currency,d=(t,a)=>t==null?"—":Units.money(t,a||u()),w=()=>{let t=p.nwUi||={};return t.open||={},t.more||={},t},g=5;function x(t,a,l){let i=w().more[t]||g,e=a.slice(0,i);return a.length?`<ul class="nw-hist-list">${e.map(l).join("")}</ul>
    ${a.length>e.length?`<button type="button" class="btn btn-sm btn-ghost" data-nw="more" data-key="${s(t)}">${n("再显示 {n} 条（共 {total} 条）",{n:Math.min(g*4,a.length-e.length),total:a.length})}</button>`:""}`:`<p class="muted nw-none">${n("还没有记录")}</p>`}var O=(t,a=!1)=>w().open[t]??a?"open":"",D=t=>{let a=new Date(`${r()}T12:00:00`);return a.setDate(a.getDate()-t),a.toISOString().slice(0,10)};function v(t,{open:a=!1}={}){if(!p.nwOk||!b()||!$.includes(t.kind))return"";let l=`b:${t.id}`,i=h(t.id),e=i[0],m=f(t.kind),S=e&&e.as_of<D(y),_=o=>`<li><span>${s(c(o.as_of))}</span><b>${d(o.balance,o.currency)}</b>${o.notes?`<small class="muted">${s(o.notes)}</small>`:""}
      <button type="button" class="btn btn-sm btn-ghost" data-nw="bal-del" data-id="${s(o.id)}" aria-label="${s(n("删除 {d} 的余额",{d:c(o.as_of)}))}">${n("删除")}</button></li>`;return`<details class="nw-hist panel" data-nw-key="${s(l)}" ${O(l,a)}>
    <summary><span>${m?n("欠款"):n("余额")}：<b>${e?d(e.balance,e.currency):n("未记录")}</b>${e?` <small class="muted">${n("截至 {d}",{d:c(e.as_of)})}</small>`:""}${S?` <span class="badge b-soon">${n("需要更新")}</span>`:""}</span><span class="nw-sum-act">${n("更新余额")}</span></summary>
    <form class="nw-form" data-nw-form="bal" data-id="${s(t.id)}">
      <label>${n("日期")}<input type="date" name="as_of" required value="${r()}" max="${r()}"></label>
      <label>${m?n("欠款（{cur}）",{cur:u()}):n("余额（{cur}）",{cur:u()})}<input type="number" name="balance" step="0.01" inputmode="decimal" required ${m?'min="0"':""} value="${e?s(e.balance):""}"></label>
      <label class="nw-note">${n("备注（可选）")}<input name="notes" maxlength="300"></label>
      <button type="submit" class="btn btn-primary btn-sm">${n("保存余额")}</button>
    </form>
    <p class="hint">${m?n("信用卡 / 贷款记欠款（正数），算负债。同一天再记一次 = 改那一天。"):n("按对账单或网银填当天余额；同一天再记一次 = 改那一天。透支记负数。")}</p>
    ${x(l,i,_)}
  </details>`}export{u as a,d as b,w as c,g as d,x as e,O as f,v as g};
