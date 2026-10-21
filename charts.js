/* 轻量 SVG 图表：堆叠柱状图、折线图、环形图
 * 用固定 viewBox + width:100% 缩放，不读取窗口宽高，各种屏幕上比例一致；
 * 每个图都配一份数据表（<details>），方便读屏软件和精确查看。
 */
(() => {
  "use strict";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const t = (s) => (window.__t ? window.__t(s) : s);   // 多语言（js/core/i18n.js 挂到 window）
  // 两套画布：宽屏 640×260；手机 360×250（字号在手机上不会被缩得太小）
  const SIZES = [
    { cls: "ch-wide",   W: 640, H: 260, maxLabels: 8, PAD: { l: 56, r: 12, t: 22, b: 34 } },
    { cls: "ch-narrow", W: 360, H: 250, maxLabels: 5, PAD: { l: 54, r: 8,  t: 22, b: 30 } },
  ];
  // 可点击：带 data-drill（查询串，由页面的全局点击处理跳到明细）；键盘 Enter / 空格同样可用
  const hit = (q, label) => (q ? ` class="ch-hit" data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(label)}"` : "");
  const tip = (q) => (q ? `（${t("点击查看明细")}）` : "");
  const both = (title, draw) => SIZES.map((z) =>
    `<svg class="${z.cls}" viewBox="0 0 ${z.W} ${z.H}" role="img" aria-label="${esc(title)}">${draw(z)}</svg>`).join("");

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  function axes({ W, H, PAD, maxLabels }, max, labels, fmt, xAt) {
    const ih = H - PAD.t - PAD.b;
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + ih - (ih * i) / 4;
      g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="ch-grid"/>`;
      g += `<text x="${PAD.l - 6}" y="${y + 4}" text-anchor="end" class="ch-tick">${esc(fmt((max * i) / 4, true))}</text>`;
    }
    const every = Math.ceil(labels.length / maxLabels);
    labels.forEach((l, i) => {
      if (!(i % every === 0 || i === labels.length - 1)) return;
      const x = xAt(i);   // 贴边的首尾标签改为左/右对齐，避免被裁掉
      const anchor = x - PAD.l < 16 ? "start" : W - PAD.r - x < 16 ? "end" : "middle";
      g += `<text x="${x}" y="${H - 10}" text-anchor="${anchor}" class="ch-tick">${esc(l)}</text>`;
    });
    return g;
  }

  function table(labels, series, fmt) {
    return `<details class="ch-table"><summary>${t("查看数据表")}</summary><div class="ch-scroll"><table>
      <thead><tr><th scope="col"></th>${series.map((s) => `<th scope="col">${esc(s.name)}</th>`).join("")}</tr></thead>
      <tbody>${labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${series.map((s) => `<td>${esc(fmt(s.values[i] || 0))}</td>`).join("")}</tr>`).join("")}</tbody>
    </table></div></details>`;
  }

  function legend(series, legendDrill = null) {
    if (series.length < 2) return "";
    return `<ul class="ch-legend">${series.map((s, k) => { const q = legendDrill?.(k);
      return q ? `<li class="ch-hit-row" data-drill="${esc(q)}" role="link" tabindex="0" aria-label="${esc(s.name)}，${esc(t("查看明细"))}"><i style="background:${s.color}"></i>${esc(s.name)}</li>` : `<li><i style="background:${s.color}"></i>${esc(s.name)}</li>`; }).join("")}</ul>`;
  }

  /** 柱状图；stacked=true 时各系列叠加并在顶部标总量 */
  function bars({ labels, series, fmt = String, title, stacked = true, showTotals = true, drill = null, legendDrill = null }) {
    const n = labels.length || 1;
    const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
    const max = niceMax(stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values)));
    const draw = (z) => {
      const { W, H, PAD } = z, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, band = iw / n;
      const xAt = (i) => PAD.l + band * i + band / 2;
      const bw = Math.min(46, band * (stacked ? 0.62 : 0.8 / series.length));
      let marks = "";
      labels.forEach((lab, i) => {
        let base = 0;
        series.forEach((s, k) => {
          const v = s.values[i] || 0;
          if (v <= 0) return;
          const h = (v / max) * ih;
          const x = stacked ? xAt(i) - bw / 2 : xAt(i) - (bw * series.length) / 2 + k * bw;
          const y = PAD.t + ih - (stacked ? base + h : h);
          const q = drill?.(k, i);
          marks += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" style="fill:${s.color}" rx="2"${hit(q, `${lab} ${s.name}：${fmt(v)}，${t("查看明细")}`)}><title>${esc(lab)} ${esc(s.name)}：${esc(fmt(v))}${tip(q)}</title></rect>`;
          if (stacked) base += h;
        });
        // 手机画布上柱子较窄，总额标签只在宽屏显示
        if (stacked && showTotals && totals[i] > 0 && z.cls === "ch-wide") {
          marks += `<text x="${xAt(i)}" y="${(PAD.t + ih - (totals[i] / max) * ih - 6).toFixed(1)}" text-anchor="middle" class="ch-val">${esc(fmt(totals[i], true))}</text>`;
        }
      });
      return axes(z, max, labels, fmt, xAt) + marks;
    };
    return `<figure class="chart">${both(title, draw)}
      ${legend(series, legendDrill)}${table(labels, stacked && series.length > 1 ? [...series, { name: t("合计"), values: totals }] : series, fmt)}</figure>`;
  }

  /** 折线图；可叠一组柱子（bars）作为第二种度量（共用同一纵轴单位时使用） */
  function line({ labels, series, fmt = String, title, barSeries = null, drill = null, barDrill = null }) {
    const n = labels.length;
    const all = [...series, ...(barSeries ? [barSeries] : [])].flatMap((s) => s.values);
    const max = niceMax(Math.max(0, ...all));
    const draw = (z) => {
      const { W, H, PAD } = z, iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      const xAt = (i) => (n === 1 ? PAD.l + iw / 2 : PAD.l + (iw * i) / (n - 1));
      const yAt = (v) => PAD.t + ih - (v / max) * ih;
      let marks = "";
      if (barSeries) {
        const bw = Math.min(30, (iw / n) * 0.5);
        barSeries.values.forEach((v, i) => {
          if (v > 0) { const q = barDrill?.(i); marks += `<rect x="${(xAt(i) - bw / 2).toFixed(1)}" y="${yAt(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${((v / max) * ih).toFixed(1)}" style="fill:${barSeries.color}" opacity=".55" rx="2"${hit(q, `${labels[i]} ${barSeries.name}：${fmt(v)}，${t("查看明细")}`)}><title>${esc(labels[i])} ${esc(barSeries.name)}：${esc(fmt(v))}${tip(q)}</title></rect>`; }
        });
      }
      series.forEach((s) => {
        const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v || 0).toFixed(1)}`).join(" ");
        marks += `<polyline points="${pts}" style="fill:none;stroke:${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
        s.values.forEach((v, i) => {
          const q = drill?.(0, i);
          if (q) marks += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v || 0).toFixed(1)}" r="14" style="fill:transparent"${hit(q, `${labels[i]} ${s.name}：${fmt(v || 0)}，${t("查看明细")}`)}><title>${esc(labels[i])} ${esc(s.name)}：${esc(fmt(v || 0))}${tip(q)}</title></circle>`;   // 手机上点的是这个大一点的透明圈
          marks += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v || 0).toFixed(1)}" r="3.5" style="fill:${s.color};pointer-events:none"><title>${esc(labels[i])} ${esc(s.name)}：${esc(fmt(v || 0))}</title></circle>`;
        });
      });
      return axes(z, max, labels, fmt, xAt) + marks;
    };
    const allSeries = [...(barSeries ? [barSeries] : []), ...series];
    return `<figure class="chart">${both(title, draw)}
      ${legend(allSeries)}${table(labels, allSeries, fmt)}</figure>`;
  }

  /** 环形图（分类占比） */
  function donut({ items, fmt = String, title, center = "" }) {
    const total = items.reduce((a, x) => a + x.value, 0);
    const S = 220, R = 92, r = 58, cx = S / 2, cy = S / 2;
    let arcs = "";
    if (total > 0) {
      let a0 = -Math.PI / 2;
      items.forEach((it) => {
        if (it.value <= 0) return;
        const frac = it.value / total;
        if (frac >= 0.9999) {
          arcs += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" style="fill:none;stroke:${it.color}" stroke-width="${R - r}"${hit(it.drill, `${it.name}：${fmt(it.value)}，${t("查看明细")}`)}><title>${esc(it.name)}：${esc(fmt(it.value))}${tip(it.drill)}</title></circle>`;
          return;
        }
        const a1 = a0 + frac * Math.PI * 2, large = frac > 0.5 ? 1 : 0;
        const p = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)} ${(cy + rad * Math.sin(ang)).toFixed(2)}`;
        arcs += `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" style="fill:${it.color}"${hit(it.drill, `${it.name}：${fmt(it.value)}（${Math.round(frac * 100)}%），${t("查看明细")}`)}><title>${esc(it.name)}：${esc(fmt(it.value))}（${Math.round(frac * 100)}%）${tip(it.drill)}</title></path>`;
        a0 = a1;
      });
    } else {
      arcs = `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" class="ch-empty" stroke-width="${R - r}"/>`;
    }
    const rows = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value)
      .map((x) => `<li${x.drill ? ` class="ch-hit-row" data-drill="${esc(x.drill)}" role="link" tabindex="0" aria-label="${esc(x.name)}：${esc(fmt(x.value))}，${esc(t("查看明细"))}"` : ""}><i style="background:${x.color}"></i><span>${esc(x.name)}</span><b>${esc(fmt(x.value))}</b><em>${Math.round((x.value / total) * 100)}%</em>${x.drill ? '<u aria-hidden="true">›</u>' : ""}</li>`).join("");
    return `<figure class="chart donut-wrap">
      <svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(title)}">${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="ch-center">${esc(center)}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="ch-tick">${t("合计")}</text></svg>
      <ul class="donut-list">${rows || `<li class="muted">${t("这个月还没有花费记录")}</li>`}</ul></figure>`;
  }

  window.Charts = { bars, line, donut };
})();
