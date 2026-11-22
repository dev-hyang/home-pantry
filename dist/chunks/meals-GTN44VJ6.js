import{a as f}from"./chunk-TRMMY3O2.js";import{a as h,b as w}from"./chunk-QIFHJQXM.js";import"./chunk-6ZRQYECI.js";import"./chunk-OI2PJR6D.js";import"./chunk-XBCT7EXB.js";import"./chunk-2AOFRGZA.js";import"./chunk-OSJYWLEY.js";import{a as i}from"./chunk-GDQHM6TU.js";import{d as $,k as t,m as u,t as c}from"./chunk-V6FPGIZ7.js";var k=p=>$==="en"?`https://www.google.com/search?q=${encodeURIComponent(`${t(p)} recipe`)}`:`https://www.xiachufang.com/search/?keyword=${encodeURIComponent(p)}`;function L(){let p=DIETS[i.diet],m=h(),d=new Set,S=(s,l)=>{let a=m.filter(e=>e.meal===s&&e.have>0&&!d.has(e.name));if(!a.length)return[];let o=[];for(let e=0;e<Math.min(l,a.length);e++){let n=a[(i.mealShift+e)%a.length];o.includes(n)||(o.push(n),d.add(n.name))}return o},b=i.slotShift||(i.slotShift={}),g=MEAL_SLOTS.map(s=>{let l=i.mealShift+(b[s.id]||0),a=m.filter(e=>e.meal===s.meal&&e.have>0&&!d.has(e.name)),o=[];for(let e=0;e<Math.min(s.count,a.length);e++){let n=a[(l+e)%a.length];o.includes(n)||(o.push(n),d.add(n.name))}return`<div class="slot"><h3>${t(s.name)}${o.length?`<button type="button" class="link-name slot-swap" data-action="slot-swap" data-slot="${s.id}">${t("换一道")}</button>`:""}</h3>${o.length?o.map(e=>`<div class="dish">${c(t(e.name))}${e.usesExpiring?` <span class="badge b-exp">${t("用临期")}</span>`:""}
      <small>${e.full?t("食材齐全"):t("还缺：{list}",{list:u(e.parts.filter(n=>!n.item).map(n=>c(t(n.kw[0]))))})}</small></div>`).join(""):`<p class="muted">${t("库存里暂时凑不出，看看下面的菜谱缺什么。")}</p>`}</div>`}).join(""),v=m.map(s=>{let l=s.parts.filter(a=>!a.item);return`<article class="recipe">
      <h3><span>${c(t(s.name))}</span><span class="badge ${s.full?"b-ok":"b-soon"}">${s.have}/${s.ings.length}</span></h3>
      <div class="ing">${s.parts.map(a=>`<span class="${a.item?"have":"miss"}">${c(a.item?a.item.name:t(a.kw[0]))}</span>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">${c(t(s.note))}</p>
      <div class="acts">
        ${l.length?`<button type="button" class="btn btn-sm" data-action="recipe-missing" data-name="${c(s.name)}">${t("缺的加入采购")}</button>`:""}
        <a class="btn btn-sm btn-ghost" href="${k(s.name)}" target="_blank" rel="noopener noreferrer">${t("在下厨房看做法")}</a>
      </div>
    </article>`}).join(""),r=i.route?.q?.get("ai");return r!=null&&(i.ai=i.ai||{ask:"",busy:!1,result:null,error:null,raw:null},r&&(i.ai.ask=r)),`
    ${f()}
    <section class="section">
      <div class="section-head"><h2>${t("按库存推荐菜单")}</h2>
        <button type="button" class="btn btn-sm" data-action="shuffle">${t("换一组")}</button></div>
      <div class="seg" role="group" aria-label="${t("饮食模式")}">
        ${Object.entries(DIETS).map(([s,l])=>`<button type="button" class="chip" data-action="diet" data-diet="${s}" aria-pressed="${i.diet===s}">${l.icon} ${t(l.name)}</button>`).join("")}
      </div>
      <div class="panel"><ul class="tips">${p.tips.map(s=>`<li>${c(t(s))}</li>`).join("")}</ul>
        <p class="disclaimer">${t("以上为一般性膳食建议，不能代替医生或注册营养师的个体化方案；孕期、妊娠糖尿病和产后请以医嘱为准。")}</p></div>
    </section>
    <section class="section"><div class="section-head"><h2>${t("今天吃什么")}</h2><p>${t("优先用掉快到期的食材")}</p></div><div class="plan">${g}</div></section>
    <section class="section"><div class="section-head"><h2>${t("可选菜谱")}</h2><p>${t("绿色是家里有的")}</p></div><div class="recipes">${v}</div></section>`}export{w as categoryOptions,h as scoreRecipes,L as viewMeals};
