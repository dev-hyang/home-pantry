import test from "node:test";
import assert from "node:assert/strict";
import { shouldSelect } from "../js/core/num-focus-lib.js";

test("有内容就选中（零和非零一样）", () => { for (const v of ["0", "0.00", "12.50", "100", " 3 ", 0, 7]) assert.ok(shouldSelect(v), String(v)); });
test("空框不处理", () => { for (const v of ["", "  ", null, undefined]) assert.ok(!shouldSelect(v), String(v)); });
