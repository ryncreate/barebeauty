// =====================================================================
// BARE BEAUTY INVENTORY MANAGEMENT SYSTEM (IMS)
// Dashboard Statistics & Analytics Module
// =====================================================================

window.BareBeauty = window.BareBeauty || {};
BareBeauty.modules = BareBeauty.modules || {};

const numberText = (value) => new Intl.NumberFormat("en-PH").format(Number(value || 0));

// Clickable metric card -> opens Inventory (optionally filtered by status)
function simpleStat(label, value, tone = "", status = "", note = "") {
  return `<button type="button" class="stat-card simple ${tone}" data-stat-status="${escapeHtml(status)}" aria-label="${escapeHtml(label)}: ${escapeHtml(String(value))}. View in Inventory">
    <span class="stat-label">${label}</span>
    <strong>${value}</strong>
    ${note ? `<small class="stat-note">${note}</small>` : ""}
  </button>`;
}

// Category bar - click to open that category in Inventory
function dashboardCategoryRow(name, units, percent) {
  return `<button type="button" class="category-row category-link" data-category="${escapeHtml(name)}" aria-label="${escapeHtml(name)}: ${plural(units, "unit")}. View in Inventory">
    <span class="category-row-head"><span>${escapeHtml(name)}</span><span>${plural(units, "unit")} · ${percent}%</span></span>
    <span class="progress" aria-hidden="true"><span style="width:${percent}%"></span></span>
  </button>`;
}

// Products that need restocking (out of stock first, then lowest stock)
function restockHtml(items, total) {
  if (!items.length) {
    return `<div class="all-good"><span aria-hidden="true">✓</span><strong>All products are well stocked.</strong><small>Nothing needs restocking right now.</small></div>`;
  }
  const more = total > items.length ? `<p class="restock-more small muted">+ ${total - items.length} more need attention</p>` : "";
  return `<div class="restock-list">${items.map((item) => `
    <button type="button" class="restock-item" data-find="${escapeHtml(item.productId)}" aria-label="${escapeHtml(productLabel(item))}: ${item.stock} left. Open in Inventory">
      <span class="restock-text">
        <strong>${escapeHtml(productLabel(item))}</strong>
        <small>${escapeHtml(item.category)} · ${item.stock} left · reorder at ${item.reorderLevel}</small>
      </span>
      <span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
    </button>`).join("")}</div>${more}`;
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hourCycle: "h23", timeZone: BareBeauty.config.TIME_ZONE }).format(new Date()));
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: BareBeauty.config.TIME_ZONE }).format(new Date());
  return `<div class="dash-hero">
    <div>
      <p class="dash-date">${today}</p>
      <h2>${part}, ${escapeHtml(BareBeauty.config.ADMIN.name)}</h2>
      <p class="dash-sub">Here is how your stock looks today.</p>
    </div>
  </div>`;
}

async function renderDashboard() {
  const root = $("#dashboardPage");
  if (!root) return;
  if (!root.innerHTML.trim() || root.querySelector(".loading")) root.innerHTML = `<div class="loading" role="status">Loading…</div>`;

  try {
    const summary = await BareBeauty.api("/dashboard");
    const restock = summary.restock || [];
    const attention = summary.lowStock + summary.outOfStock;
    const value = summary.stockValue != null ? `Worth ${money(summary.stockValue)}` : "";

    root.innerHTML = `${greeting()}
      <div class="grid stats-grid">
        ${simpleStat("Total Products", numberText(summary.totalProducts), "", "", `Across ${plural(summary.categories.length, "category").replace("categorys", "categories")}`)}
        ${simpleStat("Units on Hand", numberText(summary.totalStock), "", "", value)}
        ${simpleStat("Low Stock", numberText(summary.lowStock), "warn", "Low Stock", "At or below reorder level")}
        ${simpleStat("Out of Stock", numberText(summary.outOfStock), "alert", "Out of Stock", "Needs restocking now")}
      </div>
      <div class="grid split-grid">
        <section class="panel panel-fill" aria-labelledby="catTitle">
          <div class="panel-title"><h2 id="catTitle">Stock by Category</h2><button type="button" class="link-button" data-go="categories">View All</button></div>
          <div class="category-list">${summary.categories.map((item) => dashboardCategoryRow(item.name, item.stock, Math.round((item.stock / Math.max(summary.totalStock, 1)) * 100))).join("")}</div>
        </section>
        <section class="panel" aria-labelledby="restockTitle">
          <div class="panel-title"><h2 id="restockTitle">Needs Restocking</h2><button type="button" class="link-button" data-go="inventory">View All</button></div>
          ${restockHtml(restock, attention)}
        </section>
      </div>`;
  } catch (error) {
    showPageError(root, error.message);
  }
}

BareBeauty.modules.dashboard = {
  render: renderDashboard,
  simpleStat,
  categoryRow: dashboardCategoryRow,
};