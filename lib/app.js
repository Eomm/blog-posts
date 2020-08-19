'use strict'

const path = require('path')
const env = require('fastify-env')
const helmet = require('fastify-helmet')
const fastifyStatic = require('fastify-static')
const pointOfView = require('point-of-view')
const handlebars = require('handlebars')
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
        imgSrc: ["'self'", 'data:', 'via.placeholder.com', 'cdn.discordapp.com'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'kit.fontawesome.com'],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"]
      }
    }
  })

  fastify.register(authRoutes, { prefix: '/auth' })

  handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2)
  })

  fastify.register(pointOfView, { engine: { handlebars } })

  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../pages'),
    serve: false
  })

  fastify.get('/', function serveHtml (request, reply) {
    reply.sendFile('index.html')
  })
  fastify.setNotFoundHandler(function homepage (request, reply) {
    reply.redirect('/')
  })

  fastify.setErrorHandler(function (error, request, reply) {
    reply.view('/pages/error.hbs', error)
  })

  next()
}
