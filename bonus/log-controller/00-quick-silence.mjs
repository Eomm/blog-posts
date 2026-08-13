import Fastify from 'fastify'

const app = Fastify({ logger: { level: 'info' } })

// Every `register` call creates an encapsulated context with its own child
// logger, and `logLevel` sets the level of that child logger only.
// `silent` drops everything, including Fastify's automatic request logs.
app.register(async function healthChecks (app) {
  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/ready', async () => ({ status: 'ok' }))
}, { logLevel: 'silent' })

// Outside that plugin, the default `info` level is untouched.
app.get('/orders', async (request) => {
  request.log.info('loading orders')
  return { orders: [] }
})

await app.inject('/health')
await app.inject('/ready')
await app.inject('/orders')
await app.close()
