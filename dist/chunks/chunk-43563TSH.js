import{Mb as ce,Nb as ue,Oa as le,Pa as re,Ve as P,Xb as B,Ye as ge,pa as se,ud as me,vd as de,wd as pe,wf as ye,yd as fe,za as ie}from"./chunk-VCUCPMRV.js";import{l as j,m as z}from"./chunk-DIZCEXAM.js";import{a as oe}from"./chunk-ME7YTUOC.js";import{d as ne}from"./chunk-Y7C5VESJ.js";import{Q as ae,a as Y,b as Z}from"./chunk-VXEPT42P.js";import{F as te,Ja as x,a as U,b as R,c as ee,f as H}from"./chunk-VHWQVX7M.js";import{a as u,c as X,f as _,i as O}from"./chunk-UVTSSMY7.js";import{$ as N,G as S,H as J,I as $,L as A,M as E,N as Q,O as L,Y as M,k as a,t as o,u as v,v as K,y as V}from"./chunk-7MFRLEF5.js";var be={frozen:"冷冻肉禽"};function ve(e,t){t===void 0&&(t=be[e]);let n=S(e).subs||[];return t&&!n.includes(t)?`<option value="${o(t)}" selected>${o(a(t))}</option>`+n.map(i=>`<option value="${o(i)}">${o(a(i))}</option>`).join(""):n.map(i=>`<option value="${o(i)}" ${i===t?"selected":""}>${o(a(i))}</option>`).join("")}function nt(e,{space:t,cat:n}={}){let i=new URLSearchParams;t&&i.set("space",t),n&&i.set("cat",n),O(`${_("item",e||"new")}${i.toString()?`?${i}`:""}`)}function _e(e){e&&(u.needsRefresh=!0),u.skipAutosave=!0,u.prevRoute?history.back():O(_(...A($(u.editingCat||"fresh"))),{replace:!0})}var ke=e=>[{href:_("pantry"),label:a("储藏")},e==="gear"?{href:_("pantry","gear"),label:a("家居耐用品")}:{href:e==="house"?`${_("pantry","inventory")}?space=house`:_("pantry","inventory"),label:e==="house"?`${a("库存")} · ${a("汽车房屋消耗品")}`:a("库存")}],qe={today:"今日",pantry:"储藏",house:"房屋",gear:"家居耐用品",shopping:"购物车",me:"我的"},$e={pantry:"例如：鸡蛋、抽纸、大米",house:"例如：炉子滤网、电池、融雪盐",gear:"例如：被罩、千斤顶、儿童自行车"},xe=()=>u.assetsEnriched.filter(e=>e.kind!=="vehicle"),D=e=>`${se(e)}${u.properties.length>1&&e.property_id?` · ${ae(e.property_id)}`:""}`,we=[["pantry","🥫","日常消耗品","吃的喝的、纸巾洗护、药品、宠物粮：用了会少，要补货"],["house","🧰","汽车房屋消耗品","滤网、电池、灯泡、融雪盐、机油：房子、院子、车定期要换的"],["gear","🛋️","家居耐用品","家具、电器、厨具、衣物、玩具、工具：长期用，只记几件、放在哪"]];function Ee(e){let t=u.enriched.find(n=>n.id===e.id);return`${t&&!Se(e)?ce(t):""}${z(e.id)?ue():""}`}var Se=e=>$(e.category)==="gear";function Le(e){let t=!!z(e.id),n=u.enriched.find(r=>r.id===e.id),i=t?a("移出购物车"):a("加入购物车");return`<button type="button" class="btn btn-sm af-cart${t?" is-in":""}" data-action="${t?"shop-remove-item":"shop-add-item"}" data-id="${e.id}" ${n?"":"disabled"} title="${o(i)}" aria-label="${o(`${e.name}：${i}`)}">${t?a("移出购物车"):a("加入购物车")}</button>`}function Ie(e,t){let n=we.filter(([l])=>l===e||(l==="house"?u.houseEnabled:l==="gear"?u.gearEnabled:!0)),i=([,l,s,m])=>`<b>${l} ${a(s)}</b><small>${a(m)}</small>`,r=n.find(([l])=>l===e)||n[0];return`<fieldset class="span-2 space-pick"><legend>${a("组别")}</legend>
    <details class="space-dd" ${t?"open":""}><summary class="space-card space-sum" aria-label="${o(a("组别"))}"><span class="space-sum-txt">${i(r)}</span><span class="space-chev" aria-hidden="true">▾</span></summary>
    <div class="space-opts">${n.map(l=>`<label class="space-opt">
    <input type="radio" name="space" value="${l[0]}" ${l[0]===e?"checked":""}><span class="space-card">${i(l)}</span></label>`).join("")}</div></details>
    <p class="muted space-rel">${a("组别 › 大类 › 小类：组别决定东西的性质（日常消耗品、汽车房屋消耗品、家居耐用品）；大类是组别下的分类，例如蔬果、清洁；小类是大类下的细分，例如叶菜。")}</p></fieldset>`}var G=new Map,Fe=(e,t)=>`${e||"new"}:${t}`;function T(e,t,n,i,r,l="",s=""){let m=Fe(e,t),c=G.has(m)?G.get(m):r;return`<details class="fsec ${l}" data-fsec="${o(m)}" ${c?"open":""}><summary><span class="fsec-ttl">${n}</span>${s?`<span class="fsec-aside">${s}</span>`:""}<span class="fsec-chev" aria-hidden="true">▾</span></summary>
    <fieldset><legend class="sr-only">${n}</legend>${i}</fieldset></details>`}typeof document<"u"&&document.addEventListener("toggle",e=>{let t=e.target;t?.matches?.("details.fsec[data-fsec]")&&G.set(t.dataset.fsec,t.open)},!0);function Ce(){return T("","spend",a("花费（选填）"),`
          <p class="muted" style="margin:-6px 0 10px;font-size:13px">${a("填了金额就同时记一笔花费，关联到这件物品；不填就只入库。")}</p>
          <div class="form-grid">
            <label>${a("金额（{cur}）",{cur:Units.region.currency})}<input name="sp_amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label>
            <label>${a("商店 / 收款方")}<input name="sp_store" maxlength="40" list="storeList" value="${o(de())}"></label>
            <label>${a("日期")}<input name="sp_date" type="date" max="${L()}" value="${L()}"></label>
            ${P("sp_card")?`<label>${a("怎么付的")}${P("sp_card")}</label>`:""}
          </div>
          ${fe()}`,!1,"item-spend")}function st(){let e=u.route,t=e.id&&e.id!=="new"?u.items.find(f=>f.id===e.id):null;if(e.id!=="new"&&!t)return`<div class="panel empty"><strong>${a("找不到这件物品")}</strong>${a("可能已被家人删除。")}<p><a class="btn btn-primary" href="${_("pantry","inventory")}">${a("回到库存")}</a></p></div>`;let n=e.q.get("space")||u.filter.space||"pantry",i=e.q.get("cat"),r=i&&CATEGORIES.some(f=>f.id===i)?i:u.filter.space===n&&u.filter.cat!=="all"?u.filter.cat:J(n)[0].id,l=!t&&e.q.get("copy")?Z(u.items.find(f=>f.id===e.q.get("copy")),["expiry_date","asset_ids","alert_mute_until","cat_check","avg_daily_use","name_key"]):null;l&&(l.name=`${l.name}（2）`.slice(0,60));let s=t||l||{category:r,unit:"个",quantity:1,min_quantity:n==="gear"?0:1,lead_days:n==="house"?14:n==="gear"?0:3,location:S(r).loc};u.editingCat=s.category;let m=$(s.category)==="gear",c={href:u.prevRoute&&u.prevHash?u.prevHash:_(...A(n)),label:u.prevRoute?a(X[u.prevRoute.section]?.name||"上一页"):a(qe[n]||"列表")},b=Units.factor(s.unit),q=V(s.unit),h=t||l?(v(s.min_quantity)>0||v(s.lead_days)>0)&&!(t&&t.alert_mute_until===E):!1,k=f=>f==null||f===""?"":K(v(f)*b);return`
    <section class="section form-page">
      ${ne([...ke(n),{label:t?a("编辑：{name}",{name:t.name}):l?a("复制：{name}",{name:l.name}):a("添加物品"),icon:S(s.category).icon}])}
      ${ye("item","#itemForm",t?Le(t):"")}
      <form id="itemForm" class="panel ${m?"is-gear":""} ${$(s.category)==="house"?"is-house":""} ${h?"is-remind":""}" novalidate data-autosave>
        <input type="hidden" name="item_id" value="${o(t?.id||"")}">
        <input type="hidden" name="orig_unit" value="${o(s.unit)}">
        <input type="hidden" name="disp_unit" value="${o(Units.normalize(q))}">
        ${T(t?.id,"basic",a("基本信息"),`
          <div class="form-grid">
            <label class="span-2">${a("名称")}
              <input name="name" required maxlength="60" autocomplete="off" placeholder="${a($e[$(s.category)]||$e.pantry)}" value="${o(s.name||"")}">
              <small class="name-hint" id="itemNameHint" role="status" ${t?"":"data-new"} hidden></small>
            </label>
            <label class="span-2">${a("别名（选填）")}
              <input name="aliases" maxlength="200" autocomplete="off" placeholder="${o(a("同一样东西的其他叫法，用逗号隔开，例如：milk, 牛乳"))}" value="${o(t?H(t.id).join(", "):"")}">
              <small class="muted">${a("录入购物、购物车、记花费写成这些叫法，也会对上这件")}</small>
            </label>
            ${Ie($(s.category),!t)}
            <label>${a("大类")}
              <select name="category" required data-search>${B(s.category,{withOther:!1,only:$(s.category)})}</select>
            </label>
            <label>${a("小类")}
              <select name="subcategory" data-search>${ve(s.category,s.subcategory)}</select>
            </label>
            ${le(s.location)}
            <label class="not-gear">${a("保质期至")}
              <input name="expiry_date" type="date" value="${o(s.expiry_date||"")}">
            </label>
            ${ie(s,e.q.get("prop")?`p:${e.q.get("prop")}`:e.q.get("veh")?`a:${e.q.get("veh")}`:"")}
            ${Te(s)}
          </div>`,!0,"",t?Ee(t):"")}
        ${T(t?.id,"qty",`<span class="not-gear">${a("数量与提醒")}</span><span class="only-gear">${a("数量")}</span>`,`
          <p class="muted only-gear" style="margin:0 0 10px;font-size:13px">${a("家居耐用品只记数量和位置，不算消耗，也不会提醒补货。需要保养周期或保修的，用下方“升级为设备档案”。")}</p>
          <div class="form-grid">
            <label>${a("当前数量")}
              <input name="quantity" type="number" min="0" step="any" inputmode="decimal" required value="${k(s.quantity??0)}" data-orig="${k(s.quantity??0)}">
            </label>
            <label>${a("单位")}
              ${oe(`name="unit" required ${t||l?"":'data-auto="1"'}`,q||"个")}
              ${q!==s.unit?`<small>${a("原单位 {u}，已按当前地区换算显示",{u:o(s.unit)})}</small>`:""}
            </label>
            <label class="span-2 not-gear remind-toggle check-inline"><input type="checkbox" name="remind" ${h?"checked":""}>
              <span><b>${a("提醒补货")}</b><small class="muted">${a("打开后，少于少货线或快用完时提醒；不打开就不提醒")}</small></span></label>
            <label class="not-gear remind-only">${a("少货线")}
              <input name="min_quantity" type="number" min="0" step="any" inputmode="decimal" value="${k(s.min_quantity??0)}" data-orig="${k(s.min_quantity??0)}">
              <small>${a("数量低于或等于它时提醒“少货”")}</small>
            </label>
            <label class="not-gear remind-only">${a("提前几天提醒")}
              <input name="lead_days" type="number" min="0" max="60" step="1" inputmode="numeric" value="${o(s.lead_days??3)}">
              <small>${a("预计剩余天数低于它时提醒“即将告罄”")}</small>
            </label>
            <label class="span-2 not-gear">${a("每天大约用多少（可选）")}
              <input name="avg_daily_use" type="number" min="0" step="any" inputmode="decimal" placeholder="${a("留空则根据家人的使用记录自动估算")}" value="${k(s.avg_daily_use)}" data-orig="${k(s.avg_daily_use)}">
            </label>
            ${t?Me(s):""}
          </div>`,!0)}
        ${T(t?.id,"notes",a("备注"),`
          <label class="sr-only" for="itemNotes">${a("备注")}</label>
          <textarea id="itemNotes" name="notes" rows="3" maxlength="500" placeholder="${m?a("品牌、型号、尺寸、购买时间、借给了谁…"):a("品牌、规格、在哪买更便宜…")}">${o(s.notes||"")}</textarea>`,!!s.notes)}
        ${t?"":Ce()}
        <p id="itemFormError" class="form-error" role="alert"></p>
        <div class="form-actions sticky-actions">
          <button type="submit" class="btn btn-primary">${t?a("保存修改"):a("添加物品")}</button>
          <button type="button" class="btn btn-ghost" data-action="item-cancel">${a("取消")}</button>
          ${t?`<span class="spacer"></span>${Y([{label:m?a("复制为新家居耐用品"):a("复制为新物品"),href:`${_("item","new")}?copy=${encodeURIComponent(t.id)}&space=${$(t.category)}`},m&&{label:a("升级为设备档案"),href:`#/asset/new?from_item=${encodeURIComponent(t.id)}`},{label:a("删除物品"),action:"item-delete",danger:!0}],{up:!0})}`:""}
        </div>
      </form>
      ${t&&M(t)?`<p class="record-meta">${o(M(t))}${x.mode==="cloud"&&j(t.updated_by)?`（${o(j(t.updated_by))}）`:""}</p>`:""}
    </section>`}var he=e=>e.join("、");function Te(e){let t=xe(),n=new Set(Array.isArray(e.asset_ids)?e.asset_ids:[]),i=t.filter(r=>n.has(r.id)).map(D);return`<div class="span-2 only-house pick-field"><span class="pick-lbl" id="assetLinkLbl">${a("关联设备")}</span>
    ${t.length?`<details class="pick">
      <summary aria-labelledby="assetLinkLbl"><span class="pick-val ${i.length?"":"is-empty"}">${o(i.length?he(i):a("不关联设备"))}</span><b class="pick-n" ${i.length?"":"hidden"}>${i.length}</b></summary>
      <div class="pick-panel" role="group" aria-labelledby="assetLinkLbl">
        ${t.length>8?`<input type="search" class="pick-q" placeholder="${a("搜索设备")}" aria-label="${a("搜索设备")}">`:""}
        ${t.map(r=>`<label class="pick-row check-inline"><input type="checkbox" name="asset_ids" value="${o(r.id)}" data-label="${o(D(r))}" ${n.has(r.id)?"checked":""}><span>${r.t?.icon||"⚙️"} ${o(D(r))}</span></label>`).join("")}
      </div></details>
      <small class="muted">${a("可多选；设备页的“相关耗材”会列出它。")}</small>`:`<p class="muted" style="margin:4px 0 0;font-size:13px">${a("还没有设备。先在 房屋 → 设备保养 里添加，就能在这里关联。")}</p>`}</div>`}document.addEventListener("change",e=>{let t=e.target.closest?.("details.pick");if(!t||!t.querySelector("input[name=asset_ids]"))return;let n=[...t.querySelectorAll("input[name=asset_ids]:checked")].map(l=>l.dataset.label),i=t.querySelector(".pick-val"),r=t.querySelector(".pick-n");i.textContent=n.length?he(n):a("不关联设备"),i.classList.toggle("is-empty",!n.length),r.textContent=n.length,r.hidden=!n.length});document.addEventListener("input",e=>{if(!e.target.classList?.contains("pick-q"))return;let t=e.target.value.trim().toLowerCase();e.target.closest(".pick-panel").querySelectorAll(".pick-row").forEach(n=>{n.hidden=!!t&&!n.textContent.toLowerCase().includes(t)})});document.addEventListener("click",e=>document.querySelectorAll("details.pick[open]").forEach(t=>{t.contains(e.target)||(t.open=!1)}));document.addEventListener("keydown",e=>{e.key==="Escape"&&document.querySelectorAll("details.pick[open]").forEach(t=>{t.open=!1,t.querySelector("summary")?.focus()})});async function it(e,{silent:t=!1}={}){let n=e.elements,i=e.querySelector("#itemFormError"),r=(p,g)=>{if(t)N(a("没有自动保存：{msg}",{msg:p}));else{i.textContent=p;let y=g.closest?.("details");y&&(y.open=!0),g.focus()}return!1},l=n.name.value.trim(),s=v(n.quantity.value,NaN);if(!l)return r(a("请填写物品名称。"),n.name);let m=R(l,{exceptId:n.item_id.value||null});if(m)return r(a("已经有「{name}」（{cat}）。是同一样东西就去那件补库存；是另一件就在名字里加上品牌、规格区分。",{name:m.name,cat:a(S(m.category).name)}),n.name);if(!Number.isFinite(s)||s<0)return r(a("数量需要是 0 或正数。"),n.quantity);let c=Units.normalize(n.unit.value)||"个",b=n.orig_unit.value,q=c===n.disp_unit.value&&c!==b,h=u.items.find(p=>p.id===n.item_id.value)||{},k=p=>{let g=n[p];return g.value===""?null:q?g.value===g.dataset.orig&&h[p]!=null?v(h[p]):Math.round(Math.max(0,v(g.value))/Units.factor(b)*1e3)/1e3:Math.max(0,v(g.value))},f=$(n.category.value)==="gear",I=!f&&!!n.remind?.checked,d={id:n.item_id.value||void 0,name:l,category:n.category.value,subcategory:n.subcategory.value||null,unit:q?b:c,quantity:Math.round(k("quantity")*100)/100,min_quantity:I?Math.round((k("min_quantity")||0)*100)/100:0,lead_days:I?Math.min(60,Math.max(0,Math.round(v(n.lead_days.value,3)))):0,location:null,expiry_date:f?null:n.expiry_date.value||null,avg_daily_use:f?null:k("avg_daily_use"),notes:n.notes.value.trim()||null};if($(d.category)==="house"){let p=[...e.querySelectorAll('input[name="asset_ids"]:checked')].map(g=>g.value);(p.length||h.asset_ids?.length)&&(d.asset_ids=p)}else h.asset_ids?.length&&(d.asset_ids=[]);let F=$(d.category)==="house"&&n.owner?.value||"";d.property_id=F.startsWith("p:")?F.slice(2):null,d.owner_asset_id=F.startsWith("a:")?F.slice(2):null;let W=e.querySelector('button[type="submit"]');W.disabled=!0;try{d.location=await re(n);let p=await x.saveItem(d);if(n.aliases&&(p||d.id)){let y=p||d.id,C=[...new Set(n.aliases.value.split(/[,，、;；]/).map(w=>w.trim().slice(0,60)).filter(w=>w&&U(w)!==U(d.name)))];C.join("|")!==H(y).join("|")&&await x.setItemAliases(y,C).then(()=>x.listItemAliases()).then(w=>{u.itemAliases=w||[]}).catch(()=>{})}if(!d.id&&n.sp_amount&&n.sp_amount.value!==""&&v(n.sp_amount.value)>0){let y=me(n.sp_store?.value||""),C=n.sp_date?.value||L();await x.addPurchase({item_id:p||null,name:d.name,category:d.category,quantity:d.quantity||null,unit:d.unit||null,amount:Math.round(v(n.sp_amount.value)*100)/100,currency:Units.region.currency,purchased_at:new Date(`${C}T12:00:00`).toISOString(),store:y,...ge(n.sp_card?.value||"")}),y&&pe(y)}d.id&&h.cat_check&&await x.clearCatCheck([d.id]).catch(()=>{});let g=d.id||p;if(g&&!I&&!f)(h.alert_mute_until||null)!==E&&await x.setItemMute(g,E).catch(()=>{});else if(d.id&&n.alert_mute&&I){let y=Ne(n.alert_mute.value,h.alert_mute_until);(y||null)!==(h.alert_mute_until||null)&&(await x.setItemMute(d.id,y),h.alert_mute_until=y)}return t||(N(d.id?a("已保存修改"):a("已添加 {name}",{name:l})),_e(!0)),!0}catch(p){if(t)throw p;return i.textContent=/items_household_name_key_uniq/.test(p.message)?a("已经有同名的物品了：换个名字区分（品牌、规格），或去那件补库存。"):a("保存失败：{msg}",{msg:p.message}),W.disabled=!1,!1}}var Ae=e=>!!e.alert_mute_until&&String(e.alert_mute_until)>L();function Me(e){let t=Ae(e)?e.alert_mute_until===E?"forever":"keep":"",n=(i,r)=>`<option value="${i}" ${t===i?"selected":""}>${r}</option>`;return`<label class="span-2 not-gear remind-only">${a("补货提醒")}
    <select name="alert_mute">
      ${n("",a("正常提醒"))}
      ${t==="keep"?n("keep",a("暂停提醒，到 {d}",{d:o(e.alert_mute_until)})):""}
      ${n("30",a("暂停 30 天"))}${n("90",a("暂停 90 天"))}${n("forever",a("不再提醒"))}
    </select>
    <small>${a("试过不好吃、或暂时用完不想补：选一个，它就不会再出现在注意事项里。临期提醒不受影响。")}</small>
  </label>`}function Ne(e,t){return e==="forever"?E:e==="30"||e==="90"?Q(+e):e==="keep"&&t||null}function Oe(e,t){if(!e||e.elements.item_id.value||e.dataset.catTouched==="1")return;let n=e.elements.space?.value||"pantry",i=te(t,n,$);if(!i)return;let[r,l]=i,s=e.elements.category,m=e.elements.subcategory;[...s.options].some(c=>c.value===r)&&(s.value!==r&&(s.value=r,s.dispatchEvent(new Event("change",{bubbles:!0}))),l&&[...m.options].some(c=>c.value===l)&&m.value!==l&&(m.value=l,m.dispatchEvent(new Event("change",{bubbles:!0}))))}document.addEventListener("input",e=>{if(e.target.name==="unit"&&e.target.closest?.("#itemForm")){delete e.target.dataset.auto;return}if(e.target.name==="space"&&e.target.closest?.("#itemForm")){let c=e.target.form.elements.category;c.innerHTML=B(null,{withOther:!1,only:e.target.value}),c.selectedIndex=0,c.dispatchEvent(new Event("change",{bubbles:!0}));let b=e.target.closest(".space-dd"),q=e.target.nextElementSibling;b&&q&&(b.querySelector(".space-sum-txt").innerHTML=q.innerHTML,b.open=!1);return}if(e.target.name==="remind"&&e.target.closest?.("#itemForm")){let c=e.target.form;c.classList.toggle("is-remind",e.target.checked),e.target.checked&&c.elements.alert_mute?.value==="forever"&&(c.elements.alert_mute.value="");return}if((e.target.name==="category"||e.target.name==="subcategory")&&e.target.closest?.("#itemForm")&&e.isTrusted){e.target.form.dataset.catTouched="1";return}if(e.target.name!=="name"||!e.target.closest?.("#itemForm"))return;Oe(e.target.form,e.target.value);let t=document.getElementById("itemNameHint"),n=e.target.form;if(!t||!n)return;let i=n.elements.unit;if(i?.dataset.auto==="1"){let c=Units.guess(e.target.value)||"个";i.tagName==="SELECT"&&![...i.options].some(b=>b.value===c)&&i.insertAdjacentHTML("afterbegin",`<option value="${o(c)}">${o(a(c))}</option>`),i.value=i.tagName==="SELECT"?c:a(c)}let r=n.elements.item_id.value||null,l=R(e.target.value,{exceptId:r}),s=l?[]:ee(e.target.value,{exceptId:r});t.hidden=!l&&!s.length;let m=c=>`<a href="${_("item",c.id)}">${o(c.name)}</a>`;t.innerHTML=l?a("已有同名物品：{link}",{link:m(l)}):s.length?a("相近的已有物品：{list}",{list:s.map(m).join("、")}):""});export{ve as a,nt as b,_e as c,we as d,st as e,it as f};
