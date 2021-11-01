'use strict'

const fs = require('fs')
const pump = require('pump')
const Fastify = require('fastify')
const fastifyMultipart = require('fastify-multipart')

const fastify = Fastify({ logger: true })

fastify.register(fastifyMultipart)

fastify.post('/', async function (req, reply) {
  // return the first file submitted, regardless the field name
  const data = await req.file()

  // we must consume the file, we use pump to manage correctly the streams
  const storedFile = fs.createWriteStream('./img-uploaded.png')
  await pump(data.file, storedFile)

  return { upload: 'completed' }
})

fastify.post('/multiple', async function (req, reply) {
  // get all the files in the request payload
  // `files` is an async generator function
  const files = await req.files()

  for await (const part of files) { // iterate the async generator
    req.log.info('storing %s', part.filename)
    const storedFile = fs.createWriteStream(`./${part.filename}`)
    await pump(part.file, storedFile)
  }

  return { upload: 'completed' }
})

fastify.listen(8080, (err) => {
  if (err) {
    // startup error
    fastify.log.fatal(err)
    process.exit(1)
  }
})
