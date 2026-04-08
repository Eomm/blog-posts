import { run, bench, summary, compact } from 'mitata'
import { generateDataset } from './generate-dataset.mjs'
import { naiveGroupBy } from './naive.mjs'
import { bitmapGroupBy } from './bitmap.mjs'

// Generate the dataset once, shared across benchmarks
const items = generateDataset()
console.log(`Dataset: ${items.length.toLocaleString()} items\n`)

// Memory measurement helper
function measureMemory (fn) {
  global.gc?.() // Run GC if available (use --expose-gc)
  const before = process.memoryUsage().heapUsed
  const result = fn()
  const after = process.memoryUsage().heapUsed
  const deltaBytes = after - before
  return { result, deltaBytes }
}

// --- Memory comparison (outside mitata, since mitata measures time) ---
console.log('=== Memory Usage ===\n')

const naiveMem = measureMemory(() => naiveGroupBy(items))
console.log(`Naive groupBy:  ${(naiveMem.deltaBytes / 1024 / 1024).toFixed(2)} MB heap delta`)

global.gc?.()

const bitmapMem = measureMemory(() => bitmapGroupBy(items))
console.log(`Bitmap groupBy: ${(bitmapMem.deltaBytes / 1024 / 1024).toFixed(2)} MB heap delta`)
console.log(`Ratio: ${(naiveMem.deltaBytes / bitmapMem.deltaBytes).toFixed(1)}x less memory with bitmap`)
console.log()

// --- Timing benchmark with mitata ---
summary(() => {
  compact(() => {
    bench('naive groupBy', () => naiveGroupBy(items))
    bench('bitmap groupBy', () => bitmapGroupBy(items))
  })
})

await run()
