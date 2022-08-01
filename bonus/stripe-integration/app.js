'use strict'

const path = require('path')

const fastify = require('fastify')
const fastifyStatic = require('@fastify/static')
const env = require('@fastify/env')

const stripeIntegration = require('./stripe-integration')

async function buildApp () {
  const app = fastify({
    logger: true
  })

  app.register(fastifyStatic, {
    root: path.join(__dirname, '/public')
  })

  await app.register(env, {
    dotenv: true,
    schema: {
      type: 'object',
      required: ['PORT', 'STRIPE_PRIVATE_KEY'],
      properties: {
        NODE_ENV: { type: 'string' },
        PORT: { type: 'integer' },
        STRIPE_PRIVATE_KEY: { type: 'string' },
        HOST: { type: 'string', default: 'localhost' },
        BASE_URL: { type: 'string', default: 'http://localhost:3000' }
      }
    }
  })

  app.register(stripeIntegration)

  return app
}

async function run () {
  const app = await buildApp()
  app.listen({
    port: app.config.PORT,
    host: app.config.HOST
  })
}

run()
