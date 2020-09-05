
import path from 'path'
import env from 'fastify-env'
import helmet from 'fastify-helmet'
import fastifyStatic from 'fastify-static'
import pointOfView from 'point-of-view'
import handlebars from 'handlebars'
import { fileURLToPath } from 'url'

import authRoutes from './auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const schema = {
  type: 'object',
  required: ['PORT', 'DISCORD_CLIENT_ID', 'DISCORD_SECRET'],
  properties: {
    BASE_URL: { type: 'string' },
    PORT: { type: 'integer', default: 3000 },
    DISCORD_CLIENT_ID: { type: 'string' },
    DISCORD_SECRET: { type: 'string' }
  }
}

export default function app (fastify, opts, next) {
  // will load fastify.config
  fastify.register(env, { schema, dotenv: true })

  // the auth management
  fastify.register(authRoutes, { prefix: '/auth' })

  // the SSR engine
  handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context, null, 2)
  })
  fastify.register(pointOfView, { engine: { handlebars } })

  // serve static files
  fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../pages'),
    serve: false
  })

  fastify.get('/', function (request, reply) {
    reply.sendFile('homepage.html')
  })

  fastify.setNotFoundHandler(function (request, reply) {
    reply.redirect('/')
  })

  fastify.setErrorHandler(function (error, request, reply) {
    reply.view('/pages/error.hbs', error)
  })

  // a bit of security
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

  next()
}
