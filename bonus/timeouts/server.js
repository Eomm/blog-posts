'use strict'

// node server.js --connectionTimeout 10000 \
//   --requestTimeout 20000 \
//   --keepAliveTimeout 5000 \
//   --headersTimeout 30000 \
//   --handlerTimeout 5000 \
//   --connectionsCheckingInterval 10000

const { parseArgs } = require('node:util')
const setTimeout = require('node:timers/promises').setTimeout

const { values } = parseArgs({
  options: {
    connectionTimeout: { type: 'string' },
    headersTimeout: { type: 'string' },
    requestTimeout: { type: 'string' },
    handlerTimeout: { type: 'string', default: '0' },
    keepAliveTimeout: { type: 'string' },
    connectionsCheckingInterval: { type: 'string', default: '100' }
  }
})

const app = require('fastify')({
  logger: true,

  connectionTimeout: values.connectionTimeout && parseInt(values.connectionTimeout),
  requestTimeout: values.requestTimeout && parseInt(values.requestTimeout),
  keepAliveTimeout: values.keepAliveTimeout && parseInt(values.keepAliveTimeout),

  http: {
    headersTimeout: values.headersTimeout && parseInt(values.headersTimeout),
    connectionsCheckingInterval: values.connectionsCheckingInterval && parseInt(values.connectionsCheckingInterval)
  }
})

app.post('/', async (request, reply) => {
  request.log.info('Running handler')
  // Simulate a long-running request
  await setTimeout(parseInt(values.handlerTimeout))
  return { hello: 'world' }
})

// Some useful logging
app.decorateRequest('start', 0)
app.addHook('onRequest', async function hook (request, reply) {
  request.log.info('Request received! 🚀')
  request.start = Date.now()
})

app.addHook('onTimeout', async function hook (request, reply) {
  request.log.info('Request timed out! 🚨')
})

app.addHook('onRequestAbort', async (request) => {
  request.log.info('Request aborted! 🚨')
})

app.addHook('onResponse', async function hook (request, reply) {
  request.log.info('Request completed in %d ms', Date.now() - request.start)
})

app.listen({ port: 8080 })
