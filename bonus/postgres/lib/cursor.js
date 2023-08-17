'use strict'

const { Readable } = require('node:stream')
const Cursor = require('pg-cursor')
const JSONStream = require('JSONStream')

const { SLOW_QUERY } = require('./utils')

module.exports = async function (app, opts) {
  app.get('/api/cursor', {
    schema: {
      query: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50_000 }
        }
      }
    }
  }, queryCursor)
}

async function queryCursor (request, reply) {
  const client = await this.pg.connect()
  const cursor = new ReadableCursor({
    query: `${SLOW_QUERY} LIMIT $1`,
    client,
    limit: request.query.limit
  })

  reply.type('application/json')
  return cursor.pipe(JSONStream.stringify())
}

class ReadableCursor extends Readable {
  cursor = null
  client = null
  query = null

  constructor ({ query, client, limit }) {
    super({ objectMode: true, highWaterMark: 500 })
    this.query = query
    this.client = client
    this.limit = limit
  }

  _construct (callback) {
    this.cursor = this.client.query(new Cursor(this.query, [this.limit]))
    callback()
  }

  _read (size) {
    this.cursor.read(size, (err, rows) => {
      if (err) {
        console.error({ err })
        this.destroy(err)
      } else {
        if (rows.length > 0) {
          rows.forEach(row => {
            this.push(row)
          })
        }
        if (rows.length < size) {
          this.push(null)
        }
      }
    })
  }

  _destroy (_err, callback) {
    if (this.cursor) {
      this.cursor.close(() => {
        this.cursor = null
        this.client.release()
        this.client = null
        callback()
      })
    } else if (this.client) {
      this.client.release()
      this.client = null
      callback()
    }
  }
}
