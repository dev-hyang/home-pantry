/* 截图遮盖：框的计算（纯函数，不碰页面，方便测试）。坐标都是图片自己的像素。 */
export const MIN_SIDE = 6;   // 比这更小的框当成误触，丢掉

/** 两个拖动点 → 落在图片范围内的框 {x, y, w, h}；太小返回 null */
export function normRect(ax, ay, bx, by, imgW, imgH) {
  const cl = (v, m) => Math.max(0, Math.min(m, v));
  const x0 = cl(Math.min(ax, bx), imgW), x1 = cl(Math.max(ax, bx), imgW);
  const y0 = cl(Math.min(ay, by), imgH), y1 = cl(Math.max(ay, by), imgH);
  const w = x1 - x0, h = y1 - y0;
  return w < MIN_SIDE || h < MIN_SIDE ? null : { x: x0, y: y0, w, h };
}

/** 屏幕上的点 → 图片像素。box = 画布在屏幕上的 {left, top, width, height} */
export const toImagePoint = (clientX, clientY, box, imgW, imgH) => ({
  x: ((clientX - box.left) / (box.width || 1)) * imgW,
  y: ((clientY - box.top) / (box.height || 1)) * imgH,
});
