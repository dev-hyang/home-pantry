/* 演示模式：被小票替换的对账单整笔（和云端的 purchases_superseded 归档表同一个意思，存在 db.purchases_superseded）。 */
export const demoSuperseded = {
  async supersedePurchases(ids, by = []) {
    const set = new Set(ids), moved = this.db.purchases.filter((p) => set.has(p.id));
    this.db.purchases_superseded ||= [];
    for (const p of moved) this.db.purchases_superseded.push({ id: p.id, data: { ...p }, import_batch: p.import_batch || null, import_key: p.import_key || null, amount: p.amount, purchased_at: p.purchased_at, card_id: p.card_id || null, store: p.store, name: p.name, superseded_by: by, superseded_at: new Date().toISOString() });
    this.db.purchases = this.db.purchases.filter((p) => !set.has(p.id)); this.persist();
    return { n: moved.length, archived: true };
  },
  async restoreSuperseded(ids) {
    const set = new Set(ids), back = (this.db.purchases_superseded || []).filter((s) => set.has(s.id));
    this.db.purchases.push(...back.map((s) => s.data));
    this.db.purchases_superseded = (this.db.purchases_superseded || []).filter((s) => !set.has(s.id)); this.persist();
    return back.length;
  },
  async listSuperseded(batch = null) { return (this.db.purchases_superseded || []).filter((s) => !batch || s.import_batch === batch).map((s) => ({ ...s })); },
  async supersededOfBatches(ids) { const w = new Set(ids); return (this.db.purchases_superseded || []).filter((s) => w.has(s.import_batch)).map((s) => ({ import_batch: s.import_batch, amount: s.amount })); },
  async deleteSupersededByBatch(batch) { this.db.purchases_superseded = (this.db.purchases_superseded || []).filter((s) => s.import_batch !== batch); this.persist(); },
};
