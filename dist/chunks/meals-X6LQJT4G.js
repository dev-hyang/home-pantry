import{a as f}from"./chunk-HZIEZDXG.js";import{a as h,b as w}from"./chunk-IJAQJ3HZ.js";import"./chunk-V72QQRZZ.js";import"./chunk-QJLYKTCK.js";import"./chunk-OK3S3NNZ.js";import"./chunk-M2KLXRBE.js";import"./chunk-4Y27IIES.js";import"./chunk-WKDDDV5B.js";import"./chunk-TNRVAN2X.js";import"./chunk-QQNIDFRO.js";import"./chunk-TZBLDSUG.js";import{a as n}from"./chunk-NIZSID7P.js";import{d as u,k as s,m as $,t as c}from"./chunk-IRUOA7QV.js";var k=p=>u==="en"?`https://www.google.com/search?q=${encodeURIComponent(`${s(p)} recipe`)}`:`https://www.xiachufang.com/search/?keyword=${encodeURIComponent(p)}`;function I(){let p=DIETS[n.diet],m=h(),d=new Set,S=(t,l)=>{let a=m.filter(e=>e.meal===t&&e.have>0&&!d.has(e.name));if(!a.length)return[];let o=[];for(let e=0;e<Math.min(l,a.length);e++){let i=a[(n.mealShift+e)%a.length];o.includes(i)||(o.push(i),d.add(i.name))}return o},g=n.slotShift||(n.slotShift={}),v=MEAL_SLOTS.map(t=>{let l=n.mealShift+(g[t.id]||0),a=m.filter(e=>e.meal===t.meal&&e.have>0&&!d.has(e.name)),o=[];for(let e=0;e<Math.min(t.count,a.length);e++){let i=a[(l+e)%a.length];o.includes(i)||(o.push(i),d.add(i.name))}return`<div class="slot"><h3>${s(t.name)}${o.length?`<button type="button" class="link-name slot-swap" data-action="slot-swap" data-slot="${t.id}">${s("换一道")}</button>`:""}</h3>${o.length?o.map(e=>`<div class="dish">${c(s(e.name))}${e.usesExpiring?` <span class="badge b-exp">${s("用临期")}</span>`:""}
      <small>${e.full?s("食材齐全"):s("还缺：{list}",{list:$(e.parts.filter(i=>!i.item).map(i=>c(s(i.kw[0]))))})}</small></div>`).join(""):`<p class="muted">${s("库存里暂时凑不出，看看下面的菜谱缺什么。")}</p>`}</div>`}).join(""),b=m.map(t=>{let l=t.parts.filter(a=>!a.item);return`<article class="recipe">
      <h3><span>${c(s(t.name))}</span><span class="badge ${t.full?"b-ok":"b-soon"}">${t.have}/${t.ings.length}</span></h3>
      <div class="ing">${t.parts.map(a=>`<span class="${a.item?"have":"miss"}">${c(a.item?a.item.name:s(a.kw[0]))}</span>`).join("")}</div>
      <p class="muted" style="margin:0;font-size:13px">${c(s(t.note))}</p>
      <div class="acts">
        ${l.length?`<button type="button" class="ui-btn" data-size="sm" data-action="recipe-missing" data-name="${c(t.name)}">${s("缺的加入采购")}</button>`:""}
        <a class="ui-btn" data-size="sm" data-tone="ghost" href="${k(t.name)}" target="_blank" rel="noopener noreferrer">${s("在下厨房看做法")}</a>
      </div>
    </article>`}).join(""),r=n.route?.q?.get("ai");return r!=null&&(n.ai=n.ai||{ask:"",busy:!1,result:null,error:null,raw:null},r&&(n.ai.ask=r)),`
    ${f()}
    <section class="section">
      <div class="section-head"><h2>${s("按库存推荐菜单")}</h2>
        <button type="button" class="ui-btn" data-size="sm" data-action="shuffle">${s("换一组")}</button></div>
      <div class="seg" role="group" aria-label="${s("饮食模式")}">
        ${Object.entries(DIETS).map(([t,l])=>`<button type="button" class="chip" data-action="diet" data-diet="${t}" aria-pressed="${n.diet===t}">${l.icon} ${s(l.name)}</button>`).join("")}
      </div>
      <div class="panel"><ul class="tips">${p.tips.map(t=>`<li>${c(s(t))}</li>`).join("")}</ul>
        <p class="disclaimer">${s("以上为一般性膳食建议，不能代替医生或注册营养师的个体化方案；孕期、妊娠糖尿病和产后请以医嘱为准。")}</p></div>
    </section>
    <section class="section"><div class="section-head"><h2>${s("今天吃什么")}</h2><p>${s("优先用掉快到期的食材")}</p></div><div class="plan">${v}</div></section>
    <section class="section"><div class="section-head"><h2>${s("可选菜谱")}</h2><p>${s("绿色是家里有的")}</p></div><div class="recipes">${b}</div></section>`}export{w as categoryOptions,h as scoreRecipes,I as viewMeals};
