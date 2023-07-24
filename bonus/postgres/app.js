'use strict'

const fs = require('fs').promises

const app = require('fastify')({ logger: true })

app.get('/', async function serveUi (request, reply) {
  reply.type('text/html')
  return fs.readFile('./index.html', 'utf8')
})

app.register(require('@fastify/postgres'), {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
  max: 20
})

app.register(require('./lib/stream'))
app.register(require('./lib/cursor'))
app.register(require('./lib/batch'))

app.listen({ port: 8080 })
