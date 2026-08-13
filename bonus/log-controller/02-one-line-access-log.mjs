import Fastify, { LogController } from 'fastify'

class AccessLog extends LogController {
  // An empty override is how you drop a log line entirely.
  incomingRequest () {}

  requestCompleted (error, request, reply) {
    reply.log.info({
      method: request.method,
      url: request.url,
      // The route *pattern*, so /orders/42 and /orders/43 group together
      // under /orders/:id instead of exploding your cardinality.
      route: request.routeOptions.url,
      status: reply.statusCode,
      // elapsedTime is a float in milliseconds: round it before shipping.
      ms: Math.round(reply.elapsedTime),
      // Any request property can become a log field, no `onRequest` hook needed.
      tenant: request.headers['x-tenant-id'],
      // `undefined` keys are skipped by the serializer, so successful
      // requests do not carry an empty `err`.
      err: error ?? undefined
    }, 'access')
  }
}

const app = Fastify({
  logger: { level: 'info' },
  logController: new AccessLog()
})

app.get('/orders/:id', async (request) => ({ id: request.params.id }))

await app.inject({ url: '/orders/42', headers: { 'x-tenant-id': 'acme' } })
await app.close()
