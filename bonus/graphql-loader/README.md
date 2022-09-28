# How to use DataLoader with Mercurius GraphQL?

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you are using Fastify and Mercurius as GraphQL adapter, you are probably looking for a solution
to the N+1 problem. This article will show you how to solve it and speed up your GraphQL application.

> If you are not using Fastify instead, you can read a [Quick Start guide](https://backend.cafe/how-to-log-useful-data-from-a-graphql-request)
> before reading this article.

## What is the N+1 problem?

I must say that I could not find a TL;DR (Too Long; Didn't Read) explanation of the N+1 problem
to suggest you read it before continuing. So, I will try to explain it with a quick code example
that we will fix in this article.

Let's see the N+1 problem **in action**.

First of all, we need an application up&running.
Create a `gql-schema.js` file that will contain a simple GQL Schema string:

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

Let's connect the previous schema to a new `app.js` file, where we will implement a Fastify+Mercurius application.
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
  // For the sake of the test, we are going to create a table with some data
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

So far, so good! You should see the server's output on the right side of the GraphiQL interface.
Instead, if we look at the server's logs, we can see that the server has executed 4 SQL queries:

```json
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Developers"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 1"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 2"}
{"level":40,"hostname":"Eomm","msg":"sql: SELECT * FROM Projects WHERE devId = 3"}
```

As you can see, the queries are not optimized because we run a query to fetch the projects
for each developer instead of fetching all the projects in a single query.

Here you have seen the N+1 problem in action:

- **1**: we run a root query to fetch the first data list
- **+N**: we run a query for each item of the previous list to fetch the related data

So, if we had 100 developers, we would run 101 queries instead of 2!
Now that we have seen the problem, let's solve it.

## How to solve the N+1 problem?

The main pattern to solve the N+1 problem is by using **DataLoaders**.
The DataLoader allows you to batch and cache the results of your queries and reuse them when necessary.

Mercurius offers you two ways to use DataLoader:

- [**Loader**](https://github.com/mercurius-js/mercurius/blob/HEAD/docs/loaders.md): it is a built-in DataLoader-Like solution that is quick to setup and use.
- [**DataLoader**](https://github.com/graphql/dataloader): it is the standard solution to N+1 problem.

In this article, we are going to see both solutions and compare them.

### Mercurius Loader in action

The `loader` feature is a built-in DataLoader-Like solution that is quick to set up and use.
It __replaces__ the Mercurius's `resolvers` option.

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
      // ❌ Delete the `builtProjects` resolver. It would be ignored in any case
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

As you can see, we have replaced the `resolvers.Developer.builtProjects` function with the `loaders` one.
The difference is that the `loaders` receives an array of queries instead of a single `parent` object.
Mercurius will batch the queries and call the `loader` function only once.

In this new loader function, you can run a single query to fetch all the data you need and then
you must return a positionally-matched array of results.

Pros:

- It is quick to setup and use.
- It is not necessary to pollute the context.
- It is managed by Mercurius.
- Clear separation of concerns between the resolvers and the loaders.

Cons:

- It is not possible to reuse the loader's cache in other resolvers.

### DataLoader in action

The `DataLoader` is the standard solution to N+1 problem. Originally, it was created by Facebook.
Let's see how we can integrate it into our application.

First, you should restore the `app.js` file removing the `loaders` configuration.
Second, we need to install the `dataloader` package:

```bash
npm install dataloader
```

Finally, we must instantiate a DataLoader for each request, so we need to extend the `context` object:

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

The `DataLoader` class accepts a `batchLoader` function that will be called only once for each batch of queries.
It supports different ways to accumalate the queries:

- Frame of execution: it is the default behavior. It accumulates the queries until the next tick. It is the same approach used by Mercurius Loader.
- Time frame: it accumulates the queries until the specified time frame.

The `batchLoader` function receives an array of keys as single argument, and it must return an array of results positionally matching the input array. As you can understand, it is the same approach used by Mercurius Loader.

Pros:

- It is a standard defacto solution.
- Flexibility: it is possible to reuse the loader cache in other resolvers.

Cons:

- Requires more code to setup and configure, you need to create your own `context` to access the database.
- The resolvers must be aware and use the `DataLoader` instance.


## Summary

You have now learned how to use DataLoaders with Mercurius by exploring two different solutions to solve
the N+1 problem.
You may think that mixing the resolvers and the loaders could be a good idea. Surely it is doable, but
you must turn off one of the two cache to avoid inconsistencies and it could be a bit confusing to manage.

If you have found this helpful, you may read [other articles about Mercurius](https://backend.cafe/series/mercurius).

Now jump into the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-loader) and start to play with the GraphQL implemented in Fastify.

If you enjoyed this article comment, share and follow me on [twitter](https://twitter.com/ManuEomm)!
