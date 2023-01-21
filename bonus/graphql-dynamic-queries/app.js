'use strict'

const Fastify = require('fastify')
const GQL = require('mercurius')
const schema = require('./gql-schema')

if (process.argv[2] === 'run') {
  buildApp()
    .then(app => app.listen({ port: 8080 }))
}

async function buildApp () {
  const app = Fastify({ logger: !true })

  await app.register(GQL, {
    schema,
    resolvers: {
      Query: {
        searchData: async function (root, args, context, info) {
          switch (context.auth.identity) {
            case 'admin':
              return { totalRevenue: 42 }

            case 'moderator':
              return { banHammer: true }

            default:
              return { basicColumn: 'basic' }
          }
        }
      },
      Grid: {
        resolveType (obj) {
          if (Object.hasOwnProperty.call(obj, 'adminColumn')) {
            return 'AdminGrid'
          }
          if (Object.hasOwnProperty.call(obj, 'moderatorColumn')) {
            return 'ModeratorGrid'
          }
          return 'UserGrid'
        }
      }
    }
  })

  app.register(require('mercurius-auth'), {
    authContext (context) {
      // you can validate the headers here
      return {
        identity: context.reply.request.headers['x-user-type']
      }
    },
    async applyPolicy (policy, parent, args, context, info) {
      const role = policy.arguments[0].value.value
      app.log.info('Applying policy %s on user %s', role, context.auth.identity)

      // we compare the schema role directive with the user role
      return context.auth.identity === role
    },
    authDirective: 'auth'
  })

  return app
}

module.exports = buildApp
