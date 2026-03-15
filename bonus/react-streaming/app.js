import Fastify from 'fastify'
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'

const app = Fastify({ logger: true })

app.get('/', async (req, reply) => {
  reply.hijack()

  const stream = renderToPipeableStream(
    React.createElement('div', null, 'Hello from React streaming!'),
    {
      onShellReady () {
        reply.raw.setHeader('Content-Type', 'text/html; charset=utf-8')
        stream.pipe(reply.raw)
      },
      onShellError (err) {
        reply.raw.statusCode = 500
        reply.raw.setHeader('Content-Type', 'text/html; charset=utf-8')
        reply.raw.end('<!doctype html><p>Something went wrong</p>')
        console.error(err)
      },
      onError (err) {
        console.error(err)
      }
    }
  )
})

await app.listen({ port: 3000 })
