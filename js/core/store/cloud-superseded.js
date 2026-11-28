/* 云端模式：被小票替换的对账单整笔（迁移 114 的 purchases_superseded 归档表）。
 * 替换 = 把那一笔从 purchases 搬进归档（花费统计只读 purchases，所以自然不再重复算）；撤销替换 = 搬回来。 */
const MISSING = /supersede_purchases|restore_superseded|purchases_superseded|schema cache|does not exist|could not find/i;

export const cloudSuperseded = {
  /** 把这些花费搬进归档；by = 替换它们的那张小票的花费 id。返回 { n, archived }：
   *  还没执行迁移 114 时没有归档表，退回成以前的直接删除（archived = false，调用方要提醒一句） */
  async supersedePurchases(ids, by = []) {
    if (!ids.length) return { n: 0, archived: true };
    const r = await this.sb.rpc("supersede_purchases", { p_household: this.hid, p_ids: ids, p_by: by });
    if (!r.error) return { n: r.data ?? ids.length, archived: true };
    if (!MISSING.test(r.error.message || "")) throw new Error(r.error.message);
    await this.deletePurchases(ids);
    return { n: ids.length, archived: false };
  },
  /** 撤销替换：归档里的搬回 purchases（原 id、原内容）；返回搬回几笔 */
  async restoreSuperseded(ids) {
    const r = await this.sb.rpc("restore_superseded", { p_household: this.hid, p_ids: ids });
    if (r.error) throw new Error(r.error.message);
    return r.data ?? ids.length;
  },
  /** 归档里的花费（某一批的，或全部）；没有归档表 = 空 */
  async listSuperseded(batch = null) {
    let q = this.sb.from("purchases_superseded").select("id,import_batch,amount,purchased_at,store,name,superseded_by,superseded_at").eq("household_id", this.hid);
    if (batch) q = q.eq("import_batch", batch);
    const r = await q.order("purchased_at", { ascending: false }).limit(500);
    if (r.error) { if (MISSING.test(r.error.message || "")) return []; throw new Error(r.error.message); }
    return r.data || [];
  },
  /** 一批对账单的归档行（只取 import_batch、amount 两列，对账单页的笔数 / 合计要加上它们才和导入时一样） */
  async supersededOfBatches(ids) {
    const r = await this.sb.from("purchases_superseded").select("import_batch,amount").eq("household_id", this.hid).in("import_batch", ids).limit(5000);
    return r.error ? [] : r.data || [];
  },
  async deleteSupersededByBatch(batch) { await this.sb.from("purchases_superseded").delete().eq("household_id", this.hid).eq("import_batch", batch); },
};
