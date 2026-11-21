import { test } from 'node:test'
import { PassThrough } from 'node:stream'
import Fastify from 'fastify'
import winston from 'winston'
import { createWinstonLogger, WinstonLogController, childLoggerFactory } from '../winston-fastify.mjs'

function buildApp () {
  const lines = []
  const stream = new PassThrough()
  stream.on('data', (chunk) => lines.push(JSON.parse(chunk)))

  const loggerInstance = createWinstonLogger({
    transports: [new winston.transports.Stream({ stream })]
  })
  const app = Fastify({
    loggerInstance,
    logController: new WinstonLogController(),
    childLoggerFactory
  })

  app.get('/hello', (request) => {
    request.log.info('Sending hello', { user: 'manuel' })
    return { greet: 'hello' }
  })
  app.get('/quiet', { logLevel: 'warn' }, (request) => {
    request.log.info('hidden')
    request.log.warn('visible')
    return { greet: 'shhh' }
  })
  app.get('/boom', () => { throw new Error('kaboom') })

  return { app, lines }
}

test('fastify and winston style calls keep the message and the bindings', async (t) => {
  const { app, lines } = buildApp()
  await app.inject('/hello')

  const incoming = lines.find((l) => l.message === 'incoming request')
  t.assert.deepStrictEqual(incoming.req, { method: 'GET', url: '/hello', host: 'localhost:80', remoteAddress: '127.0.0.1' })

  const hello = lines.find((l) => l.message === 'Sending hello')
  t.assert.strictEqual(hello.user, 'manuel')
  t.assert.strictEqual(hello.reqId, 'req-1')

  const completed = lines.find((l) => l.message === 'request completed')
  t.assert.deepStrictEqual(completed.res, { statusCode: 200 })
})

test('errors are serialized', async (t) => {
  const { app, lines } = buildApp()
  await app.inject('/boom')

  const error = lines.find((l) => l.level === 'error')
  t.assert.strictEqual(error.message, 'kaboom')
  t.assert.strictEqual(error.err.type, 'Error')
  t.assert.match(error.err.stack, /kaboom/)
})

test('the route logLevel option is applied', async (t) => {
  const { app, lines } = buildApp()
  await app.inject('/quiet')

  t.assert.deepStrictEqual(lines.map((l) => l.message), ['visible'])
})
