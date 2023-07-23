'use strict'

const fs = require('fs').promises

const app = require('fastify')({ logger: true })

const QueryStream = require('pg-query-stream')
const JSONStream = require('JSONStream')

const Cursor = require('pg-cursor')

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

app.get('/api/batch', queryBatch)
app.get('/api/stream', queryStream)
app.get('/api/cursor', queryCursor)
app.listen({ port: 8080 })

async function queryBatch (request, reply) {
  const offset = request.query.offset || 0
  const batchSize = request.query.batchSize || 10000

  const select = `
    SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
    FROM items
    INNER JOIN desks ON desks.id = items.desk_id
    ORDER BY items.id
    OFFSET $1
    LIMIT $2;
  `

  const result = await this.pg.query(select, [offset, batchSize])
  return result.rows
}

async function queryStream (request, reply) {
  const client = await this.pg.connect()
  const select = `
    SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
    FROM items
    INNER JOIN desks ON desks.id = items.desk_id
    ORDER BY items.id
    LIMIT 500000
  `
  const query = new QueryStream(select)
  const stream = client.query(query)

  stream.on('end', () => { client.release() })
  return stream.pipe(JSONStream.stringify())

  // stream.pipe(JSONStream.stringify()).pipe(reply.raw)
  // return reply
}

async function queryCursor (request, reply) {
  // todo
}
