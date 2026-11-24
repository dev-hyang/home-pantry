import test from "node:test";
import assert from "node:assert/strict";
import { isZero } from "../js/core/num-focus-lib.js";

test("零值会被选中", () => { for (const v of ["0", "0.0", "0.00", "00", "-0", ".0", " 0.00 ", 0]) assert.ok(isZero(v), String(v)); });
test("非零 / 空值不处理", () => { for (const v of ["", ".", "-", "0.01", "10", "12.50", null, undefined]) assert.ok(!isZero(v), String(v)); });
