// =====================================================================
// ALGORITHMS
// ---------------------------------------------------------------------
// 1. linearSearchAll / linearSearchFirst  - Linear Search
// 2. insertionSort                        - Insertion Sort
// 3. BST Search                           - BinarySearchTree.search() in bst.js
// 4. processQueueFIFO                     - FIFO Queue Processing
// =====================================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else { root.BareBeauty = root.BareBeauty || {}; root.BareBeauty.dsa = Object.assign(root.BareBeauty.dsa || {}, api); }
})(typeof window !== "undefined" ? window : globalThis, function () {

  // ---------------------------------------------------------------
  // ALGORITHM 1: LINEAR SEARCH
  // Check every item, one after another, from the first to the last.
  // Works on unsorted data and on partial matches (e.g. part of a name).
  // Time: O(n) | Space: O(1) extra (O(k) for the k matches returned)
  // ---------------------------------------------------------------
  function linearSearchAll(items, isMatch) {
    const matches = [];
    let comparisons = 0;
    for (let i = 0; i < items.length; i++) {
      comparisons += 1;
      if (isMatch(items[i])) matches.push(items[i]);
    }
    return { matches, comparisons };
  }

  // Same idea but stops at the FIRST match.  Returns the index or -1.
  function linearSearchFirst(items, isMatch) {
    for (let i = 0; i < items.length; i++) {
      if (isMatch(items[i])) return i;
    }
    return -1;
  }

  // ---------------------------------------------------------------
  // ALGORITHM 2: INSERTION SORT
  // Grow a sorted section at the left. Take the next item and slide it
  // left past every bigger item until it sits in the right place.
  // Stable (equal items keep their order). Works on a COPY of the array.
  // Time: O(n^2) worst/average, O(n) when already sorted | Space: O(n) for the copy
  // ---------------------------------------------------------------
  function insertionSort(items, compare) {
    const sorted = [...items];
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      let j = i - 1;
      while (j >= 0 && compare(sorted[j], current) > 0) {
        sorted[j + 1] = sorted[j];   // shift the bigger item to the right
        j -= 1;
      }
      sorted[j + 1] = current;       // drop the item into its place
    }
    return sorted;
  }

  // ---------------------------------------------------------------
  // ALGORITHM 3: BST SEARCH  ->  see BinarySearchTree.search() in bst.js
  // ---------------------------------------------------------------

  // ---------------------------------------------------------------
  // ALGORITHM 4: FIFO QUEUE PROCESSING
  // Repeatedly take the request at the FRONT of the queue and finish it
  // completely (await) before taking the next one, so requests are handled
  // strictly one at a time, in arrival order. A failing request is reported
  // through onError and does NOT stop the requests behind it.
  // Time: O(n) for n requests (plus the time each handler takes) | Space: O(1)
  // ---------------------------------------------------------------
  async function processQueueFIFO(queue, handler, onError) {
    const results = [];
    while (!queue.isEmpty()) {
      const request = queue.dequeue();          // FIFO: oldest request first
      try {
        results.push({ request, ok: true, result: await handler(request) });
      } catch (error) {
        results.push({ request, ok: false, error });
        if (onError) onError(error, request);
      }
    }
    return results;
  }

  return { linearSearchAll, linearSearchFirst, insertionSort, processQueueFIFO };
});