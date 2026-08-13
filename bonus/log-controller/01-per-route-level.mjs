import Fastify, { LogController } from 'fastify'

class LevelPerRoute extends LogController {
  // Read the level from the route definition, falling back to Fastify's
  // default of `info` when the route does not set one.
  levelFor (request) {
    return request.routeOptions?.config?.requestLogLevel ?? 'info'
  }

  incomingRequest (request, reply) {
    // Overriding a method means the default `disableRequestLogging` check is
    // gone, so call it yourself to keep that option working.
    if (this.isLogDisabled(request)) return
    // Same payload as the default line, only the level is dynamic.
    request.log[this.levelFor(request)]({ req: request }, 'incoming request')
  }

  requestCompleted (error, request, reply) {
    if (this.isLogDisabled(request)) return
    if (error) {
      // A health check that starts failing is exactly what you want to see,
      // so failures stay at `error` whatever the route asked for.
      reply.log.error({ res: reply, err: error, responseTime: reply.elapsedTime }, 'request errored')
      return
    }
    reply.log[this.levelFor(request)]({ res: reply, responseTime: reply.elapsedTime }, 'request completed')
  }
}

const app = Fastify({
  logger: { level: 'info' },
  logController: new LevelPerRoute()
})

// `config` is free-form: anything you put here is readable from the request.
// The automatic logs of this route are emitted at `debug`, and the `info`
// logger drops them.
app.get('/health', { config: { requestLogLevel: 'debug' } }, async () => ({ status: 'ok' }))

// No `config`, so `levelFor` falls back to `info` and this route logs normally.
app.get('/orders', async (request) => {
  request.log.info('loading orders')
  return { orders: [] }
})

await app.inject('/health')
await app.inject('/orders')
await app.close()
