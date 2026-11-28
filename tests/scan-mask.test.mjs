/* 截图遮盖：框的计算 */
import test from "node:test";
import assert from "node:assert/strict";
import { normRect, toImagePoint } from "../js/pantry/scan-mask-lib.js";

test("任意方向拖都得到同一个框；超出图片的部分被截掉", () => {
  assert.deepEqual(normRect(10, 20, 110, 70, 200, 100), { x: 10, y: 20, w: 100, h: 50 });
  assert.deepEqual(normRect(110, 70, 10, 20, 200, 100), { x: 10, y: 20, w: 100, h: 50 });
  assert.deepEqual(normRect(-30, -30, 50, 40, 200, 100), { x: 0, y: 0, w: 50, h: 40 });
  assert.deepEqual(normRect(150, 60, 400, 300, 200, 100), { x: 150, y: 60, w: 50, h: 40 });
});

test("太小的框（误触）丢掉", () => {
  assert.equal(normRect(10, 10, 12, 12, 200, 100), null);
  assert.equal(normRect(10, 10, 300, 11, 200, 100), null);
});

test("屏幕坐标换算成图片像素", () => {
  const box = { left: 100, top: 50, width: 200, height: 100 };   // 画布缩小显示：图 800×400 显示成 200×100
  assert.deepEqual(toImagePoint(200, 100, box, 800, 400), { x: 400, y: 200 });
  assert.deepEqual(toImagePoint(100, 50, box, 800, 400), { x: 0, y: 0 });
});
