'use strict'

const Fastify = require('fastify')
const GQL = require('mercurius')

main()

async function main () {
  const app = Fastify({
    logger: {
      name: 'sample-app',
      level: 'info'
    }
  })

  // A simple GQL schema with a single query
  const schema = `
    type Query {
      readMeaningOfLife: Int
    }
  `

  // Register the schema with the GQL adapter
  await app.register(GQL, {
    schema,
    resolvers: {
      // A simple resolver that will execute the query
      readMeaningOfLife: function (schema, args, context, info) {
        return 42
      }
    }
  })

  app.graphql.addHook('preExecution', function logGraphQLDetails (schema, document, context) {
    // console.log('preExecution', schema, document, context)
    context.reply.request.log.info({
      graphql: {
        queries: document.definitions
          .filter(d => d.kind === 'OperationDefinition' && d.operation === 'query')
          .flatMap(d => d.selectionSet.selections)
          .map(selectionSet => selectionSet.name.value)
      }
    })

    return null
  })

  // Start the server
  await app.listen({ port: 8080 })

  // Now we can run a GQL query
  const res = await doQuery(app, '{ one:readMeaningOfLife }')
  console.log(JSON.stringify(res.json(), null, 2)) // let's see the result

  app.close()
}

function doQuery (app, query) {
  return app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query
    }
  })
}
