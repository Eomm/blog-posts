'use strict'

const Fastify = require('fastify')
const GQL = require('mercurius')
const mercuriusAuth = require('mercurius-auth')

const schema = `#graphql

directive @auth(
  role: String
) on OBJECT

type Query {
  grid: Grid
}

union Grid = AdminGrid | ModeratorGrid | UserGrid

type AdminGrid implements BasicGrid @auth(role: "admin") {
  adminColumn: String
  basicColumn: String
}

type ModeratorGrid implements BasicGrid @auth(role: "moderator") {
  moderatorColumn: String
  basicColumn: String
}

type UserGrid implements BasicGrid @auth(role: "user") {
  userColumn: String
  basicColumn: String
}

interface BasicGrid {
  basicColumn: String
}
`

main()

async function main () {
  const app = Fastify({ logger: true })

  await app.register(GQL, {
    schema,
    resolvers: {
      Query: {
        grid: async function (root, args, context, info) {
          return {
            adminColumn: 'admin'
          }
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

  app.graphql.addHook('preValidation', async (schema, document, context) => {
    const { visit } = require('graphql')

    const newDocument = visit(document, {
      enter: (node) => {
        const isMaskedQuery = node.kind === 'Field' && node.name.value === 'grid' && node.selectionSet.selections.length === 1 && node.selectionSet?.selections.length > 0

        if (isMaskedQuery) {
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
                      value: 'AdminGrid'
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

    // ? feature request to
    document.definitions = newDocument.definitions
  })

  app.register(mercuriusAuth, {
    authContext (context) {
      return {
        identity: context.reply.request.headers['x-user-type']
      }
    },
    async applyPolicy (policy, parent, args, context, info) {
      const role = policy.arguments[0].value.value
      app.log.info('Applying policy %s on user %s', role, context.auth.identity)
      return context.auth.identity === role
    },
    authDirective: 'auth'
  })

  await app.listen()

  // Query with fragment
  {
    const res = await doQuery('admin', `{
      grid {
        ... on AdminGrid { adminColumn }
      }
    }`)
    app.log.info(JSON.stringify(res.json(), null, 2))
  }

  // Query without fragment
  {
    const res = await doQuery('admin', `{
      grid {
        adminColumn
      }
    }`)
    app.log.info(JSON.stringify(res.json(), null, 2))
  }

  app.close()

  function doQuery (userType, query) {
    return app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'x-user-type': userType
      },
      body: {
        query
      }
    })
  }
}

// Query introspection
// {
//   const res = await doQuery(`{
//     __schema {
//       types {
//         name
//       }
//     }
//   }`)
//   serviceGateway.log.info(JSON.stringify(res.json(), null, 2))
// }
