
import fastify from 'fastify'
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'
import plugin from './a-plugin'

const server = fastify({
  logger: true
})
  .withTypeProvider<JsonSchemaToTsProvider>()


server.register(async function (fastify, opts) {
  fastify.register(plugin)

  fastify.fooFunction() // type safe!

  fastify.get('/', async (request, reply) => {
    reply.fooReply // type safe!
    request.fooRequest // type safe!
    return { hello: 'world' }
  })

})

server.get('/ping', async (request, reply) => {
  return 'pong\n'
})

server.listen({ port: 8080 }, (err, address) => {
  if (err != null) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})
