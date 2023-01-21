'use strict'

const Fastify = require('fastify')
const GQL = require('mercurius')
const schema = require('./gql-schema')

if (process.argv[2] === 'run') {
  buildApp()
    .then(app => app.listen({ port: 8080 }))
}

async function buildApp () {
  const app = Fastify()

  await app.register(GQL, {
    schema,
    resolvers: {
      Query: {
        searchData: async function (root, args, context, info) {
          // TODO: implement the business logic
          return {}
        }
      },
      Grid: {
        resolveType (obj) {
          if (obj.adminColumn) {
            return 'AdminGrid'
          }
          if (obj.moderatorColumn) {
            return 'ModeratorGrid'
          }
          return 'UserGrid'
        }
      }
    }
  })

  return app
}

module.exports = buildApp
