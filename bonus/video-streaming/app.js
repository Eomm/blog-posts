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
  const videoPath = '/path/to/your/video.mp4'
  const videoSize = fs.statSync(videoPath).size

  const range = request.range(videoSize)
  request.log.info({ range })
  if (!range) {
    const error = new Error('Range Not Satisfiable')
    error.statusCode = 416
    throw error
  }

  // Handle only the first range requested
  const singleRange = range.ranges[0]

  // Define the size of the chunk to send
  const chunkSize = 1 * 1e6 // 1MB
  const { start } = singleRange
  const end = Math.min(start + chunkSize, videoSize)
  const contentLength = end - start + 1 // end is inclusive

  // Set the appropriate headers for range requests
  reply.headers({
    'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${videoSize}`,
    'Content-Length': contentLength
  })

  // Send a 206 Partial Content status code
  reply.code(206)
  reply.type('video/mp4')
  return fs.createReadStream(videoPath, { start, end })
})

await app.listen({ port: 8080 })
