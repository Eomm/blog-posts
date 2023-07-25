'use strict'

const { SLOW_QUERY } = require('./utils')

module.exports = async function (app, opts) {
  app.get('/api/batch', {
    schema: {
      query: {
        type: 'object',
        properties: {
          offset: { type: 'number', default: 0 },
          limit: { type: 'number', default: 50_000 }
        }
      }
    }
  }, queryBatch)
}

async function queryBatch (request, reply) {
  const offset = request.query.offset
  const batchSize = request.query.limit

  const slowQuery = `
    ${SLOW_QUERY}
    OFFSET $1
    LIMIT $2;
  `

  const result = await this.pg.query(slowQuery, [offset, batchSize])
  return result.rows
}
