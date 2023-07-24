const { Readable } = require('stream')
const Cursor = require('pg-cursor')

module.exports = class ReadableCursor extends Readable {
  cursor = null
  client = null
  query = null

  constructor (query, client) {
    super({ objectMode: true, highWaterMark: 500 })
    this.query = query
    this.client = client
  }

  _construct (callback) {
    this.cursor = this.client.query(new Cursor(this.query, []))
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
