'use strict'

const QueryStream = require('pg-query-stream')
const JSONStream = require('JSONStream')

const { SLOW_QUERY } = require('./utils')

module.exports = async function (app, opts) {
  app.get('/api/stream', {
    schema: {
      query: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50_000 }
        }
      }
    }
  }, queryStream)
}

async function queryStream (request, reply) {
  const client = await this.pg.connect()
  const slowQuery = `${SLOW_QUERY} LIMIT $1`
  const query = new QueryStream(slowQuery, [request.query.limit], {
    highWaterMark: 500
  })
  const stream = client.query(query)

  stream.on('end', () => { client.release() })
  return stream.pipe(JSONStream.stringify())
}
