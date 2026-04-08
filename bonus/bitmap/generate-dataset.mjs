// Generates a synthetic dataset of 1M items with random shape/color/size combinations

const shapes = ['circle', 'square', 'triangle', 'hexagon', 'star']
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
const sizes = ['small', 'medium', 'large', 'xlarge']

export { shapes, colors, sizes }

export function generateDataset (count = 1_000_000) {
  const items = new Array(count)
  for (let i = 0; i < count; i++) {
    items[i] = {
      id: i,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: colors[Math.floor(Math.random() * colors.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)]
    }
  }
  return items
}
