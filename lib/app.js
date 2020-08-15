'use strict'

const path = require('path')
const env = require('fastify-env')
const helmet = require('fastify-helmet')
const fastifyStatic = require('fastify-static')
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
  fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'via.placeholder.com'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'kit.fontawesome.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"]
      }
    }
  })

  fastify.register(authRoutes, { prefix: '/auth' })

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../static'),
    serve: false
  })

  fastify.get('/', serveHtml)
  fastify.setNotFoundHandler(serveHtml)

  function serveHtml (request, reply) {
    reply.sendFile('index.html')
  }

  next()
}
