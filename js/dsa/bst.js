// =====================================================================
// DATA STRUCTURE 4: BINARY SEARCH TREE (BST)
// ---------------------------------------------------------------------
// Used by: js/modules/inventory.js  ->  find a product by its Product ID
//
// Rule of a BST: for every node, all keys in the LEFT subtree are smaller
// and all keys in the RIGHT subtree are larger. So each comparison lets
// the search throw away one whole side of the tree.
//
// Time complexity (h = height of the tree, n = number of products):
//   insert / search ..... O(h)
//   balanced tree ....... h is about log2(n)  ->  O(log n)
//   WORST CASE .......... items inserted in sorted order make the tree a
//                         straight line, h = n  ->  O(n)  (same as a list)
// This is a plain BST: it does NOT rebalance itself. buildBalanced()
// below inserts the middle item first so a freshly built tree is balanced,
// but later insert() calls can make it uneven again.
// Space complexity: O(n)
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BareBeauty = root.BareBeauty || {}; root.BareBeauty.dsa = Object.assign(root.BareBeauty.dsa || {}, api); }
})(typeof window !== "undefined" ? window : globalThis, function () {

  class BSTNode {
    constructor(key, value) {
      this.key = key;      // the Product ID (normalized, e.g. "eye-el-001")
      this.value = value;  // the whole product record
      this.left = null;    // subtree with SMALLER keys
      this.right = null;   // subtree with LARGER keys
    }
  }

  // Product IDs are unique, and compared without caring about upper/lower case.
  const normalizeKey = (key) => String(key ?? "").trim().toLowerCase();

  class BinarySearchTree {
    constructor() {
      this.root = null;
      this.count = 0;
    }

    // Insert a node. Returns true if added, false if the key already exists
    // (Product IDs are unique, so duplicates are rejected).  O(h)
    insert(key, value) {
      const k = normalizeKey(key);
      const node = new BSTNode(k, value);
      if (!this.root) {
        this.root = node;
        this.count = 1;
        return true;
      }
      let current = this.root;
      while (true) {
        if (k === current.key) return false;            // duplicate -> reject
        if (k < current.key) {
          if (!current.left) { current.left = node; break; }
          current = current.left;                         // go LEFT (smaller)
        } else {
          if (!current.right) { current.right = node; break; }
          current = current.right;                        // go RIGHT (larger)
        }
      }
      this.count += 1;
      return true;
    }

    // BST SEARCH ALGORITHM.
    // Returns { found, value, comparisons } - "comparisons" shows how many
    // nodes were visited, which is useful to demonstrate O(h).  O(h)
    search(key) {
      const k = normalizeKey(key);
      let current = this.root;
      let comparisons = 0;
      while (current) {
        comparisons += 1;
        if (k === current.key) return { found: true, value: current.value, comparisons };
        current = k < current.key ? current.left : current.right;
      }
      return { found: false, value: null, comparisons };
    }

    // Height = number of levels (empty tree = 0, one node = 1).  O(n)
    height(node = this.root) {
      if (!node) return 0;
      return 1 + Math.max(this.height(node.left), this.height(node.right));
    }

    // In-order walk (left, node, right) returns keys in sorted order.  O(n)
    inOrder() {
      const out = [];
      const walk = (node) => {
        if (!node) return;
        walk(node.left);
        out.push(node.key);
        walk(node.right);
      };
      walk(this.root);
      return out;
    }

    size() { return this.count; }
    isEmpty() { return this.count === 0; }
    clear() { this.root = null; this.count = 0; }

    // Build a tree from many records. The records are sorted first and the
    // MIDDLE one is inserted first (then the middle of each half), which gives
    // a balanced tree, height about log2(n).  O(n log n) for the sort.
    static buildBalanced(items, keyOf) {
      const tree = new BinarySearchTree();
      const sorted = [...items].sort((a, b) => {
        const ka = normalizeKey(keyOf(a)), kb = normalizeKey(keyOf(b));
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      const addRange = (low, high) => {
        if (low > high) return;
        const mid = Math.floor((low + high) / 2);
        tree.insert(keyOf(sorted[mid]), sorted[mid]);
        addRange(low, mid - 1);
        addRange(mid + 1, high);
      };
      addRange(0, sorted.length - 1);
      return tree;
    }
  }

  return { BSTNode, BinarySearchTree, normalizeProductKey: normalizeKey };
});