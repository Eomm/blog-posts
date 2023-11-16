'use strict'

const fastifyAuth = require('@fastify/auth')
const gipAuth = require('./gip-bearer-auth-plugin')

async function restv2 (fastify) {
  fastify.register(gipAuth)
  fastify.post('/test', () => {
    return { hello: 'world' }
  })
}

module.exports = async function (fastify) {
  await fastify.register(fastifyAuth)
  fastify.register(restv2, { prefix: '/v2' })
}
