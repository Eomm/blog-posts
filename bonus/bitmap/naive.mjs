import { generateDataset } from './generate-dataset.mjs'

export function naiveGroupBy (items) {
  const groups = new Map()

  for (const item of items) {
    const key = `${item.shape}:${item.color}:${item.size}`

    if (!groups.has(key)) {
      groups.set(key, {
        shape: item.shape,
        color: item.color,
        size: item.size,
        count: 0,
        items: []
      })
    }

    const group = groups.get(key)
    group.count++
    group.items.push(item)
  }

  return [...groups.values()]
}

// Run standalone: node naive.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const items = generateDataset()
  console.log('Dataset generated:', items.length, 'items')

  const before = process.memoryUsage()
  const groups = naiveGroupBy(items)
  const after = process.memoryUsage()

  console.log('Groups:', groups.length)
  console.log('Sample group:', {
    ...groups[0],
    items: `[${groups[0].items.length} items]`
  })
  console.log('Heap used delta:', ((after.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2), 'MB')
}
