'use strict'

const QueryStream = require('pg-query-stream')
const JSONStream = require('JSONStream')

const { STREAM_QUERY } = require('./utils')

module.exports = async function (app, opts) {
  app.get('/api/stream', {
    schema: {
      query: {
        type: 'object',
        properties: {
          rowCount: { type: 'number', default: 500_000 }
        }
      }
    }
  }, queryStream)
}

async function queryStream (request, reply) {
  const client = await this.pg.connect()
  const query = new QueryStream(STREAM_QUERY, [request.query.rowCount])
  const stream = client.query(query)

  stream.on('end', () => { client.release() })
  return stream.pipe(JSONStream.stringify())
}
