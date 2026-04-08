# A bitmap is not an image format only

## How a simple data structure saved us from OOM errors while grouping 1M items in Node.js

A few weeks ago I was working on a data pipeline that had to process around one million JSON objects and group them by a combination of attributes. The kind of task you'd expect to be straightforward — until the process started crashing with `JavaScript heap out of memory` errors 😱

The fix turned out to be surprisingly elegant and involved a data structure that most people only associate with image files: a **bitmap**.

So, would you like to learn how a bunch of zeros and ones can save your server from running out of memory? Let's dive in.

## The dataset

Imagine you receive a stream of roughly 1.000.000 objects that look like this:

```json
{ "id": 42, "shape": "circle", "color": "red", "size": "small" }
```

Each field (`shape`, `color`, and `size`) can only take values from a predefined set:

```js
const shapes = ["circle", "square", "triangle", "hexagon", "star"]; // 5
const colors = ["red", "blue", "green", "yellow", "purple", "orange"]; // 6
const sizes = ["small", "medium", "large", "xlarge"]; // 4
```

That gives us **5 × 6 × 4 = 120** unique combinations at most.
The goal is to group the dataset by these combinations and, for each group, know:

1. How many items belong to it (`count`)
2. Which items belong to it

Sounds simple, right? Let's start with the most natural approach.

## The baseline: naive groupBy

The first implementation is what any reasonable engineer would write.
Loop through the items, build a key from the three attributes, and accumulate results in a `Map`:

```js
function naiveGroupBy(items) {
  const groups = new Map();

  for (const item of items) {
    const key = `${item.shape}:${item.color}:${item.size}`;

    if (!groups.has(key)) {
      groups.set(key, {
        shape: item.shape,
        color: item.color,
        size: item.size,
        count: 0,
        items: [],
      });
    }

    const group = groups.get(key);
    group.count++;
    group.items.push(item);
  }

  return [...groups.values()];
}
```

This is clean, readable, and runs in **O(n)** time. What could possibly go wrong?

### The memory problem

The issue hides in this innocent line:

```js
group.items.push(item);
```

For each of the 1.000.000 items, we push a reference into an array. While we're not creating new objects, that's still 1 million entries across 120 arrays, and V8 arrays grow by doubling their backing store, so they over-allocate.

On my machine, this approach uses roughly **~34 MB** of heap just for the grouping result, on top of the ~80 MB the original dataset already occupies. Add a couple more similar operations and you get the dreaded:

```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

We need a way to represent "which items belong to each group" without storing a million objects.

## Enter the bitmap

A **bitmap** (also known as a **bitset** or **bit array**) is one of the simplest data structures in computer science. It is an array of bits, zeros and ones, where each bit position represents the presence or absence of an element.

If you've only heard "bitmap" in the context of BMP image files, here's the connection: a `.bmp` file stores image data as a map of bits (pixels). But using individual bits to represent membership is a general-purpose technique that has nothing to do with images.

### Why bitmaps work here

Instead of storing arrays of `{ id }` objects, we can assign **one bit per item** in a fixed-length bit array:

- Bit at position `i` is `1` → item `i` has this attribute value
- Bit at position `i` is `0` → item `i` does not have this attribute value

The key insight is that we don't need one bitmap per *combination*. We need one bitmap per **individual attribute value**: one for "circle", one for "red", one for "small", and so on. That's only **5 + 6 + 4 = 15 bitmaps** instead of 120.

To find "red circles of size small", we simply **intersect** (bitwise AND) three bitmaps. Modern CPUs execute bitwise AND on 32 bits in a single clock cycle, so we check 32 items at once!

For 1.000.000 items, each bitmap takes `1.000.000 bits ÷ 8 = 125.000 bytes ≈ 122 KB`. With 15 bitmaps, the total is just **~1.8 MB**, compared to the naive approach's ~54 MB. The bitmap memory is **fixed** and **predictable**, unlike JavaScript arrays that fragment the heap.

Since each bitmap represents a single attribute value independently, you can answer **any combination query** on the fly. Want all red items? Just read the "red" bitmap. Want red circles? Intersect "red" AND "circle". This flexibility comes for free.

### Implementing bitmaps in Node.js

JavaScript doesn't have a native bit array, but we can use `Uint32Array`, a typed array where each element is a 32-bit unsigned integer. Each integer holds 32 bits, so we need `Math.ceil(totalItems / 32)` elements:

```js
function createBitmap(totalItems) {
  return new Uint32Array(Math.ceil(totalItems / 32));
}
```

Setting a bit requires two operations: find the right 32-bit slot and flip the right bit within it:

```js
function setBit(bitmap, index) {
  // index >> 5 is Math.floor(index / 32) — selects the Uint32 slot
  // index & 31 is index % 32 — selects the bit position within the slot
  bitmap[index >> 5] |= 1 << (index & 31);
}
```

If bitwise operators feel intimidating, don't worry. There are just two ideas: **divide by 32** to find which integer to use (`>> 5`), and **modulo 32** to find which bit within it (`& 31`).

I will be honest: AI helped me (a lot) to write these bit manipulation functions correctly on the first try!

### Counting with popcount

To count items in a group, we count the number of set bits, an operation known as **popcount** (population count). Here's an efficient implementation using [Brian Kernighan's algorithm](https://stackoverflow.com/q/12380478/3309466):

```js
function popcount(bitmap) {
  let count = 0;
  for (let i = 0; i < bitmap.length; i++) {
    let n = bitmap[i];
    while (n) {
      n &= n - 1; // Clears the lowest set bit each iteration
      count++;
    }
  }
  return count;
}
```

The trick is `n &= (n - 1)`: it clears exactly one set bit per iteration, so the inner loop only runs as many times as there are set bits — not 32 times per integer.

### Extracting item indices

When you need the actual item IDs, you extract the positions of all set bits:

```js
function getSetBitIndices(bitmap) {
  const indices = [];
  for (let i = 0; i < bitmap.length; i++) {
    let n = bitmap[i];
    const base = i << 5; // i * 32
    while (n) {
      const bit = n & -n; // Isolate lowest set bit
      const pos = 31 - Math.clz32(bit); // Find its position
      indices.push(base + pos);
      n &= n - 1; // Clear it
    }
  }
  return indices;
}
```

`Math.clz32` counts leading zeros in a 32-bit integer and maps directly to a CPU instruction on most architectures.

### Intersecting bitmaps

To combine two bitmaps, we perform a bitwise AND on each pair of 32-bit integers:

```js
function intersect(a, b) {
  const result = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] & b[i];
  }
  return result;
}
```

One loop, one bitwise operation per slot. The result contains only the items present in **both** inputs. Chain multiple intersections to combine as many attributes as you need.

### Putting it all together

Here's the complete bitmap-based `groupBy`:

```js
import { shapes, colors, sizes } from "./generate-dataset.mjs";

function bitmapGroupBy(items) {
  const totalItems = items.length;

  // One bitmap per individual attribute value (5 + 6 + 4 = 15 bitmaps)
  const shapeBitmaps = new Map();
  const colorBitmaps = new Map();
  const sizeBitmaps = new Map();

  for (const s of shapes) shapeBitmaps.set(s, createBitmap(totalItems));
  for (const c of colors) colorBitmaps.set(c, createBitmap(totalItems));
  for (const z of sizes) sizeBitmaps.set(z, createBitmap(totalItems));

  // Single pass: set the bit in each attribute's bitmap
  for (let i = 0; i < totalItems; i++) {
    const item = items[i];
    setBit(shapeBitmaps.get(item.shape), i);
    setBit(colorBitmaps.get(item.color), i);
    setBit(sizeBitmaps.get(item.size), i);
  }

  // Build groups by intersecting attribute bitmaps
  const groups = [];
  for (const shape of shapes) {
    for (const color of colors) {
      // Intersect shape & color once, reuse across all sizes
      const shapeColorBitmap = intersect(
        shapeBitmaps.get(shape),
        colorBitmaps.get(color),
      );
      for (const size of sizes) {
        const bitmap = intersect(shapeColorBitmap, sizeBitmaps.get(size));
        const count = popcount(bitmap);
        if (count === 0) continue;

        groups.push({
          shape,
          color,
          size,
          count,
          items: getSetBitIndices(bitmap).map((idx) => items[idx]),
        });
      }
    }
  }

  return groups;
}
```

A few things to notice:

- We create **15 bitmaps** during the data scan, not 120. Each item sets 3 bits (one per attribute).
- The `shapeColorBitmap` intermediate result is reused for all 4 sizes, avoiding redundant intersections.
- The `items` array is materialized from the bitmap using `getSetBitIndices`, so the output shape matches the naive approach exactly. If you only need counts, you can skip materializing `items` and convert it to a lazy iterator instead.

## Trade-offs and limitations

Before you go bitmap-crazy on every data structure, let's talk about when this approach makes sense and when it doesn't.

**Bitmaps shine when** you have a known, bounded universe of items, many groups with sparse membership, count-heavy workloads, and flexible querying needs.

**Stick with arrays when** your dataset is small (below ~10,000 items the difference is negligible), or your data is dynamic/streaming with unknown final counts.

**Readability**: let's be honest, `bitmap[index >> 5] |= (1 << (index & 31))` is not as readable as `group.items.push(item)`. If you go this route, invest in **clear helper functions** with descriptive names (as we did above). Future-you will be grateful.

## Benchmarking

Talking about performance without numbers is just hand-waving. Let's measure.

I'm using [mitata](https://github.com/evanwashere/mitata) for timing benchmarks and `process.memoryUsage()` for heap measurement. You can find the full benchmark script in the [bonus/bitmap/benchmark.mjs](https://github.com/Eomm/blog-posts/tree/master/bonus/bitmap/benchmark.mjs) file. Run it with `node --expose-gc benchmark.mjs` for accurate memory measurement.

### Results

On an Apple M1 with Node.js v22:

| Metric            | Naive    | Bitmap   | Improvement             |
| ----------------- | -------- | -------- | ----------------------- |
| **Heap delta**    | ~34 MB   | ~18 MB   | **~1.9x less memory**   |
| **Avg time/iter** | ~180 ms  | ~100 ms  | **~1.8x faster**        |

Both approaches store references to the original objects (no new allocations per item), so the comparison is apples-to-apples.
The bitmap approach uses **~1.9x less heap** because its arrays are built at once from `getSetBitIndices` rather than incrementally grown with `push()` (which causes V8 backing-store doubling). It's also **~1.8x faster** because bitwise AND on contiguous typed arrays is extremely cache-friendly and the intersection logic avoids per-item branching.

The real memory win comes when you **don't need to materialize the items at all**, just count them with `popcount`, in which case the 15 bitmaps use only ~0.2 MB total: it would mean a **~230x reduction** in memory compared to the naive approach.

## Conclusion

A **bitmap** is not just an image format. It's a compact way to represent set membership using individual bits. When your problem involves tracking "which elements belong to which group" across a large, bounded dataset, bitmaps can dramatically reduce memory usage with minimal CPU overhead.

Here's what to take away:

- **Don't optimize prematurely.** If your data fits comfortably in memory, readability wins.
- **At scale, object allocation is the enemy.** Typed arrays (`Uint32Array`) are contiguous memory blocks that the GC handles far more efficiently than millions of tiny objects.
- **Store per-value, query by intersection.** Fewer bitmaps, more flexibility, same results.

Next time you hear "bitmap", I hope you'll think beyond `.bmp` files!

The complete runnable code is available in the [bonus/bitmap](https://github.com/Eomm/blog-posts/tree/master/bonus/bitmap) directory of this repository.

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
