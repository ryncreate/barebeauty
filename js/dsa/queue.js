// =====================================================================
// DATA STRUCTURE 2: QUEUE  (FIFO - First In, First Out)
// ---------------------------------------------------------------------
// Used by: js/modules/stock-manager.js  ->  pending stock adjustment requests
//
// Idea: requests are ENQUEUED at the back and DEQUEUED from the front, so
// the request that arrived first is always processed first.
//
// This queue is built from linked nodes (head + tail pointers) instead of
// Array.shift(), so BOTH enqueue and dequeue are O(1).
//
// Time complexity:  enqueue O(1) | dequeue O(1) | peek O(1)
// Space complexity: O(n) for n waiting items
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BareBeauty = root.BareBeauty || {}; root.BareBeauty.dsa = Object.assign(root.BareBeauty.dsa || {}, api); }
})(typeof window !== "undefined" ? window : globalThis, function () {

  class QueueNode {
    constructor(value) {
      this.value = value;
      this.next = null;      // pointer to the item behind this one
    }
  }

  class Queue {
    constructor() {
      this.head = null;   // FRONT of the line (next to be served)
      this.tail = null;   // BACK of the line (newest arrival)
      this.length = 0;
    }

    // Add an item at the back of the line.  O(1)
    enqueue(value) {
      const node = new QueueNode(value);
      if (this.tail) this.tail.next = node;
      else this.head = node;          // queue was empty
      this.tail = node;
      this.length += 1;
      return this.length;
    }

    // Remove and return the item at the front. Returns undefined when empty.  O(1)
    dequeue() {
      if (!this.head) return undefined;
      const node = this.head;
      this.head = node.next;
      if (!this.head) this.tail = null; // queue became empty
      this.length -= 1;
      return node.value;
    }

    // Look at the front item without removing it.  O(1)
    peek() {
      return this.head ? this.head.value : undefined;
    }

    // Does any waiting item satisfy the test? (walks the line once)  O(n)
    some(predicate) {
      for (let node = this.head; node; node = node.next) {
        if (predicate(node.value)) return true;
      }
      return false;
    }

    isEmpty() { return this.length === 0; }
    size() { return this.length; }
    clear() { this.head = null; this.tail = null; this.length = 0; }

    // Front-to-back copy as an array (for demos and tests).
    toArray() {
      const out = [];
      for (let node = this.head; node; node = node.next) out.push(node.value);
      return out;
    }
  }

  return { Queue };
});