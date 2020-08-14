'use strict'

const helmet = require('fastify-helmet')
const env = require('fastify-env')
const authRoutes = require('./auth')

const schema = {
  type: 'object',
  required: ['PORT', 'DISCORD_CLIENT_ID', 'DISCORD_SECRET'],
  properties: {
    BASE_URL: { type: 'string' },
    PORT: { type: 'integer', default: 3000 },
    DISCORD_CLIENT_ID: { type: 'string' },
    DISCORD_SECRET: { type: 'string' },
    DISCORD_PERMISSION: { type: 'string' }
  }
}

module.exports = function bot (fastify, opts, next) {
  fastify.register(env, { schema, dotenv: true })
  fastify.register(helmet)

  fastify.register(authRoutes, { prefix: '/auth' })

  fastify.get('/', () => 'Fastify Discord Demo Bot!!')

  next()
}
