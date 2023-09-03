# GraphQL Federation Playground with Mercurius

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

You are going to read about a GraphQL project that is perfect for playing with to skill up on GraphQL by using:

- The [Mercurius](https://github.com/mercurius-js/mercurius) GraphQL server
- The [Fastify](https://github.com/fastify/fastify) web framework
- The [GraphQL Federation](https://www.apollographql.com/docs/federation/) architecture

This project is a playground to test the GraphQL Federation architecture with the Mercurius server. 

The Federation architecture is a way to share data between distributed GraphQL servers applying the microservices architecture into the GraphQL standard.

The project spins up 2 + 1 nodes:

- `user`: it represents the user data
- `team`: it represents a set of users
- the gateway: it connects all the nodes into a federation graph

⚠️ As prerequisites, you should be familiar with the GraphQL basic concepts. Before continuing with this article, you can take a tour of the [official tutorial](https://graphql.org/learn/).

## Creating a GraphQL Node

Creating a node by using the Fastify+Mercurius toolkit is very easy.
You need to:

- Create a Fastify instance
- Register the Mercurius plugin

```js
async function buildService (name, { schema, resolvers, loaders }) {
  const app = Fastify({ 
    logger: {
      name,
      level: 'info'
    }
  })

  app.register(GQL, {
    schema, // the GraphQL schema
    resolvers, // the GraphQL resolvers
    loaders, // the GraphQL loaders
    federationMetadata: true,
    allowBatchedQueries: true
  })

  await app.listen() // start the node
}
```

By implementing the `buildService` function, you can focus on the business logic of your node without worrying about the infrastructure.

## The `user` GraphQL Node

Now we can focus on the business logic of the node by creating a `node-1.js` file.

The `User` is made of a `name` property and it always has a `bestFriend`.
We need a simple `Query` to get a user too.

So, the node must:

- access to the users dataset
- expose the `User` GraphQL type
- implement a simple query to get a user

The schema will look like this:

```graphql
type Query {
  zero: User
}

type User @key(fields: "id") {
  id: ID!
  name: String
  bestFriend: User
}
```

The implementation of this schema requires:

- A `Query.zero` resolver that returns the user with id `0`
- A `User.bestFriend` resolver that returns the best friend of the user

Implementing the resolvers is relatively straightforward:

```js
// a fake database
const users = [
  { id: 0, name: 'Mathew Deckow', bestFriendId: 1 },
  { id: 1, name: 'Van McKenzie', bestFriendId: 8 },
  { id: 2, name: 'Jay Roob', bestFriendId: 2 },
  { id: 3, name: 'Deborah Spencer', bestFriendId: 7 },
  { id: 4, name: 'Vivian Murphy', bestFriendId: 6 },
  { id: 5, name: 'Meredith Mitchell', bestFriendId: 0 },
  { id: 6, name: 'Kate Deckow', bestFriendId: 5 },
  { id: 7, name: 'Beth Hodkiewicz IV', bestFriendId: 3 },
  { id: 8, name: 'Sheryl Schaden', bestFriendId: 5 },
  { id: 9, name: 'Heather Veum', bestFriendId: 9 }
]

module.exports = {
  schema,

  resolvers: {
    Query: {
      zero: async function () {
        return users[0]
      }
    },
    User: {
      bestFriend: async function (user) {
        return users[user.bestFriendId]
      }
    }
  },
}
```

Now you can call this simple node by instantiating it in a `start.js` file:

```js
const serviceOne = await buildNode('user', require('./node-1'))
const response = await serviceOne.inject({
  method: 'POST',
  url: '/graphql',
  body: {
    query: `{
      zero {
        name
        bestFriend {
          name
        }
      }
    }`
  }
})
```

And you can see the result:

```json
{
  "data": {
    "zero": {
      "name": "Charlie Pacocha",
      "bestFriend": {
        "name": "Glenda Ankunding"
      }
    }
  }
}
```

## The `team` GraphQL Node

The `team` node will have a `Query` that returns a list of users that compose a team.

The schema will look like this:

```graphql
type Query {
  myTeam: Team
}

type Team {
  components: [User]
}

type User @key(fields: "id") @extends {
  id: ID! @external
}
```

As you can see, the `@extends` directive is used to extend the `User` GraphQL type and declare the `id` field as an external field. This is part of the GraphQL Federation standard.

The `node-2.js` resolver will be very basic, but you can add more complex logic to it. Note that we set the `async` keyword: you will be able to run asynchronous code in every resolver function!

```js
module.exports = {
  schema,

  resolvers: {
    Query: {
      myTeam: async function () {
        return {
          components: [
            { id: 1 },
            { id: 2 }
          ]
        }
      }
    }
  }
}
```

🔮 Every time you set the `@external` directive, you must remember to set the special `__resolveReference` resolver function in the target node.

In this case, we need to update the `node-1.js` file adding a loader:

```js
module.exports = {
  schema,

  resolvers: {
    Query: {
      zero: function () {
        return users[0]
      }
    },
    User: {
      bestFriend: function (user) {
        return users[user.bestFriendId]
      }
    }
  },

  loaders: {
    User: {
      async __resolveReference (queries, context) {
        return queries.map(({ obj }) => users[+obj.id])
      }
    }
  }
}
```

Note that the `__resolveReference` function is defined as `loader` to solve the [N+1 problem](https://shopify.engineering/solving-the-n-1-problem-for-graphql-through-batching).
You can add the `__resolveReference` as `resolver` too, but you slow down your node: I encourage you to add some `console.log` and experiment. You will see that:

- The loader's `__resolveReference` is called grouping the queries by the target type.
- The resolver's `__resolveReference` is called multiple times for each query with nested fields.
- If the `__resolveReference` is defined in both the loader and the resolver, the loader's one is called.

## The Gateway GraphQL Node

Finally, the last step is to create the `gateway` node.
It is a node that will connect the other nodes with a dedicated GraphQL configuration:

```js
const gateway = Fastify()

gateway.register(GQL, {
  graphiql: true,
  pollingInterval: 2000,
  gateway: {
    services: [
      {
        name: 'user',
        url: 'http://localhost:53114/graphql',
      },
      {
        name: 'team',
        url: 'http://localhost:53115/graphql',
      }
    ]
  }
})

gateway.listen(3000)
```

Now you can access the GraphQL API from the browser: [http://localhost:3000/graphiql](http://localhost:3000/graphiql) and you will be able to run the query:

```graphql
{
  myTeam {
    components {
      name
      bestFriend {
        name
        bestFriend {
          name
          bestFriend {
            name
          }
        }
      }
    }
  }
}
```

It is interesting to note the logs of the nodes:

1. During the startup of the gateway, the `node-1` and `node-2` are queried by the gateway getting the GraphQL schemas.
2. The gateway receives the query to execute, and it will call the `team` node to get the list of users.
3. The gateway receives the `team` node's response, and it will call the `user` node to get the users.
4. The `user` node resolves the `bestFriend` field internally using the loader and type's resolver.

```log
# startup
{"level":30,"name":"user","msg":"Server listening at http://127.0.0.1:53176"}
{"level":30,"name":"team","msg":"Server listening at http://127.0.0.1:53177"}
{"level":30,"name":"team","reqId":"req-1","req":{"method":"POST","url":"/graphql","hostname":"localhost:53177","remoteAddress":"127.0.0.1","remotePort":53178},"msg":"incoming request"}
{"level":30,"name":"team","reqId":"req-1","res":{"statusCode":200},"responseTime":6.589166045188904,"msg":"request completed"}
{"level":30,"name":"user","reqId":"req-1","req":{"method":"POST","url":"/graphql","hostname":"localhost:53176","remoteAddress":"127.0.0.1","remotePort":53179},"msg":"incoming request"}
{"level":30,"name":"user","reqId":"req-1","res":{"statusCode":200},"responseTime":1.2786250114440918,"msg":"request completed"}
{"level":30,"name":"gateway","msg":"Server listening at http://127.0.0.1:53208"}
# query execution
{"level":30,"name":"gateway","reqId":"req-1","req":{"method":"POST","url":"/graphql","hostname":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"name":"team","reqId":"req-2","req":{"method":"POST","url":"/graphql","hostname":"localhost:53177","remoteAddress":"127.0.0.1","remotePort":53178},"msg":"incoming request"}
{"level":30,"name":"team","reqId":"req-2","res":{"statusCode":200},"responseTime":0.835334062576294,"msg":"request completed"}
{"level":30,"name":"user","reqId":"req-2","req":{"method":"POST","url":"/graphql","hostname":"localhost:53176","remoteAddress":"127.0.0.1","remotePort":53179},"msg":"incoming request"}
{"level":30,"name":"user","queries":[{"obj":{"__typename":"User","id":"1"},"params":{}},{"obj":{"__typename":"User","id":"2"},"params":{}}],"msg":"User.__resolveReference"}
{"level":30,"name":"user","reqId":"req-2","res":{"statusCode":200},"responseTime":2.0201669931411743,"msg":"request completed"}
{"level":30,"name":"gateway","reqId":"req-1","res":{"statusCode":200},"responseTime":7.0754170417785645,"msg":"request completed"}
```

Now jump into the [source code on GitHub](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/graphql-federation) and start to play with the GraphQL Federation implemented in Fastify.
Comment and share if you enjoyed this article!
