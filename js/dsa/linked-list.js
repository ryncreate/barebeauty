// =====================================================================
// DATA STRUCTURE 3: DOUBLY LINKED LIST
// ---------------------------------------------------------------------
// Used by: js/modules/history.js  ->  inventory movement history
//
// Each movement is stored in a NODE that points to the node before it
// (prev) and the node after it (next). The list keeps the newest movement
// at the HEAD and the oldest at the TAIL, so it can be walked in either
// direction without using array indexes.
//
// Time complexity:
//   prepend / append ............ O(1)
//   removeNode (given the node) . O(1)
//   find / filter / traverse .... O(n)
// Space complexity: O(n)
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BareBeauty = root.BareBeauty || {}; root.BareBeauty.dsa = Object.assign(root.BareBeauty.dsa || {}, api); }
})(typeof window !== "undefined" ? window : globalThis, function () {

  class ListNode {
    constructor(data) {
      this.data = data;   // the movement record
      this.prev = null;   // node before (newer side)
      this.next = null;   // node after  (older side)
    }
  }

  class DoublyLinkedList {
    constructor() {
      this.head = null;   // first node (newest movement)
      this.tail = null;   // last node (oldest movement)
      this.length = 0;
    }

    // Insert a new node at the FRONT of the list.  O(1)
    prepend(data) {
      const node = new ListNode(data);
      node.next = this.head;
      if (this.head) this.head.prev = node;
      else this.tail = node;            // list was empty
      this.head = node;
      this.length += 1;
      return node;
    }

    // Insert a new node at the END of the list.  O(1)
    append(data) {
      const node = new ListNode(data);
      node.prev = this.tail;
      if (this.tail) this.tail.next = node;
      else this.head = node;            // list was empty
      this.tail = node;
      this.length += 1;
      return node;
    }

    // Unlink one node by rewiring its neighbours.  O(1)
    removeNode(node) {
      if (!node) return null;
      if (node.prev) node.prev.next = node.next; else this.head = node.next;
      if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
      node.prev = null;
      node.next = null;
      this.length -= 1;
      return node.data;
    }

    // Walk head -> tail, calling visit(data, index) for every node.  O(n)
    traverseForward(visit) {
      let index = 0;
      for (let node = this.head; node; node = node.next) visit(node.data, index++);
    }

    // Walk tail -> head (oldest to newest).  O(n)
    traverseBackward(visit) {
      let index = 0;
      for (let node = this.tail; node; node = node.prev) visit(node.data, index++);
    }

    // First node whose data passes the test, or null.  O(n)
    find(predicate) {
      for (let node = this.head; node; node = node.next) {
        if (predicate(node.data)) return node;
      }
      return null;
    }

    // Collect every record that passes the test, newest first.  O(n)
    filter(predicate) {
      const out = [];
      for (let node = this.head; node; node = node.next) {
        if (predicate(node.data)) out.push(node.data);
      }
      return out;
    }

    // Newest-to-oldest array copy (used when the page needs an array).  O(n)
    toArray() {
      const out = [];
      this.traverseForward((data) => out.push(data));
      return out;
    }

    // Build a list from an array that is already ordered newest -> oldest.  O(n)
    static fromArray(items) {
      const list = new DoublyLinkedList();
      for (const item of items) list.append(item);
      return list;
    }

    size() { return this.length; }
    isEmpty() { return this.length === 0; }
    clear() { this.head = null; this.tail = null; this.length = 0; }
  }

  return { ListNode, DoublyLinkedList };
});