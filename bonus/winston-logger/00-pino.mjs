import Fastify from 'fastify'

// The default Fastify logger: pino
const app = Fastify({ logger: true })

app.get('/hello', (request, reply) => {
  request.log.info({ user: 'manuel' }, 'Sending hello')
  return { greet: 'hello' }
})

app.get('/boom', () => {
  throw new Error('kaboom')
})

await app.listen({ port: 3000 })
