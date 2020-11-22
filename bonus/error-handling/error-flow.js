'use strict'

const Fastify = require('fastify')

const fastify = Fastify({
  logger: true,
  schemaErrorFormatter (errors, dataVar) {
    fastify.log.info({ errors }, 'executing schemaErrorFormatter %s', dataVar)
    return new Error()
  }
})

fastify.register((instance, ops, next) => {
  instance.setErrorHandler(function (error, request, reply) {
    this.log.info(error, 'executing setErrorHandler')
    reply.status(409).send(error)
  })

  fastify.addHook('onError', function (request, reply, error, done) {
    this.log.info(error, 'executing onError hook')
    error.code = 'hook'
    done()
  })

  instance.setNotFoundHandler(function (request, reply) {
    this.log.info('executing setNotFoundHandler')
    // reply.send({ 404: 'I did not found your route!' })
    reply.send(new Error('I did not found your route!'))
  })

  const schema = {
    params: {
      key: { type: 'integer' }
    }
  }

  instance.get('/:key/echo', {
    handler: echo,
    schema
  })

  instance.get('/:key/application-error', {
    handler: appError,
    schema
  })

  instance.get('/:key/application-json-error', {
    handler: appObjectError,
    schema
  })

  instance.get('/:key/bug', {
    handler: bugError,
    schema
  })

  instance.get('/:key/async-return-error', {
    handler: asyncReturnError,
    schema
  })

  next()
}, { prefix: '/one' })

fastify.inject('/one/1/async-return-error', (_, res) => {
  console.log(res.payload)
})

function echo (request, reply) {
  this.log.info('executing handler echo')
  reply.send(request.params)
}

function appError (request, reply) {
  this.log.info('executing handler appError')
  reply.code(403).send(new Error('application error'))
}

function appObjectError (request, reply) {
  this.log.info('executing handler appObjectError')
  reply.code(400).send({ what: 'did you send me?' })
}

function bugError (request, reply) {
  this.log.info('executing handler bugError')
  'this is a string not an array'.sort() // this will trigger an error
  reply.send('this will never executed')
}

async function asyncReturnError (request, reply) {
  this.log.info('executing handler asyncReturnError')
  return new Error('async return error and not throw!')
}
