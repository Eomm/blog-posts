
import fastify from 'fastify'
import { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts'

const server = fastify({
  logger: true
})
  .withTypeProvider<JsonSchemaToTsProvider>()



declare module 'fastify' {
  export interface FastifyRequest {
    session: {
      [key: string]: any
      get(key: string): any
      set(key: string, value: any): void
    }
    flash: Boolean
  }
  export interface FastifyReply {
    flash: Boolean
  }
}

server.get('/route', {
  schema: {
    querystring: {
      type: 'object',
      properties: {
        foo: { type: 'number' },
        bar: { type: 'string' }
      },
      required: ['foo', 'bar']
    }
  } as const // don't forget to use const !

}, (request, reply) => {
  // type Query = { foo: number, bar: string }

  const { foo, bar } = request.query // type safe!
  console.log({ foo, bar })
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
