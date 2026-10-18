// =====================================================================
// BARE BEAUTY INVENTORY MANAGEMENT SYSTEM (IMS)
// Supabase Stock Transactions Service
// =====================================================================

window.BareBeauty = window.BareBeauty || {};
BareBeauty.services = BareBeauty.services || {};

// Format database row to frontend movement format
function formatDbMovement(row) {
  return {
    id: row.id,
    productId: row.sku || row.product_id,
    productName: row.product_name,
    type: row.transaction_type || row.type,
    quantity: Number(row.quantity),
    note: row.notes || row.note,
    previousStock: Number(row.previous_stock),
    stockAfter: Number(row.stock_after),
    performedBy: row.performed_by || BareBeauty.config.ADMIN.name,
    createdAt: row.created_at,
  };
}

BareBeauty.services.stock = {
  async adjust(productId, body) {
    const sb = BareBeauty.supabase.client;
    if (!sb) throw new Error("Supabase is not connected.");

    const quantity = Number(body.quantity);
    if (body.type !== "in" && body.type !== "out") throw new Error("Invalid stock movement.");
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Enter a whole number of 1 or more.");

    // Atomic RPC is mandatory: never fall back to non-atomic client-side writes.
    const { data, error } = await sb.rpc("process_stock_transaction", {
      p_product_id: productId,
      p_type: body.type,
      p_quantity: quantity,
      p_notes: body.note || null,
      p_performed_by: BareBeauty.config.ADMIN.name,
    });
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Stock update returned no data.");
    const updatedProduct = withStatus({
      id: data.id,
      productId: data.product_id,
      productType: data.product_type,
      name: data.name,
      shade: data.shade,
      category: data.category,
      price: Number(data.price),
      stock: Number(data.stock),
      reorderLevel: Number(data.reorder_level),
    });
    // The atomic function also returns the new transaction row. Keep it so the
    // Undo stack knows exactly which transaction a change created.
    const rawTransaction = data.transaction || data.movement || null;
    updatedProduct.transaction = rawTransaction ? formatDbMovement(rawTransaction) : null;
    return updatedProduct;
  },

  // Text written in the Notes column of a reversing (undo) transaction.
  undoNote(transactionId) {
    return `Undo of transaction #${transactionId}`;
  },

  // READ-ONLY: find one transaction by its id (null when it does not exist).
  async findTransaction(transactionId) {
    const sb = BareBeauty.supabase.client;
    if (!sb) throw new Error("Supabase is not connected.");
    const { data, error } = await sb.from("stock_transactions").select("*").eq("id", transactionId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? formatDbMovement(data) : null;
  },

  // READ-ONLY: has this transaction already been reversed by an undo?
  async findUndoOf(transactionId) {
    const sb = BareBeauty.supabase.client;
    if (!sb) throw new Error("Supabase is not connected.");
    const { data, error } = await sb.from("stock_transactions").select("id")
      .eq("notes", this.undoNote(transactionId)).limit(1);
    if (error) throw new Error(error.message);
    return Array.isArray(data) && data.length > 0;
  },

  async getHistory(limit = 50) {
    const sb = BareBeauty.supabase.client;
    if (!sb) throw new Error("Supabase is not connected.");

    const { data, error } = await sb.from("stock_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data.map(formatDbMovement);
  },
};