'use strict'

const Fastify = require('fastify')
const GQL = require('mercurius')

main()

async function main () {
  const serviceOne = await buildNode('user', require('./node-1'))
  const serviceTwo = await buildNode('team', require('./node-2'))

  const serviceGateway = await buildGateway([serviceOne, serviceTwo])
  await serviceGateway.listen()

  // Query
  {
    const res = await doQuery(`{
      one:myTeam {
        components {
          name
          bestFriend {
            name
            bestFriend {
              name
            }
          }
        }
      } 

      two:myTeam {
        components {
          name
        }
      }
    }`)
    serviceGateway.log.info(JSON.stringify(res.json(), null, 2))
  }

  // Query introspection
  {
    const res = await doQuery(`{
      __schema {
        types {
          name
        }
      }
    }`)
    serviceGateway.log.info(JSON.stringify(res.json(), null, 2))
  }

  // Mutation
  {
    const res = await doQuery(`
    mutation {
      addComponent 
    }`)
    serviceGateway.log.info(JSON.stringify(res.json(), null, 2))
  }

  serviceGateway.close()

  function doQuery (query) {
    return serviceGateway.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query
      }
    })
  }
}

async function buildNode (name, { schema, resolvers, loaders }) {
  const app = Fastify({
    logger: {
      name,
      level: 'info'
    }
  })
  app.register(GQL, {
    schema,
    resolvers,
    loaders,
    federationMetadata: true,
    allowBatchedQueries: true
  })

  await app.listen()

  return {
    name,
    url: `http://localhost:${app.server.address().port}/graphql`,
    close: () => app.close()
  }
}

async function buildGateway (services) {
  const gateway = Fastify({
    logger: {
      name: 'gateway',
      level: 'info'
      // transport: {
      //   target: 'pino-pretty',
      //   options: {
      //     colorize: true
      //   }
      // }
    }
  })

  await gateway.register(GQL, {
    graphiql: true,
    pollingInterval: 2000,
    gateway: {
      services
    }
  })

  gateway.addHook('onClose', function hook (instance, done) {
    services.forEach(service => service.close())
    done()
  })

  gateway.graphql.addHook('preExecution', logGraphQLDetails)

  return gateway
}

function logGraphQLDetails (schema, document, context) {
  context.reply.request.info({
    graphql: {
      queries: document.definitions
        .filter(d => d.kind === 'OperationDefinition' && d.operation === 'query')
        .flatMap(d => d.selectionSet.selections)
        .map(selectionSet => selectionSet.name.value),
      mutations: document.definitions
        .filter(d => d.kind === 'OperationDefinition' && d.operation === 'mutation')
        .flatMap(d => d.selectionSet.selections)
        .map(selectionSet => selectionSet.name.value)
    }
  })

  return null
}
