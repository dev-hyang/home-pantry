import{m as $,n as f,r as y,v as h}from"./chunk-L52LVEBR.js";import{a as g}from"./chunk-4Y27IIES.js";import{a as d}from"./chunk-ADFGCLRI.js";import{a as u}from"./chunk-NIZSID7P.js";import{N as r,U as c,k as n,t as s}from"./chunk-7IFCJJOJ.js";var p=()=>Units.region.currency,b=(t,a)=>t==null?"—":Units.money(t,a||p()),x=()=>{let t=u.nwUi||={};return t.open||={},t.more||={},t},w=5;function O(t,a,l){let i=x().more[t]||w,e=a.slice(0,i);return a.length?`<ul class="nw-hist-list">${e.map(l).join("")}</ul>
    ${a.length>e.length?`<button type="button" class="btn btn-sm btn-ghost" data-nw="more" data-key="${s(t)}">${n("再显示 {n} 条（共 {total} 条）",{n:Math.min(w*4,a.length-e.length),total:a.length})}</button>`:""}`:`<p class="muted nw-none">${n("还没有记录")}</p>`}var D=(t,a=!1)=>x().open[t]??a?"open":"",S=t=>{let a=new Date(`${r()}T12:00:00`);return a.setDate(a.getDate()-t),a.toISOString().slice(0,10)};function C(t,{open:a=!1}={}){if(!u.nwOk||!d()||!$.includes(t.kind))return"";let l=`b:${t.id}`,i=h(t.id),e=i[0],m=f(t.kind),A=e&&e.as_of<S(y),_=o=>`<li><span>${s(c(o.as_of))}</span><b>${b(o.balance,o.currency)}</b>${o.notes?`<small class="muted">${s(o.notes)}</small>`:""}
      <button type="button" class="btn btn-sm btn-ghost" data-nw="bal-del" data-id="${s(o.id)}" aria-label="${s(n("删除 {d} 的余额",{d:c(o.as_of)}))}">${n("删除")}</button></li>`;return`<details class="nw-hist panel" data-nw-key="${s(l)}" ${D(l,a)}>
    <summary><span>${m?n("欠款"):n("余额")}：<b>${e?b(e.balance,e.currency):n("未记录")}</b>${e?` <small class="muted">${n("截至 {d}",{d:c(e.as_of)})}</small>`:""}${A?` <span class="badge b-soon">${n("需要更新")}</span>`:""}</span><span class="nw-sum-act">${n("更新余额")}</span></summary>
    <form class="nw-form" data-nw-form="bal" data-id="${s(t.id)}">
      <label>${n("日期")}<input type="date" name="as_of" required value="${r()}" max="${r()}"></label>
      <label>${m?n("欠款（{cur}）",{cur:p()}):n("余额（{cur}）",{cur:p()})}<input ${g("money",{min:null})} name="balance" required ${m?'min="0"':""} value="${e?s(e.balance):""}"></label>
      <label class="nw-note">${n("备注（可选）")}<input name="notes" maxlength="300"></label>
      <button type="submit" class="btn btn-primary btn-sm">${n("保存余额")}</button>
    </form>
    <p class="hint">${m?n("信用卡 / 贷款记欠款（正数），算负债。同一天再记一次 = 改那一天。"):n("按对账单或网银填当天余额；同一天再记一次 = 改那一天。透支记负数。")}</p>
    ${O(l,i,_)}
  </details>`}export{p as a,b,x as c,w as d,O as e,D as f,C as g};
