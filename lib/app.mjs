
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import Fastify from 'fastify'
import env from 'fastify-env'
import helmet from 'fastify-helmet'
import fastifyStatic from 'fastify-static'
import fastifyMongo from 'fastify-mongodb'
import pointOfView from 'point-of-view'
import handlebars from 'handlebars'

import authRoutes from './auth.mjs'
import apiEndpoints from './api/api.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const appVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'))).version

const schema = {
  type: 'object',
  required: ['PORT', 'DISCORD_CLIENT_ID', 'DISCORD_SECRET', 'DB_URI'],
  properties: {
    NODE_ENV: { type: 'string' },
    BASE_URL: { type: 'string' },
    PORT: { type: 'integer', default: 3000 },
    DISCORD_CLIENT_ID: { type: 'string' },
    DISCORD_SECRET: { type: 'string' },
    DB_URI: { type: 'string', format: 'uri' }
  }
}

export default function build (opts) {
  const fastify = Fastify(opts.fastify)

  // will load fastify.config
  fastify.register(env, {
    data: opts,
    schema,
    dotenv: false
  })
    .after((err) => {
      if (err) throw err // if the config file has some issue, we must bubble up them
      fastify.register(fastifyMongo, { url: fastify.config.DB_URI })

      fastify.register(apiEndpoints, { ...fastify.config, prefix: '/api' })
    })

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
    reply.view('/pages/homepage.hbs', { version: appVersion })
  })

  fastify.get('/list', function (request, reply) {
    reply.view('/pages/list.hbs')
  })

  fastify.get('/health', function (request, reply) {
    reply.send('I am fine thanks')
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
        scriptSrc: ['stackpath.bootstrapcdn.com', 'unpkg.com', 'code.jquery.com', 'kit.fontawesome.com', "'nonce-itShouldBeGenerated'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"]
      }
    }
  })

  return fastify
}
