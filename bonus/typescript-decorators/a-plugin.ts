import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

export interface MyPluginOptions {
  myPluginOption: string
}

const plugin: FastifyPluginAsync<MyPluginOptions> = async function (fastify, opts) {
  fastify.decorateRequest('fooRequest', 'hi')
  fastify.decorateReply('fooReply', 'hi')
  fastify.decorate('fooFunction', () => { })

  fastify.get('/', async (request, reply) => {
    request.fooRequest // type safe!
    return { hello: 'world' }
  })

}

export default fp(plugin)

declare module 'fastify' {
  export interface FastifyRequest {
    fooRequest: String
  }
  export interface FastifyReply {
    fooReply: String
  }
  export interface FastifyInstance {
    fooFunction: () => void
  }
}
