'use strict'

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
