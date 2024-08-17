'use strict'

import Fastify from 'fastify'
import favicon from 'fastify-favicon'
import fastifyRange from 'fastify-range'
import * as fs from 'node:fs'

const app = Fastify({ logger: true })

app.register(favicon)
app.register(fastifyRange, { throwOnInvalid: true })

app.get('/', async () => {
  return fs.createReadStream('./index.html')
})

app.get('/video-streaming', async (request, reply) => {
  const videoPath = '/Users/mspigolon/Pictures/video/FUERTEVENTURA/GOPR2188.MP4'
  const videoSize = fs.statSync(videoPath).size

  const range = request.range(videoSize)
  console.log(range)

  if (!range) {
    const error = new Error('Range Not Satisfiable')
    error.statusCode = 416
    throw error
  }

  // no support for multi-range request, just use the first range
  const singleRange = range.ranges[0]

  // end is ignored: we control the end of the chunk
  const chunkSize = 1 * 1e6 // 1MB
  const { start } = singleRange
  const end = Math.min(start + chunkSize, videoSize)
  const contentLength = end - start + 1 // end is inclusive

  reply.headers({
    'Accept-Ranges': 'bytes',
    'Content-range': `bytes ${start}-${end}/${videoSize}`,
    'Content-Length': contentLength
  })

  reply.code(206)
  reply.type('video/mp4')
  return fs.createReadStream(videoPath, { start, end })
})

await app.listen({ port: 8080 })
