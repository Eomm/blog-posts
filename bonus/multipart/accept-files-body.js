'use strict'

const Fastify = require('fastify')
const fastifyMultipart = require('fastify-multipart')

const fastify = Fastify({ logger: true })
fastify.register(fastifyMultipart, { attachFieldsToBody: true })

fastify.post('/body', async function (req, reply) {
  return {
    upload: {
      astring: req.body.aField.value,
      foo: await req.body.fooFile.toBuffer(),
      bar: await req.body.barFile.toBuffer()
    }
  }
})

fastify.listen(8080, (err) => {
  if (err) {
    // startup error
    fastify.log.fatal(err)
    process.exit(1)
  }
})
