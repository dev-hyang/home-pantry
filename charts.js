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
  // labels 传入时先按标签宽度排版横轴（见 fitX），放不下就斜着排并加高画布底部
  const both = (title, draw, labels = null) => SIZES.map((z0) => {
    const z = labels ? fitX(z0, labels) : z0;
    return `<svg class="${z.cls}" viewBox="0 0 ${z.W} ${z.H}" role="img" aria-label="${esc(title)}">${draw(z)}</svg>`;
  }).join("");

  // 估算 12px 刻度字的宽度（中日韩字约一个字号宽，数字字母约 0.58 个字号）
  const textW = (s) => [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 0x2e80 ? 12 : /[A-Z0-9]/.test(c) ? 7.2 : 6.4), 0);
  const ROT = 40, SIN = Math.sin((ROT * Math.PI) / 180), COS = Math.cos((ROT * Math.PI) / 180);
  /** 横轴标签：横排放得下就横排（隔几个显示一个）；放不下就旋转 40°，按行距抽稀，画布底部加高，标签永不重叠 */
  function fitX(z, labels) {
    const n = labels.length;
    if (!n) return z;
    const iw = z.W - z.PAD.l - z.PAD.r, step = iw / n;          // 柱状图每格宽度；折线图间距略大，按小的算更稳妥
    const every = Math.ceil(n / z.maxLabels);
    const maxW = Math.min(110, Math.max(...labels.map(textW)));
    // 横排放得下就横排，并且尽量多显示（短标签如「10月」可以每个都显示）；1.5 倍：首尾标签贴边对齐时会往里多伸半个标签
    const everyH = Math.max(1, Math.ceil((maxW * 1.5 + 8) / step));
    if (everyH <= every) return { ...z, every: everyH, rot: false };
    const everyR = Math.max(1, Math.ceil(22 / step));            // 斜排后相邻两行至少隔 22 × sin40° ≈ 14px
    const b = Math.ceil(maxW * SIN + 12 * COS + 14);
    return { ...z, every: everyR, rot: true, H: z.H - z.PAD.b + b, PAD: { ...z.PAD, b } };
  }

  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  function axes(z, max, labels, fmt, xAt) {
    const { W, H, PAD, maxLabels } = z;
    const ih = H - PAD.t - PAD.b;
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const y = PAD.t + ih - (ih * i) / 4;
      g += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" class="ch-grid"/>`;
      g += `<text x="${PAD.l - 6}" y="${y + 4}" text-anchor="end" class="ch-tick">${esc(fmt((max * i) / 4, true))}</text>`;
    }
    const every = z.every || Math.ceil(labels.length / maxLabels), last = labels.length - 1;
    // 每隔 every 个显示一个；末尾标签总要显示，它和前一个挨得太近时让掉前一个
    const shown = labels.map((_, i) => i).filter((i) => i % every === 0);
    if (shown[shown.length - 1] !== last) { if (shown.length > 1) shown.pop(); shown.push(last); }
    if (z.rot) {   // 斜排：文字右端对齐刻度位置，往左下方斜
      const y = PAD.t + ih + 14;
      shown.forEach((i) => { const x = xAt(i).toFixed(1); g += `<text x="${x}" y="${y}" text-anchor="end" transform="rotate(-${ROT} ${x} ${y})" class="ch-tick">${esc(labels[i])}</text>`; });
      return g;
    }
    // 横排：居中放；伸出画布的首尾标签改为左 / 右对齐。再按实际占的宽度去掉会相碰的（末尾标签优先保留）
    const boxes = shown.map((i) => {
      const x = xAt(i), w = textW(labels[i]);
      const anchor = x - w / 2 < 2 ? "start" : x + w / 2 > W - 2 ? "end" : "middle";
      const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      return { i, x, anchor, x0, x1: x0 + w };
    });
    const kept = [];
    boxes.forEach((b) => {
      while (kept.length && kept[kept.length - 1].x1 + 6 > b.x0) { if (b.i === last) kept.pop(); else return; }
      kept.push(b);
    });
    kept.forEach((b) => { g += `<text x="${b.x}" y="${H - 10}" text-anchor="${b.anchor}" class="ch-tick">${esc(labels[b.i])}</text>`; });
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
    return `<figure class="chart">${both(title, draw, labels)}
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
    return `<figure class="chart">${both(title, draw, labels)}
      ${legend(allSeries)}${table(labels, allSeries, fmt)}</figure>`;
  }

  /** 环形图（分类占比） */
  const LIST_TOP = 20;   // 占比列表默认只列前 20 项，其余收在「显示更多」后面
  function donut({ items, fmt = String, title, center = "", stack = false }) {
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
    const pos = items.filter((x) => x.value > 0).sort((a, b) => b.value - a.value), extra = pos.length - LIST_TOP;
    const rows = pos
      .map((x, i) => `<li${x.drill ? ` class="ch-hit-row" data-drill="${esc(x.drill)}" role="link" tabindex="0" aria-label="${esc(x.name)}：${esc(fmt(x.value))}，${esc(t("查看明细"))}"` : ""}${i >= LIST_TOP ? " data-more hidden" : ""}><i style="background:${x.color}"></i><span>${esc(x.name)}</span><b>${esc(fmt(x.value))}</b><em>${Math.round((x.value / total) * 100)}%</em>${x.drill ? '<u aria-hidden="true">›</u>' : ""}</li>`).join("");
    const more = extra > 0 ? `<button type="button" class="btn btn-sm btn-ghost dl-toggle" aria-expanded="false" data-more-n="${extra}">${esc(t("显示更多（还有 {n} 项）").replace("{n}", extra))}</button>` : "";
    return `<figure class="chart donut-wrap${stack ? " donut-stack" : ""}">
      <svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(title)}">${arcs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="ch-center">${esc(center)}</text>
        <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="ch-tick">${t("合计")}</text></svg>
      <div class="donut-side"><ul class="donut-list">${rows || `<li class="muted">${t("这个月还没有花费记录")}</li>`}</ul>${more}</div></figure>`;
  }
  // 「显示更多 / 收起」：只切换本列表里第 21 项以后的行（图表 HTML 每次重画都是收起的）
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.(".dl-toggle"); if (!b) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.closest(".donut-side").querySelectorAll("li[data-more]").forEach((li) => { li.hidden = !open; });
    b.setAttribute("aria-expanded", String(open));
    b.textContent = open ? t("收起") : t("显示更多（还有 {n} 项）").replace("{n}", b.dataset.moreN);
  });

  window.Charts = { bars, line, donut };
})();
