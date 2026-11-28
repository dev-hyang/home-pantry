/* 版本号规则：同一天 N + 1；新的一天从 1 */
import test from "node:test";
import assert from "node:assert/strict";
import { nextVersion } from "../scripts/bump-version.mjs";

test("同一天：序号 +1", () => { assert.equal(nextVersion("2026-11-28.35", "2026-11-28"), "2026-11-28.36"); });
test("新的一天：从 1 开始", () => { assert.equal(nextVersion("2026-11-28.35", "2026-11-29"), "2026-11-29.1"); });
test("当前版本号坏了：按今天从 1 开始", () => { assert.equal(nextVersion("oops", "2026-11-29"), "2026-11-29.1"); });
