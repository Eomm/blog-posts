import Fastify, { LogController } from 'fastify'

class SampledLog extends LogController {
  constructor (options = {}) {
    // Forward the options to the base class so `disableRequestLogging` and
    // `requestIdLogLabel` keep working alongside my own settings.
    super(options)
    this.sampleRate = options.sampleRate ?? 10
    this.counter = 0
  }

  incomingRequest () {}

  requestCompleted (error, request, reply) {
    const failed = Boolean(error) || reply.statusCode >= 500
    this.counter++

    // Keep one successful request out of `sampleRate`, and never drop a failure.
    if (!failed && this.counter % this.sampleRate !== 0) {
      return
    }

    reply.log.info({
      url: request.url,
      status: reply.statusCode,
      ms: Math.round(reply.elapsedTime),
      sampled: !failed, // so you know this line represents `sampleRate` requests
      err: error ?? undefined
    }, 'access')
  }
}

const app = Fastify({
  logger: { level: 'info' },
  logController: new SampledLog({ sampleRate: 5 })
})

app.get('/ping', async () => ({ pong: true }))
app.get('/boom', async () => { throw new Error('kaboom') })

for (let i = 0; i < 7; i++) {
  await app.inject('/ping')
}
await app.inject('/boom')
await app.close()
