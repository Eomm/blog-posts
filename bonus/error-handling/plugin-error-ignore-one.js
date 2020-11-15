'use strict'

const Fastify = require('fastify')

const fastify = Fastify({ logger: true })

const condition = true

fastify.register((instance, ops, next) => {
  if (condition) {
    next(new Error('cannot be ignored'))
  } else {
    next(new Error('can be ignored'))
  }
}).after((err, instance, next) => {
  if (err.message === 'cannot be ignored') {
    next(err)
  } else {
    fastify.log.warn(err, 'Ops, my plugin fail to load, but nevermind')
    next()
  }
})

fastify.listen(8080, (err) => {
  if (err) {
    // startup error
    fastify.log.fatal(err)
    process.exit(1)
  }
})
