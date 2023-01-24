# Dynamic GraphQL queries with Mercurius

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you're using [Fastify](https://www.fastify.io) with [Mercurius]() as your GraphQL adapter, you may be looking for some advanced usages.
In this article, we'll explore a real world example with Dynamic GQL queries with Mercurius.

> The example we will discuss is only one scenario that you may encounter as Software Engineer at NearForm!
> If you want to solve these kind of problems, [we are hiring!](https://grnh.se/18177b983us)

## What are Dynamic GraphQL queries?

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
        resolveType (obj, context) {
          return getUserType(context)
        }
      }
    }
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

For the sake of simplicity, we will not list all the tests here,
but you can find the complete complete source code in the [GitHub repository](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-dynamic-queries).

Running the tests with `node test.js` will fail because we have not implemented the business logic yet.
So, let's start writing the code!

## Implementing the server-side Dynamic Queries

To implement the business logic, there are these main steps:

1. Retrieve the user's role from the request headers
2. Manage the GraphQL query to return the correct type based on the user's role

Let's solve the first point.

### How to retrieve the user's role

We can implement the user role retrieval by installing the [`mercurius-auth`](https://github.com/mercurius-js/auth) plugin.

```bash
npm i mercurius-auth@3
```

Then, we can register the plugin in our `app.js` file.
To understand what the plugin does, you can read its documentation.

In the following example, we will compare the `x-user-type` HTTP header with the `@auth` directive we are going to define in the schema.
If they match, the user will be authorized to access the field and run the query.

Let's start by defining the `@auth` directive in the schema:

```graphql
directive @auth(
  role: String
) on OBJECT

# ..same as before

type AdminGrid @auth(role: "admin") {
  totalRevenue: Float
}

type ModeratorGrid @auth(role: "moderator") {
  banHammer: Boolean
}

type UserGrid @auth(role: "user") {
  basicColumn: String
}
```

Then, we can register the plugin in our `app.js` file and implement a simple `searchData` resolver:

```js
async function buildApp () {
  const app = Fastify() // the same as before

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
    },
    Grid: {} // the same as before 
  })

  app.register(require('mercurius-auth'), {
    authContext (context) {
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
```

Now, the user should be able to retrieve the `totalRevenue` field only if the `x-user-type` header is set to `admin`.

Nevertheless, we can't run the tests yet because we have not implemented the second point.

### Implementing the Dynamic Queries

The last step is to implement the dynamic queries.
Right now, our tests are failing with the following error:

> "Cannot query field 'totalRevenue' on type 'Grid'. Did you mean to use an inline fragment on 'AdminGrid'?

The error is correct because we are not using inline fragments to query a Union type.

To overcome this issue, we can use the mercurius [`preValidation`](https://github.com/mercurius-js/mercurius/blob/master/docs/hooks.md#prevalidation) hook.
Let's try to see how it works:

[![](https://mermaid.ink/img/pako:eNptkMFuwjAMhl_F8qlI8AI9TIIG7bIdNnYjHKLE0AqSFCeZQJR3x213nE-W_8_-bT_QRkdY44lN38KP0gEk1vvm0lHIB1it3ob3rw-4FuL7AJv9jviX-DBzm1GHpuo5WkoJRlJFW7z0LmakmRBV2ZbsGUzJLTiTzZ-qJnVb0Y1syfTfgO2EDN-U-hgSDWtcoif2pnOy92OENOaWPGmsJXWGzxp1eAondnF3DxbrzIWWWHrxJtUZOddjfTSXJFVyXY78OT9i-sfzBTsWWD4?type=png)](https://mermaid.live/edit#pako:eNptkMFuwjAMhl_F8qlI8AI9TIIG7bIdNnYjHKLE0AqSFCeZQJR3x213nE-W_8_-bT_QRkdY44lN38KP0gEk1vvm0lHIB1it3ob3rw-4FuL7AJv9jviX-DBzm1GHpuo5WkoJRlJFW7z0LmakmRBV2ZbsGUzJLTiTzZ-qJnVb0Y1syfTfgO2EDN-U-hgSDWtcoif2pnOy92OENOaWPGmsJXWGzxp1eAondnF3DxbrzIWWWHrxJtUZOddjfTSXJFVyXY78OT9i-sfzBTsWWD4)

When a client sends a GraphQL query, the server will process the GQL Document in the `preValidation` hook,
before validating the GQL against the GQL Schema.

In this hook, **we can modify the GQL Document** sent by the user to add the inline fragments.
So, after the `mercurius-auth` plugin registration, we can add the following code:


```js
async function buildApp () {
  const app = Fastify() // the same as before

  await app.register(GQL, {
    // the same as before 
  })

  app.register(require('mercurius-auth'), {
    // the same as before
  })

  app.graphql.addHook('preValidation', async (schema, document, context) => {
    const { visit } = require('graphql')

    const userType = getUserType(context)

    const newDocument = visit(document, {
      enter: (node) => {
        // We check if we must add the inline fragment
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

    // We apply the new AST to the GQL Document
    document.definitions = newDocument.definitions
  })

  return app
}
```


In the previous code, we inspect the GraphQL [Document Abstract Syntax Tree (AST)]((https://backend.cafe/what-is-ast)) to determine if we need to add the inline fragment programmatically.
If we recognize the query as a masked query, we add the inline fragment to the AST and return the modified AST to the GraphQL Document.

By doing this, Mercurius will process the modified GraphQL Document as if the user had sent it with the inline fragment. This means that it will:

- Validate the GraphQL Document against the GraphQL Schema
- Apply the authentication policy
- Resolve the query

With this implementation, when running tests, everything should pass successfully.

## Summary

We have seen how versatile Mercurius is and how simple it is to implement features like dynamic queries in a complex scenario.
While the goal may seem challenging, this server-side implementation provides several benefits such as:

- Avoiding breaking changes on the client side to support new features
- Hiding GraphQL Types from the client through disabling schema introspection
- Applying query optimizations for the client
- Providing a specialized response based on the user type instead of a generic one.

This is just a small example of the possibilities when using Mercurius and manipulating the GraphQL Document.

If you have found this helpful, you may read [other articles about Mercurius](https://backend.cafe/series/mercurius).

Now jump into the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/graphql-dynamic-queries) and start to play with the GraphQL implemented in Fastify.

If you enjoyed this article comment, share and follow me on [twitter](https://twitter.com/ManuEomm)!
