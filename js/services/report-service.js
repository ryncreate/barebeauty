// =====================================================================
// BARE BEAUTY INVENTORY MANAGEMENT SYSTEM (IMS)
// Supabase Report & Dashboard Aggregation Service
// =====================================================================

window.BareBeauty = window.BareBeauty || {};
BareBeauty.services = BareBeauty.services || {};

BareBeauty.services.report = {
  async getDashboardSummary() {
    const products = await BareBeauty.services.product.getAll();

    return {
      totalProducts: products.length,
      totalStock: products.reduce((sum, p) => sum + p.stock, 0),
      lowStock: products.filter((p) => p.status === "Low Stock").length,
      outOfStock: products.filter((p) => p.status === "Out of Stock").length,
      categories: BareBeauty.config.CATEGORIES.map((name) => ({
        name,
        stock: products.filter((p) => p.category === name).reduce((sum, p) => sum + p.stock, 0),
      })),
      stockValue: products.reduce((sum, p) => sum + p.price * p.stock, 0),
      // products that need restocking: out of stock first, then the lowest stock
      restock: products
        .filter((p) => p.status !== "In Stock")
        .sort((a, b) => (a.status === b.status ? a.stock - b.stock : a.status === "Out of Stock" ? -1 : 1))
        .slice(0, 6),
    };
  },
};