// =====================================================================
// BARE BEAUTY INVENTORY MANAGEMENT SYSTEM (IMS)
// Inventory Management Module (Catalog, Search, Sort & Steppers)
// =====================================================================

window.BareBeauty = window.BareBeauty || {};
BareBeauty.modules = BareBeauty.modules || {};

// LINEAR SEARCH (js/dsa/algorithms.js): find one product by its database id.
function productById(id) {
  const products = BareBeauty.state.products;
  const index = BareBeauty.dsa.linearSearchFirst(products, (p) => p.id === Number(id));
  return index === -1 ? undefined : products[index];
}

// BINARY SEARCH TREE (js/dsa/bst.js): one node per product, keyed by Product ID.
// The tree is rebuilt only when the product list is replaced (loadProducts),
// not on every keystroke.
function getProductTree() {
  const state = BareBeauty.state;
  if (!state.productTree || state.productTreeSource !== state.products) {
    state.productTree = BareBeauty.dsa.BinarySearchTree.buildBalanced(state.products, (p) => p.productId);
    state.productTreeSource = state.products;
    // duplicates (ignoring upper/lower case) are not stored twice - note them so we can fall back safely
    state.productTree.duplicates = state.products.length - state.productTree.size();
  }
  return state.productTree;
}

// Does this product pass the Category and Status dropdown filters?
function passesFilters(product) {
  return (!BareBeauty.state.category || product.category === BareBeauty.state.category) &&
    (!BareBeauty.state.status || product.status === BareBeauty.state.status);
}

// How to order two products for the chosen "Sort" option.
function productComparator(sortValue) {
  const [field, order] = sortValue.split("-");
  const direction = order === "desc" ? -1 : 1;
  return (a, b) => {
    if (field === "price") return (a.price - b.price) * direction;
    if (field === "stock") return (a.stock - b.stock) * direction;
    if (field === "category") return a.category.localeCompare(b.category) || productLabel(a).localeCompare(productLabel(b));
    return productLabel(a).localeCompare(productLabel(b)) * direction;
  };
}

function filteredProducts() {
  const state = BareBeauty.state;
  const dsa = BareBeauty.dsa;
  const search = state.search.trim().toLowerCase();
  let result = null;
  let method = "none";
  let steps = 0;

  // 1) EXACT Product ID typed?  ->  BST SEARCH, about log2(n) steps for a balanced tree
  if (search && state.products.length) {
    const tree = getProductTree();
    if (tree.duplicates === 0) {
      const hit = tree.search(search);
      if (hit.found) {
        result = passesFilters(hit.value) ? [hit.value] : [];
        method = "bst";
        steps = hit.comparisons;
      }
    }
  }

  // 2) Anything else (part of a name, shade, type or ID, or no text)  ->  LINEAR SEARCH
  if (result === null) {
    const outcome = dsa.linearSearchAll(state.products, (product) => {
      const matchesSearch = !search || [
        product.name,
        product.productType,
        product.shade,
        product.productId,
      ].some((value) => value.toLowerCase().includes(search));
      return matchesSearch && passesFilters(product);
    });
    result = outcome.matches;
    method = search ? "linear" : "none";
    steps = outcome.comparisons;
  }

  state.lastSearch = { method, steps };

  // 3) Order the visible products with INSERTION SORT
  return dsa.insertionSort(result, productComparator(state.sort));
}

function productRow(product) {
  const label = escapeHtml(productLabel(product));
  return `<tr>
    ${productCell(product)}
    <td>${escapeHtml(product.category)}</td>
    <td>${money(product.price)}</td>
    <td><div class="qty-stepper">
      <button type="button" class="qty-btn" data-action="adjust" data-delta="-1" data-id="${product.id}" aria-label="Decrease quantity: ${label}" ${product.stock === 0 ? "disabled" : ""}>−</button>
      <input class="qty-input" type="number" min="0" step="1" inputmode="numeric" value="${product.stock}" data-id="${product.id}" aria-label="Quantity: ${label}" />
      <button type="button" class="qty-btn" data-action="adjust" data-delta="1" data-id="${product.id}" aria-label="Increase quantity: ${label}">+</button>
    </div></td>
    <td><span class="status ${statusClass(product.status)}">${escapeHtml(product.status)}</span></td>
    <td><div class="row-actions">
      <button class="mini-button" data-action="edit" data-id="${product.id}" aria-label="Edit: ${label}">Edit</button>
      <button class="mini-button danger" data-action="delete" data-id="${product.id}" aria-label="Delete: ${label}">Delete</button>
    </div></td>
  </tr>`;
}

function quantityInput(id) {
  return document.querySelector(`.qty-input[data-id="${id}"]`);
}

function refreshRow(id) {
  const input = quantityInput(id);
  const product = productById(id);
  if (!input || !product) return;
  const row = input.closest("tr");
  if (!pendingSaves.has(id)) input.value = product.stock;
  const shown = Number(input.value);
  const decBtn = row.querySelector('[data-delta="-1"]');
  if (decBtn) decBtn.disabled = !(shown > 0);
  const status = computeStatus(shown, product.reorderLevel);
  const pill = row.querySelector(".status");
  if (pill) {
    pill.className = `status ${statusClass(status)}`;
    pill.textContent = status;
  }
}

// 900ms debouncing for inline rapid stock stepper clicks
function adjustQuantity(id, delta) {
  const input = quantityInput(id);
  if (!input) return;
  const next = Number(input.value) + delta;
  if (!Number.isInteger(next) || next < 0) return;
  input.value = next;
  clearTimeout(pendingSaves.get(id));
  pendingSaves.set(id, window.setTimeout(() => saveQuantity(id), 900));
  refreshRow(id);
}

async function saveQuantity(id) {
  // a save for this product is still waiting in the queue: try again shortly instead of saving twice
  if (BareBeauty.stockManager.isBusyFor(id)) {
    clearTimeout(pendingSaves.get(id));
    pendingSaves.set(id, window.setTimeout(() => saveQuantity(id), 300));
    return;
  }
  clearTimeout(pendingSaves.get(id));
  pendingSaves.delete(id);
  const input = quantityInput(id);
  const product = productById(id);
  if (!input || !product) return;

  const value = Number(input.value);
  if (input.value === "" || !Number.isInteger(value) || value < 0) {
    refreshRow(id);
    showToast("Enter a whole number of 0 or more.", true);
    return;
  }
  if (value === product.stock) return refreshRow(id);

  const previousStatus = product.status;
  const difference = value - product.stock;
  try {
    // The change waits in the FIFO queue (js/modules/stock-manager.js) and is
    // saved through the atomic database function when its turn comes.
    const outcome = await BareBeauty.stockManager.requestAdjustment({
      productId: id,
      label: productLabel(product),
      type: difference > 0 ? "in" : "out",
      quantity: Math.abs(difference),
      baseStock: product.stock,
      note: "Quantity adjustment",
    });
    const updated = outcome.product;
    product.stock = updated.stock;
    product.status = updated.status;
    refreshRow(id);
    BareBeauty.navigation.refreshStatus();
    showToast(`Stock updated: ${productLabel(product)} now has ${plural(updated.stock, "unit")} in stock.`);
    if (outcome.concurrentChange) {
      showToast("Another session changed this product at the same time. Please check the quantity.", "warning");
    }
    if (updated.status !== previousStatus && updated.status !== "In Stock") {
      showToast(`${productLabel(product)} is now ${updated.status}.`, "warning");
    }
  } catch (error) {
    // Stock changed in another session: show the real quantity instead of the stale one.
    if (error.freshProduct) {
      product.stock = error.freshProduct.stock;
      product.status = error.freshProduct.status;
    }
    refreshRow(id);
    showToast(error.message, true);
  }
}

// UNDO (STACK, LIFO): reverse the most recent eligible stock change.
async function undoLast() {
  const button = document.getElementById("undoButton");
  if (button) button.disabled = true;
  try {
    await saveAllQuantities();                       // finish any typed-but-unsaved change first
    const outcome = await BareBeauty.stockManager.requestUndo();
    const updated = outcome.product;
    const product = productById(updated.id);
    if (product) {
      product.stock = updated.stock;
      product.status = updated.status;
    }
    updateInventoryTable();
    BareBeauty.navigation.refreshStatus();
    showToast(`Undo successful: ${outcome.undone.label} is back to ${plural(updated.stock, "unit")} in stock.`);
    if (outcome.skipped.length) {
      showToast(`Skipped ${plural(outcome.skipped.length, "newer change")} that could no longer be undone.`, "warning");
    }
    if (outcome.concurrentChange) {
      showToast("Another session changed this product at the same time. Please check the quantity.", "warning");
    }
  } catch (error) {
    showToast(error.message, true);
  } finally {
    refreshInventoryControls();
  }
}

// Keep the Undo button and the "pending" note in step with the manager.
function refreshInventoryControls() {
  const manager = BareBeauty.stockManager;
  const button = document.getElementById("undoButton");
  if (button) {
    const next = manager.nextUndo();
    button.disabled = !next || manager.pendingCount() > 0;
    button.title = next
      ? `Undo: ${next.label} (${next.type === "in" ? "stock in" : "stock out"} ${next.quantity})`
      : "Nothing to undo";
  }
  updateResultCount();
}

function updateResultCount() {
  const countEl = $("#resultCount");
  if (!countEl) return;
  const state = BareBeauty.state;
  const shown = state.shownCount ?? 0;
  let text = `Showing ${shown} of ${plural(state.products.length, "product")}`;
  const search = state.lastSearch;
  if (state.search.trim() && search) {
    if (search.method === "bst") text += ` · found by Product ID (BST search, ${plural(search.steps, "step")})`;
    else if (search.method === "linear") text += ` · linear search (${plural(search.steps, "check")})`;
  }
  const pending = BareBeauty.stockManager.pendingCount();
  if (pending > 0) text += ` · ${plural(pending, "stock change")} saving`;
  countEl.textContent = text;
}

async function saveAllQuantities() {
  await Promise.all([...pendingSaves.keys()].map(saveQuantity));
}

function updateInventoryTable() {
  const products = filteredProducts();
  const rowsEl = $("#productRows");
  if (rowsEl) {
    rowsEl.innerHTML = products.length
      ? products.map(productRow).join("")
      : `<tr><td colspan="6" class="empty">No products match these filters.</td></tr>`;
  }
  BareBeauty.state.shownCount = products.length;
  updateResultCount();
}

async function renderInventory() {
  const root = $("#inventoryPage");
  if (!root) return;
  try {
    await BareBeauty.navigation.loadProducts();
  } catch (error) {
    showPageError(root, error.message);
    return;
  }

  root.innerHTML = `<div class="toolbar">
      <input class="search" id="searchInput" type="search" aria-label="Search products" placeholder="Search products…" value="${escapeHtml(BareBeauty.state.search)}" />
      <select id="categoryFilter" aria-label="Filter by category"><option value="">All Categories</option>${BareBeauty.config.CATEGORIES.map((item) => `<option ${BareBeauty.state.category === item ? "selected" : ""}>${item}</option>`).join("")}</select>
      <select id="statusFilter" aria-label="Filter by stock status"><option value="">All Statuses</option>${["In Stock", "Low Stock", "Out of Stock"].map((item) => `<option ${BareBeauty.state.status === item ? "selected" : ""}>${item}</option>`).join("")}</select>
      <select id="sortSelect" aria-label="Sort products">${BareBeauty.config.SORT_OPTIONS.map(([value, name]) => `<option value="${value}" ${BareBeauty.state.sort === value ? "selected" : ""}>${name}</option>`).join("")}</select>
      <button type="button" class="mini-button" id="undoButton" data-action="undo" disabled title="Nothing to undo">Undo</button>
      <button class="button primary" data-action="create">＋ Add Product</button>
    </div>
    <p class="result-count small muted" id="resultCount"></p>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Products, scrollable">
      <table aria-label="Products">
        <thead><tr><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Quantity</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead>
        <tbody id="productRows"></tbody>
      </table>
    </div>`;

  updateInventoryTable();
  refreshInventoryControls();
}

// Update the Undo button / pending note whenever the queue or stack changes (subscribe once).
if (!BareBeauty.inventoryControlsSubscribed) {
  BareBeauty.inventoryControlsSubscribed = true;
  BareBeauty.stockManager.subscribe(refreshInventoryControls);
}

BareBeauty.modules.inventory = {
  render: renderInventory,
  updateTable: updateInventoryTable,
  filteredProducts,
  productRow,
  quantityInput,
  refreshRow,
  adjustQuantity,
  saveQuantity,
  saveAllQuantities,
  productById,
  undoLast,
  getProductTree,
};