'use strict'

const Fastify = require('fastify')
const mercurius = require('mercurius')

const gqlSchema = require('./gql-schema')
run()

async function run () {
  const app = Fastify({ logger: true })
  await app.register(require('fastify-sqlite'), {
    promiseApi: true
  })

  await app.sqlite.migrate({
    migrationsPath: 'migrations/'
  })

  const loaders = {
    Developer: {
      builtProjects: async function loader (queries, context) {
        const devIds = queries.map(({ obj }) => obj.id)
        const sql = `SELECT * FROM Projects WHERE devId IN (${devIds.join(',')})`
        context.app.log.warn('sql: %s', sql)

        const projects = await context.app.sqlite.all(sql)
        return queries.map(({ obj }) => {
          return projects.filter(p => p.devId === obj.id)
        })
      }
    }
  }

  const resolvers = {
    Query: {
      developers: async function (parent, args, context) {
        const sql = 'SELECT * FROM Developers'
        context.app.log.warn('sql: %s', sql)
        const data = await context.app.sqlite.all(sql)
        return data
      }
    },
    Developer: {
      builtProjects: async function (parent, args, context) {
        const sql = `SELECT * FROM Projects WHERE devId = ${parent.id}`
        context.app.log.warn('sql: %s', sql)
        return context.app.sqlite.all(sql)
      }
    }
  }

  app.register(mercurius, {
    schema: gqlSchema,
    graphiql: true,
    loaders,
    resolvers
  })

  await app.listen({ port: 3001 })
}
