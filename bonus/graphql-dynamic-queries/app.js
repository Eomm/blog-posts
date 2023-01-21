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
          switch (getUserType(context)) {
            case 'AdminGrid':
              return { totalRevenue: 42 }

            case 'ModeratorGrid':
              return { banHammer: true }

            default:
              return { basicColumn: 'basic' }
          }
        }
      },
      Grid: {
        resolveType (obj, context) {
          return getUserType(context)
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

  app.graphql.addHook('preValidation', async (schema, document, context) => {
    const { visit } = require('graphql')

    const userType = getUserType(context)

    const newDocument = visit(document, {
      enter: (node) => {
        const isMaskedQuery = node.kind === 'Field' &&
                              node.name.value === 'searchData' &&
                              node.selectionSet.selections.length === 1 &&
                              node.selectionSet?.selections.length > 0

        if (isMaskedQuery) {
          // This is the magic, we add a new inline fragment modifying the AST
          const nodeWithInlineFragment = {
            ...node,
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: {
                      kind: 'Name',
                      value: userType
                    }
                  },
                  selectionSet: node.selectionSet
                }
              ]
            }
          }
          return nodeWithInlineFragment
        }
      }
    })

    document.definitions = newDocument.definitions
  })

  return app
}

module.exports = buildApp

function getUserType (context) {
  switch (context.reply.request.headers['x-user-type']) {
    case 'admin':
      return 'AdminGrid'
    case 'moderator':
      return 'ModeratorGrid'
    default:
      return 'UserGrid'
  }
}
