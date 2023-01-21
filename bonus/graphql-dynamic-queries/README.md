# Dynamic GraphQL queries with Mercurius

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you're using [Fastify](https://www.fastify.io) with [Mercurius]() as your GraphQL adapter, you may be looking for some advanced usages.
In this article, we'll explore a real world example with Dynamic GQL queries with Mercurius.

> The example we will discuss is only one scenario that you may encounter as Software Engineer at NearForm!
> If you want to solve these kind of problems, [we are hiring!](https://grnh.se/18177b983us)

## What are Dynamic GQL queries?

A dynamic GraphQL query is a query that is constructed at runtime, based on the needs of the client.
This is useful when the client is uncertain of the structure of the data and needs to retrieve specific data based on conditions,
or when the client needs to retrieve a subset of data depending on the user's role or permissions.

In our use case, we want to invert the control of query dynamicity from the client to the server.
This means that the client will send a standard GQL query and the server will return the data based on:

- the client's query
- the user's role

It's important to note that we are not talking about returning a subset of a generic GraphQL type,
but a **completely different GraphQL type**.

## Defining the schema

When creating a GraphQL server, the first step is to define the schema.
The GraphQL specification provides clear guidance on how to accomplish our target by utilizing [GraphQL Unions](https://graphql.org/learn/schema/#union-types).

Unions in GraphQL allow for multiple types to be returned from a single field, making it a powerful tool for querying related data.
This can be especially useful when retrieving data from multiple types in a single query.

To begin, let's define our schema using GraphQL Unions.

```graphql
type Query {
  searchData: Grid
}

union Grid = AdminGrid | ModeratorGrid | UserGrid


type AdminGrid {
  totalRevenue: Float
}

type ModeratorGrid {
  banHammer: Boolean
}

type UserGrid {
  basicColumn: String
}
```

As you can see, our schema includes a Query type with a `searchData` field that returns a `Grid` union type.
This Grid union type can represent one of three possible types: `AdminGrid`, `ModeratorGrid`, or `UserGrid`.

Currently, the client can send a query using [inline fragments](https://graphql.org/learn/queries/#inline-fragments) like this:

```graphql
query {
  searchData {
    ... on AdminGrid {
      totalRevenue
    }
    ... on ModeratorGrid {
      banHammer
    }
    ... on UserGrid {
      basicColumn
    }
  }
}
```

While this is a valid query, **it is not the desired outcome**.
We aim to return a different type based on the user's role, so that the client can send a query like this:

```graphql
query {
  searchData {
    totalRevenue
  }
}
```

It's important to note that the above query is not valid against the schema defined above,
but with some additional implementation, **we can make it work**!

## Implementing the business logic

Let's start building the basic implementation of our server.
You can skip this section if you are already familiar with Fastify and Mercurius.

The first step is to install the necessary dependencies.

```bash
mkdir graphql-dynamic-queries
cd graphql-dynamic-queries
npm init -y
npm install fastify@4 mercurius@11
```

Now, copy the schema we defined above in a `gql-schema.js` file,
then you need to create an `app.js` file where we will write our server:

```js
const Fastify = require('fastify')
const GQL = require('mercurius')
const schema = require('./gql-schema')

// For simplicity, we will start the server only if started with `node app.js run`
if (process.argv[2] === 'run') {
  buildApp()
    .then(app => app.listen({ port: 8080 }))
}

async function buildApp () {
  const app = Fastify({ logger: true })

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
```

To verify that everything is working, you can start the server running `node app.js run` and you should
see the following output:

```bash
Server listening at http://127.0.0.1:8080
```

Great! Now we must list all the use cases we want to implement by adding some test cases.

### Testing our server

We want to test our server with the following use cases:

- A user with the `admin` role should be able to retrieve the `totalRevenue` field without inline fragments
- A user with the `moderator` role should be able to retrieve the `banHammer` field without inline fragments
- A user with the `user` role should be able to retrieve the `basicColumn` field without inline fragments
- A user without the `admin` role should not be able to retrieve the `totalRevenue` field
- A user without the `moderator` role should not be able to retrieve the `banHammer` field
- A user without the `user` role should not be able to retrieve the `basicColumn` field
- A user without any role should not be able to retrieve any field

We must install the required dependencies:

```bash
npm install tap@15 -D
```

We can write these tests in a `test.js` file. 

```js
const { test } = require('tap')

const buildApp = require('./app')

test('A user with the `admin` role should be able to retrieve the `totalRevenue` field without inline fragments', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'admin', `
    query {
      searchData {
        totalRevenue
      }
    }
  `)

  t.same(res.data.searchData, { totalRevenue: 42 })
})

// TODO: add the other tests

async function doQuery (app, userType, query) {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'x-user-type': userType
    },
    body: {
      query
    }
  })

  return res.json()
}
```

For the sake of simplicity, we will not write all the tests here,
but you can find the complete code in the [GitHub repository](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-dynamic-queries).

Running the tests with `node test.js` will fail because we have not implemented the business logic yet.
So, let's start writing the code!

## Implementing the server-side Dynamic Queries



## Summary

todo

If you have found this helpful, you may read [other articles about Mercurius](https://backend.cafe/series/mercurius).

Now jump into the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/graphql-dynamic-queries) and start to play with the GraphQL implemented in Fastify.

If you enjoyed this article comment, share and follow me on [twitter](https://twitter.com/ManuEomm)!
