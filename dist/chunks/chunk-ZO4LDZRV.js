import{a}from"./chunk-UVTSSMY7.js";import{k as e,t as l}from"./chunk-QYOZW4G3.js";var r={};function i(t){let o=window.BILLS;return`<form id="propertyForm" class="prop-form">
      <input type="hidden" name="property_id" value="${l(t?.id||"")}">
      <div class="form-grid">
        <label>${e("名称")}<input name="name" required maxlength="40" placeholder="${e("例如：芝加哥的家 / 出租房 1")}" value="${l(t?.name||"")}"></label>
        <label>${e("类型")}<select name="kind">${Object.entries(o.PROPERTY_KINDS).map(([n,s])=>`<option value="${n}" ${n===(t?.kind||"other")?"selected":""}>${e(s)}</option>`).join("")}</select></label>
        <label>${e("用途")}<select name="role">${Object.entries(o.PROPERTY_ROLES).map(([n,s])=>`<option value="${n}" ${n===(t?.role||"owner_occupied")?"selected":""}>${e(s)}</option>`).join("")}</select></label>
        <label>${e("状态")}<select name="status">${Object.entries(window.DEALS.PROPERTY_STATUS).map(([n,s])=>`<option value="${n}" ${n===(t?.status||"owned")?"selected":""}>${e(s)}</option>`).join("")}</select><small>${e("看房或签约阶段可先建房产；买卖和退租在“房屋 → 交易”里走流程")}</small></label>
        <label>${e("地址（可选）")}<input name="address" maxlength="120" value="${l(t?.address||"")}"></label>
        <label class="span-2">${e("备注")}<input name="notes" maxlength="500" value="${l(t?.notes||"")}"></label>
      </div>
      <div class="form-actions" style="margin-top:8px"><button class="btn btn-sm btn-primary" type="submit">${e("保存")}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="property-cancel">${e("取消")}</button></div></form>`}function $(){let t=a.editProperty==="new",o=a.editProperty&&a.editProperty!=="new"?a.properties.find(n=>n.id===a.editProperty):null;return t||o?`<section class="section"><div class="panel prop-inline">
      <div class="section-head" style="margin-bottom:8px"><h3 style="font-size:16px">${t?e("添加房产"):e("编辑房产：{name}",{name:l(o.name)})}</h3>
        <p>${e("房产的归档、删除在房屋概览右上角的 ⋮ 里；只有家主能新增、归档、删除")}</p></div>
      ${i(o)}</div></section>`:""}export{r as a,$ as b};
