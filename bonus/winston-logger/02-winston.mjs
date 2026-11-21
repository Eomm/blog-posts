import Fastify from 'fastify'
import winston from 'winston'
import { createWinstonLogger, WinstonLogController, childLoggerFactory } from './winston-fastify.mjs'

const loggerInstance = createWinstonLogger({
  level: 'info',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
})

const app = Fastify({
  loggerInstance,
  logController: new WinstonLogController(),
  childLoggerFactory
})

app.get('/hello', (request, reply) => {
  request.log.info('Sending hello', { user: 'manuel' })
  return { greet: 'hello' }
})

app.get('/quiet', { logLevel: 'warn' }, (request, reply) => {
  request.log.info('You will not see this line')
  return { greet: 'shhh' }
})

app.get('/boom', () => {
  throw new Error('kaboom')
})

await app.listen({ port: 3000 })
