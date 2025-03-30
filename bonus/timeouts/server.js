'use strict'

const app = require('fastify')({
  logger: true,

  // connectionTimeout: 1000,
  keepAliveTimeout: 1000,
  requestTimeout: 1000,
  // headersTimeout: 1000,
  // connectionsCheckingInterval
  maxRequestsPerSocket: 5,
})
app.get('/', async (request, reply) => {
  console.log('Request received')

  return { hello: 'world' }
})

app.addHook('onTimeout', async function hook (request, reply) {
  // The onTimeout hook is executed when a request is timed out and the http socket has been hanged up
  request.log.warn('Request timed out')
})

app.listen({ port: 8080 })