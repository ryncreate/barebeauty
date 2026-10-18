// =====================================================================
// STOCK ADJUSTMENT MANAGER  (Queue + Stack working together)
// ---------------------------------------------------------------------
//   QUEUE  (FIFO) - pending stock adjustment requests wait here and are
//                   processed one at a time, oldest first.
//   STACK  (LIFO) - every successful adjustment is pushed here, so "Undo"
//                   always reverses the most recent one.
//
// Every real stock change still goes through the EXISTING atomic database
// function (process_stock_transaction) via deps.adjust(). This file never
// updates the database directly.
//
// Works in the browser (BareBeauty.stockManager) and in Node (for tests):
// all outside services are passed in through "deps".
// =====================================================================
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("../dsa/stack.js") : root.BareBeauty.dsa,
    typeof module === "object" && module.exports ? require("../dsa/queue.js") : root.BareBeauty.dsa,
    typeof module === "object" && module.exports ? require("../dsa/algorithms.js") : root.BareBeauty.dsa
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.BareBeauty = root.BareBeauty || {};
    root.BareBeauty.createStockManager = api.createStockManager;
    // The real manager used by the screens. Every stock change goes through the
    // existing gateway -> stock service -> atomic database function.
    root.BareBeauty.stockManager = api.createStockManager({
      adjust: (id, body) => root.BareBeauty.api(`/products/${id}/stock`, { method: "POST", body: JSON.stringify(body) }),
      fetchProduct: (id) => root.BareBeauty.services.product.getById(id),       // read-only
      findTransaction: (id) => root.BareBeauty.services.stock.findTransaction(id), // read-only
      findUndoOf: (id) => root.BareBeauty.services.stock.findUndoOf(id),           // read-only
      undoNote: (id) => root.BareBeauty.services.stock.undoNote(id),
    });
  }
})(typeof window !== "undefined" ? window : globalThis, function (stackLib, queueLib, algoLib) {

  const { Stack } = stackLib;
  const { Queue } = queueLib;
  const { processQueueFIFO } = algoLib;

  // Error raised when the stock in the database is not what the screen assumed.
  class StaleStockError extends Error {
    constructor(message, freshProduct) {
      super(message);
      this.name = "StaleStockError";
      this.freshProduct = freshProduct || null;
    }
  }

  function createStockManager(deps) {
    const queue = new Queue();            // pending requests (FIFO)
    const undoStack = new Stack(25);      // successful adjustments (LIFO), newest on top
    const activeProducts = new Set();     // products that already have a request waiting / running
    const listeners = [];
    let processing = false;               // true while the FIFO loop is running (loop control only)
    let inFlight = 0;                     // requests being worked on right now (0 or 1)
    let undoActive = false;               // true while an undo request is waiting / running
    let requestCounter = 0;
    let generation = 0;                   // changes on reset() so late results from an old session are ignored

    const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* UI errors must not break stock logic */ } });

    // ---- helpers -----------------------------------------------------
    const labelOf = (product) => `${product.name} · ${product.shade}`;
    const undoNote = (id) => (deps.undoNote ? deps.undoNote(id) : `Undo of transaction #${id}`);

    // ---- PUBLIC: ask for a stock adjustment ---------------------------
    // request = { productId, label, type: "in"|"out", quantity, baseStock, note }
    // baseStock = the stock the user saw on screen when making the change.
    function requestAdjustment(request) {
      if (undoActive) return Promise.reject(new Error("An undo is in progress. Please wait a moment."));
      if (activeProducts.has(request.productId)) {
        return Promise.reject(new Error("A stock change for this product is already waiting. Please wait a moment."));
      }
      if (request.type !== "in" && request.type !== "out") return Promise.reject(new Error("Invalid stock movement."));
      if (!Number.isInteger(request.quantity) || request.quantity < 1) {
        return Promise.reject(new Error("Enter a whole number of 1 or more."));
      }

      return new Promise((resolve, reject) => {
        activeProducts.add(request.productId);                 // blocks duplicates for this product
        queue.enqueue({ id: ++requestCounter, kind: "adjust", request, resolve, reject });
        notify();
        runQueue();
      });
    }

    // ---- PUBLIC: undo the most recent eligible adjustment -------------
    function requestUndo() {
      if (undoActive) return Promise.reject(new Error("An undo is already in progress."));
      if (activeProducts.size > 0 || inFlight > 0 || !queue.isEmpty()) {
        return Promise.reject(new Error("Please wait for the pending stock changes to finish before undoing."));
      }
      if (undoStack.isEmpty()) return Promise.reject(new Error("There is nothing to undo."));

      return new Promise((resolve, reject) => {
        undoActive = true;
        queue.enqueue({ id: ++requestCounter, kind: "undo", resolve, reject });
        notify();
        runQueue();
      });
    }

    // ---- the FIFO loop (uses processQueueFIFO from algorithms.js) -----
    function runQueue() {
      if (processing) return;
      processing = true;
      notify();
      processQueueFIFO(queue, handleRequest).finally(() => {
        processing = false;
        notify();
        if (!queue.isEmpty()) runQueue();    // something arrived at the very end
      });
    }

    async function handleRequest(item) {
      inFlight += 1;
      try {
        const outcome = item.kind === "undo" ? await executeUndo() : await executeAdjustment(item.request);
        item.resolve(outcome);
        return outcome;
      } catch (error) {
        item.reject(error);
        throw error;                            // processQueueFIFO records it and moves on
      } finally {
        inFlight -= 1;
        if (item.kind === "adjust") activeProducts.delete(item.request.productId);
        else undoActive = false;
        notify();
      }
    }

    // ---- one stock adjustment ------------------------------------------
    async function executeAdjustment(req) {
      const startedIn = generation;
      // 1. Read the CURRENT stock from the database (it may have changed in another session).
      const fresh = await deps.fetchProduct(req.productId);
      if (!fresh) throw new Error("This product no longer exists.");

      // 2. Stale data check: stock must still be what the user saw.
      if (fresh.stock !== req.baseStock) {
        throw new StaleStockError(
          `Stock for ${req.label} is now ${fresh.stock} (it was ${req.baseStock} when you made this change), ` +
          "so it was not applied. Please review and try again.",
          fresh
        );
      }
      if (req.type === "out" && req.quantity > fresh.stock) {
        throw new Error(`Only ${fresh.stock} units are in stock.`);
      }

      // 3. Save through the existing ATOMIC database function.
      const updated = await deps.adjust(req.productId, { type: req.type, quantity: req.quantity, note: req.note || null });
      const tx = updated.transaction || null;

      // 4. Remember it on the Undo stack (LIFO) - only if the database gave us a transaction id.
      if (tx && tx.id != null && startedIn === generation) {
        undoStack.push({
          transactionId: tx.id,
          productId: req.productId,
          label: req.label,
          type: req.type,
          quantity: req.quantity,
          stockBefore: tx.previousStock,
          stockAfter: tx.stockAfter,
          at: Date.now(),
        });
      }
      const concurrent = tx && tx.previousStock !== req.baseStock;   // another session slipped in between
      return { product: updated, transaction: tx, concurrentChange: Boolean(concurrent) };
    }

    // ---- one undo --------------------------------------------------------
    async function executeUndo() {
      const skipped = [];

      // Look at the stack from the top (newest) and skip records that are no longer safe to reverse.
      while (!undoStack.isEmpty()) {
        const record = undoStack.peek();
        const problem = await checkUndoRecord(record);
        if (problem) {
          undoStack.pop();                                   // discard the unusable record
          skipped.push(`${record.label}: ${problem}`);
          continue;
        }

        undoStack.pop();                                     // LIFO: take the newest eligible record
        try {
          // Reversing transaction through the same atomic function (history is never edited or deleted).
          const reverseType = record.type === "in" ? "out" : "in";
          const updated = await deps.adjust(record.productId, {
            type: reverseType,
            quantity: record.quantity,
            note: undoNote(record.transactionId),
          });
          const tx = updated.transaction || null;
          return {
            product: updated,
            transaction: tx,
            undone: record,
            skipped,
            concurrentChange: Boolean(tx && tx.previousStock !== record.stockAfter),
          };
        } catch (error) {
          undoStack.push(record);                            // put it back so the user can try again
          throw error;
        }
      }

      const detail = skipped.length ? ` (${skipped.join("; ")})` : "";
      throw new Error(`Nothing could be undone${detail}`);
    }

    // Returns a text reason when the record can NOT be reversed safely, otherwise null.
    async function checkUndoRecord(record) {
      const fresh = await deps.fetchProduct(record.productId);
      if (!fresh) return "the product no longer exists.";
      if (fresh.stock !== record.stockAfter) {
        return `stock changed to ${fresh.stock} since that change (expected ${record.stockAfter}).`;
      }
      const original = await deps.findTransaction(record.transactionId);
      if (!original) return "the original transaction was not found.";
      const alreadyUndone = await deps.findUndoOf(record.transactionId);
      if (alreadyUndone) return "it was already undone.";
      return null;
    }

    // ---- status for the screen ---------------------------------------------
    function isBusyFor(productId) { return undoActive || activeProducts.has(productId); }
    function pendingCount() { return queue.size() + inFlight; }
    function nextUndo() { return undoStack.peek() || null; }
    function undoCount() { return undoStack.size(); }
    function subscribe(fn) { listeners.push(fn); }

    // Used when signing out: forget everything so another user cannot undo this session's changes.
    function reset() {
      while (!queue.isEmpty()) {
        const item = queue.dequeue();
        item.reject(new Error("Cancelled."));
      }
      activeProducts.clear();
      undoStack.clear();
      undoActive = false;
      generation += 1;
      notify();
    }

    return {
      requestAdjustment, requestUndo, isBusyFor, pendingCount, nextUndo, undoCount, subscribe, reset,
      // exposed for tests / demos
      _queue: queue, _undoStack: undoStack,
    };
  }

  return { createStockManager, StaleStockError };
});