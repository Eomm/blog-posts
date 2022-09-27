# How to use DataLoader with Mercurius GraphQL?

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you are using Fastify and Mercurius as GraphQL adapter, probably you are looking for a solution
to the N+1 problem. This article will show you how to solve it and speed up your GraphQL application.

> If you are not using Fastify instead, you can read a [Quick Start guide](https://backend.cafe/how-to-log-useful-data-from-a-graphql-request)
> before reading this article.

## What is the N+1 problem?

I must say that I was unable to find out a TL;DR (Too Long; Didn't Read) explanation of the N+1 problem
to suggest you to read it before continuing. So, I will try to explain it with a quick code example
that we are going to fix it in this article.

Let's see is the N+1 problem **in action**.

First of all, we need an application up&running. Let's start with a simple GQL Schema `gql-schema.js`:


```graphql
type Query {
  developers: [Developer]
}

type Developer {
  id: Int
  name: String 
  builtProjects: [Project]
}

type Project {
  id: Int 
  name: String
}
```

Let's connect the previous schema to a Fastify+Mercurius application `app.js`.
_We will use an in-memory database to store the mock data._
_You can find the SQL data used for this article at the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-loader)_

```js
const Fastify = require('fastify')
const mercurius = require('mercurius')
const gqlSchema = require('./gql-schema')

run()

async function run () {
  const app = Fastify({ logger: true })

  // Initialize an in-memory SQLite database
  await app.register(require('fastify-sqlite'), {
    promiseApi: true
  })
  // For the sake of test, we are going to create a table with some data
  await app.sqlite.migrate({ migrationsPath: 'migrations/' })

  const resolvers = {
    Query: {
      // This is the resolver for the Query.developers field
      developers: async function (parent, args, context) {
        const sql = `SELECT * FROM Developers`
        context.app.log.warn('sql: %s', sql)
        return context.app.sqlite.all(sql)
      }
    },
    // This is the resolver for the Developer Typo Object
    Developer: {
      builtProjects: async function (parent, args, context) {
        const sql = `SELECT * FROM Projects WHERE devId = ${parent.id}`
        context.app.log.warn('sql: %s', sql)
        return context.app.sqlite.all(sql)
      },
    }
  }

  app.register(mercurius, {
    schema: gqlSchema,
    graphiql: true,
    resolvers
  })

  await app.listen({ port: 3001 })
}
```

Great, we are ready to start our application by running the `node app.js` command.
Thanks to the `graphiql: true` option, we can open the GraphiQL interface at `http://localhost:3001/graphiql`.

From the GraphiQL interface, we can run the following query by hitting the `Play` button:

```graphql
{
  developers {
    name
    builtProjects {
      name
    }
  }
}
```

Great! You should see the server's output on the right side of the GraphiQL interface.
Instead, if we look at the server's logs, we can see that the server has executed 4 SQL queries:

```json
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Developers"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 1"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 2"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 3"}
```

As you can see, the queries are not optimized because, we run a query to fetch the projects for each developer
instead of fetching all the projects in a single query.

Here you have seen the N+1 problem in action:

- **1**: we run a root query to fetch first data list
- **+N**: we run a query for each item of the previous list to fetch the related data

So, if we have 100 developers, we will run 101 queries instead of 2!
Now that we have seen the problem, let's see how to solve it.

## How to solve the N+1 problem?

There is one main pattern to solve the N+1 problem: **DataLoader**.
The DataLoader allows you to batch and cache the results of your queries and reuse them when necessary.

Mercurius offers you two ways to use DataLoader:

- [**Loader**](https://github.com/mercurius-js/mercurius/blob/HEAD/docs/loaders.md): it is a built-in DataLoader-Like solution that is quick to setup and use. The cons are that it is not as much reusable as DataLoader.
- [**DataLoader**](https://github.com/graphql/dataloader): it is the standard solution to N+1 problem.

In this article, we are going to see both solutions and compare them.

### Mercurius Loader in action

The `loader` feature is a built-in DataLoader-Like solution that is quick to setup and use.
It __replaces__ the `resolvers` option of Mercurius.

Let's see how to use it by optimizing the previous `app.js` example:

```js
  // ... previous code

  const loaders = {
    Developer: {
      builtProjects: async function loader(queries, context) {
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
      // ... previous code
    },
    Developer: {
      // ❌ Delete the `builtProjects` resolver
    }
  }

  // ... previous code

  app.register(mercurius, {
    schema: gqlSchema,
    graphiql: true,
    loaders, // add the loaders option
    resolvers
  })
```

As you can see, we have replaced the `Developer.builtProjects` resolver with the `loaders`'s one.
The difference is that the `loaders` receives an array of queries instead of a single query: Mercurius
will batch the queries and call the `loader` function only once.

In this new loader function you can run a single query to fetch all the data you need and then
you must return a positionally-matched array of results.

Pros:

- It is quick to setup and use
- It is not necessary to pollute the context
- It is managed by Mercurius
- The resolvers are not touched

Cons:

- It is not possible to reuse the loader cache in other resolvers

### DataLoader in action

The DataLoader is the standard solution to N+1 problem. Originally, it was created by Facebook.
Let's see how we can integrate it in our application.

First of all, you should restore the `app.js` file removing the `loaders` configuration.
Finally, we need to install the `dataloader` package:

```bash
npm install dataloader
```

Then we must instantiate a DataLoader for each request, so we need to extend the `context` object:

```js
const DataLoader = require('dataloader')
// ... previous code

  const resolvers = {
    Query: {
      // ... previous code
    },
    Developer: {
      builtProjects: async function (parent, args, context) {
        return context.projectsDataLoader.load(parent.id)
      }
    }
  }

  app.register(mercurius, {
    schema: gqlSchema,
    graphiql: true,
    resolvers,
    context: () => {
      // Instantiate a DataLoader for each request
      const projectsDataLoader = new DataLoader(
        async function (keys) {
          const sql = `SELECT * FROM Projects WHERE devId IN (${keys.join(',')})`
          app.log.warn('sql: %s', sql)
          const projects = await app.sqlite.all(sql)
          return keys.map((id => projects.filter(p => p.devId === id)))
        }
      )

      // decorate the context with the dataloader
      return {
        projectsDataLoader
      }
    }
  })
```

In this new example, we have added to the Mercurius `context` the new `projectsDataLoader` object.
This object is an instance of the DataLoader class that we have imported from the `dataloader` package.

The DataLoader class accepts a function that will be called only once for each batch of queries, as
we have seen in the previous example.
The function receives an array of keys and must return an array of results positionally-matching the input.

Pros:

- It is possible to reuse the loader cache in other resolvers
- It is a standard defacto solution

Cons:

- Requires more code to setup and configure
- The resolvers must use the DataLoader


## Summary

You have now learned how to use DataLoaders with Mercurius by exploring two different solutions to solve
the N+1 problem.

If you have found this useful, you may read [other articles about Mercurius](https://backend.cafe/series/mercurius).

Now jump into the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-loader) and start to play with the GraphQL implemented in Fastify.
Comment and share if you enjoyed this article!
