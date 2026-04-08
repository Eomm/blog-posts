import { generateDataset, shapes, colors, sizes } from './generate-dataset.mjs'

// Each bit in the bitmap represents one item index.
// We use a Uint32Array where each element holds 32 bits.
function createBitmap (totalItems) {
  return new Uint32Array(Math.ceil(totalItems / 32))
}

function setBit (bitmap, index) {
  bitmap[index >> 5] |= (1 << (index & 31))
}

// Bitwise AND of two bitmaps — returns a new bitmap with bits set only where both inputs have bits set
function intersect (a, b) {
  const result = new Uint32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] & b[i]
  }
  return result
}

// Count set bits using Brian Kernighan's algorithm
function popcount (bitmap) {
  let count = 0
  for (let i = 0; i < bitmap.length; i++) {
    let n = bitmap[i]
    while (n) {
      n &= (n - 1)
      count++
    }
  }
  return count
}

// Extract the indices of all set bits
function getSetBitIndices (bitmap) {
  const indices = []
  for (let i = 0; i < bitmap.length; i++) {
    let n = bitmap[i]
    const base = i << 5
    while (n) {
      const bit = n & (-n)
      const pos = 31 - Math.clz32(bit)
      indices.push(base + pos)
      n &= (n - 1)
    }
  }
  return indices
}

export function bitmapGroupBy (items) {
  const totalItems = items.length

  // One bitmap per individual attribute value (5 + 6 + 4 = 15 bitmaps, not 120)
  const shapeBitmaps = new Map()
  const colorBitmaps = new Map()
  const sizeBitmaps = new Map()

  for (const s of shapes) shapeBitmaps.set(s, createBitmap(totalItems))
  for (const c of colors) colorBitmaps.set(c, createBitmap(totalItems))
  for (const z of sizes) sizeBitmaps.set(z, createBitmap(totalItems))

  // Single pass: set the bit in each attribute's bitmap
  for (let i = 0; i < totalItems; i++) {
    const item = items[i]
    setBit(shapeBitmaps.get(item.shape), i)
    setBit(colorBitmaps.get(item.color), i)
    setBit(sizeBitmaps.get(item.size), i)
  }

  // Build groups by intersecting attribute bitmaps
  const groups = []
  for (const shape of shapes) {
    for (const color of colors) {
      // Intersect shape & color once, reuse for all sizes
      const shapeColorBitmap = intersect(shapeBitmaps.get(shape), colorBitmaps.get(color))
      for (const size of sizes) {
        const bitmap = intersect(shapeColorBitmap, sizeBitmaps.get(size))
        const count = popcount(bitmap)
        if (count === 0) continue

        groups.push({
          shape,
          color,
          size,
          count,
          items: getSetBitIndices(bitmap).map(idx => items[idx])
        })
      }
    }
  }

  return groups
}

// Expose for ad-hoc queries like "give me all red circles"
export function queryByAttributes (items, attrs) {
  const totalItems = items.length

  // Build bitmaps for each attribute value
  const bitmaps = new Map()
  for (let i = 0; i < totalItems; i++) {
    const item = items[i]
    for (const [key, value] of Object.entries(attrs)) {
      if (item[key] === value) {
        if (!bitmaps.has(key)) bitmaps.set(key, createBitmap(totalItems))
        setBit(bitmaps.get(key), i)
      }
    }
  }

  // Intersect all attribute bitmaps
  const bitmapList = [...bitmaps.values()]
  let result = bitmapList[0]
  for (let i = 1; i < bitmapList.length; i++) {
    result = intersect(result, bitmapList[i])
  }

  return {
    count: popcount(result),
    items: getSetBitIndices(result).map(idx => items[idx])
  }
}

// Run standalone: node bitmap.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const items = generateDataset()
  console.log('Dataset generated:', items.length, 'items')

  const before = process.memoryUsage()
  const groups = bitmapGroupBy(items)
  const after = process.memoryUsage()

  console.log('Groups:', groups.length)
  console.log('Sample group:', {
    shape: groups[0].shape,
    color: groups[0].color,
    size: groups[0].size,
    count: groups[0].count,
    items: `[${groups[0].items.length} items]`
  })
  console.log('Heap used delta:', ((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2), 'MB')
}
