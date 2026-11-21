import Fastify from 'fastify'
import winston from 'winston'

const loggerInstance = winston.createLogger({
  // Fastify requires the fatal and trace levels, winston does not have them by default
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5
  },
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
})

const app = Fastify({ loggerInstance })

app.get('/hello', (request, reply) => {
  request.log.info('Sending hello', { user: 'manuel' })
  return { greet: 'hello' }
})

app.get('/boom', () => {
  throw new Error('kaboom')
})

await app.listen({ port: 3000 })
