// =====================================================================
// DATA STRUCTURE 1: STACK  (LIFO - Last In, First Out)
// ---------------------------------------------------------------------
// Used by: js/modules/stock-manager.js  ->  Undo of stock adjustments
//
// Idea: every successful stock adjustment is PUSHED on the stack.
// Pressing "Undo" POPS the top item, which is always the MOST RECENT
// adjustment (the last one in is the first one out).
//
// Time complexity:  push O(1) | pop O(1) | peek O(1)
// Space complexity: O(n) for n stored items
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BareBeauty = root.BareBeauty || {}; root.BareBeauty.dsa = Object.assign(root.BareBeauty.dsa || {}, api); }
})(typeof window !== "undefined" ? window : globalThis, function () {

  class Stack {
    constructor(maxSize = Infinity) {
      this.items = [];          // the last element of the array is the TOP of the stack
      this.maxSize = maxSize;   // optional limit (oldest entries are dropped when full)
    }

    // Put an item on top of the stack.  O(1)
    push(item) {
      this.items.push(item);
      if (this.items.length > this.maxSize) this.items.shift(); // drop the oldest (bottom) item
      return this.items.length;
    }

    // Remove and return the top item (most recent). Returns undefined when empty.  O(1)
    pop() {
      return this.items.pop();
    }

    // Look at the top item without removing it.  O(1)
    peek() {
      return this.items[this.items.length - 1];
    }

    isEmpty() { return this.items.length === 0; }
    size() { return this.items.length; }
    clear() { this.items = []; }

    // Items from top (newest) to bottom (oldest) - handy for demos and tests.
    toArray() { return [...this.items].reverse(); }
  }

  return { Stack };
});