'use strict'

const http = require('http')
const fastifySqlite = require('fastify-sqlite')

module.exports = {
  aSimpleHttpRequest: () => {
    return new Promise((resolve, reject) => {
      const request = http.request('http://does-not-exist/', res => {
        // no response
      })

      request.once('error', err => { resolve(err) })
    })
  },

  fastifyApp: async () => {
    const fastify = require('fastify')()
    await fastify.register(fastifySqlite, {
      promiseApi: true,
      dbFile: ':memory:'
    })
    await fastify.sqlite.exec('CREATE TABLE tbl (col DATE)')
    await fastify.sqlite.exec("INSERT INTO tbl VALUES (DateTime('now'))")
    fastify.get('/', async (request, reply) => {
      const data = fastify.sqlite.all('SELECT * FROM tbl')
      return { instanceof: data.col instanceof Date }
    })
    return fastify
  }
}
