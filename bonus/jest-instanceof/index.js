'use strict'

const http = require('http')
const fastifySqlite = require('fastify-sqlite')
const fastifyMongo = require('@fastify/mongodb')
const fastifyPostgres = require('@fastify/postgres')

module.exports = {
  aSimpleHttpRequest: () => {
    return new Promise((resolve, reject) => {
      const request = http.request('http://does-not-exist/', res => {
        // no response
      })

      request.once('error', err => { resolve(err) })
    })
  },

  fastifySqlite: async () => {
    const fastify = require('fastify')()
    await fastify.register(fastifySqlite, {
      promiseApi: true,
      dbFile: ':memory:'
    })
    await fastify.sqlite.exec('CREATE TABLE tbl (col DATE)')
    await fastify.sqlite.exec("INSERT INTO tbl VALUES (DateTime('now'))")
    fastify.get('/', async (request, reply) => {
      const [data] = await fastify.sqlite.all('SELECT * FROM tbl')
      return { instanceof: data.col instanceof Date }
    })
    return fastify
  },

  // docker run --rm -d -p 27017:27017 mongo
  fastifyMongo: async () => {
    const fastify = require('fastify')()
    await fastify.register(fastifyMongo, { url: 'mongodb://localhost:27017/mydb' })
    await fastify.mongo.db.collection('tbl').insert({ col: new Date() })
    fastify.get('/', async (request, reply) => {
      const [data] = await fastify.mongo.db.collection('tbl').find({}).toArray()
      return { instanceof: data.col instanceof Date }
    })
    return fastify
  },

  // docker run --rm -p 5432:5432 --name fastify-postgres -e POSTGRES_PASSWORD=postgres -d postgres:11-alpine
  fastifyPostgres: async () => {
    const fastify = require('fastify')()
    await fastify.register(fastifyPostgres, { connectionString: 'postgres://postgres:postgres@localhost/postgres' })
    const client = await fastify.pg.connect()

    await client.query('CREATE TABLE IF NOT EXISTS tbl (col DATE)')
    await client.query('INSERT INTO tbl VALUES ($1)', [new Date()])

    fastify.get('/', async (request, reply) => {
      const { rows: [data] } = await client.query('SELECT * FROM tbl')
      client.release()
      return { instanceof: data.col instanceof Date }
    })
    return fastify
  }
}
