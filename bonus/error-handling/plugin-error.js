'use strict'

const Fastify = require('fastify')

const fastify = Fastify({ logger: true })

fastify.register((instance, ops, next) => {
  next(new Error('this plugin failed to load'))
})

fastify.listen(8080, (err) => {
  if (err) {
    // startup error
    fastify.log.fatal(err)
    process.exit(1)
  }
})
