# How to log useful data from a GraphQL request?

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you are using Fastify and Mercurius as GraphQL adapter, you have faced the problem of logging the data sent by the client.

> If you are not using Fastify, the fastest Node.js web framework and Mercurius GraphQL adapter,
> Nevermind, you will learn how to create it in the next section.

The default log line shows only the same `/graphql` endpoint over and over again:

```json
{
  "level": 30,
  "time": 1660395516356,
  "pid": 83316,
  "hostname": "eomm",
  "name": "gateway",
  "reqId": "req-1",
  "req": {
    "method": "POST",
    "url": "/graphql",
    "hostname": "localhost:60767",
    "remoteAddress": "127.0.0.1",
    "remotePort": 60769
  },
  "msg": "incoming request"
}
```

This is not very useful because you don't know:

- the operation name
- the query sent by the client
- the variables sent by the client

So let's try to add some extra information to the log line to be more effective during debugging.

## How to create a basic GQL application?

Luckily, Fastify and Mercurius are highly extensible and let us to add all the information we need.

First, let's create a sample GraphQL application by creating a new project:

```sh
mkdir demo-logging-gql
cd demo-logging-gql
npm init --yes
npm i fastify mercurius
```

Now we need to add a new `sample-app.js` file:

```js
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

  // Register and load the schema with the GQL adapter
  await app.register(GQL, {
    schema,
    resolvers: {
      // A simple resolver that will execute the query
      readMeaningOfLife: function (schema, args, context, info) {
        return 42
      }
    }
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
```

Great! Now we can run the application with the command:

```sh
node sample-app.js
```

You will see something like:

```
{"level":30,"time":1660401031343,"pid":97351,"hostname":"eomm","name":"sample-app","msg":"Server listening at http://127.0.0.1:8080"}
{"level":30,"time":1660401031346,"pid":97351,"hostname":"eomm","name":"sample-app","msg":"Server listening at http://[::1]:8080"}
{"level":30,"time":1660401031386,"pid":97351,"hostname":"eomm","name":"sample-app","reqId":"req-1","req":{"method":"POST","url":"/graphql","hostname":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1660401031395,"pid":97351,"hostname":"eomm","name":"sample-app","reqId":"req-1","res":{"statusCode":200},"responseTime":8.89283299446106,"msg":"request completed"}
```

As you can see, the log line **does not contain** any info about the query sent by the client.
Let's see how to add this info to the log line!


## How to add the query to the log line?

Mercurius has a lot of [hooks](https://github.com/mercurius-js/mercurius/blob/HEAD/docs/hooks.md) that allow us to execute custom code before or after some tasks.

In this case, we want to log what is being executed before the GQL resolvers are executed.
The `preExecution` hook is the perfect place to do it.

So, we can now edit the `sample-app.js` file by adding this code before the `app.listen()` call:

```js
app.graphql.addHook('preExecution', async function logGraphQLDetails (schema, document, context) {
  console.log('preExecution', schema, document, context)
  return null
})
```

This simple snippet will help us to inspect the hook's arguments and understand what each variable contains.
Returning `null` from the hook will continue the execution of the resolvers.

After some trials, you may find this snippet useful:

```js
app.graphql.addHook('preExecution', function logGraphQLDetails (schema, document, context) {
  // use the request object to log the query. We will get the reqId to be able to match the response with the request
  context.reply.request.log.info({
    graphql: {
      // we need to traverse the document to get the data
      queries: document.definitions
        .filter(d => d.kind === 'OperationDefinition' && d.operation === 'query')
        .flatMap(d => d.selectionSet.selections)
        .map(selectionSet => selectionSet.name.value)
    }
  })

  return null
})
```

The `document` argument is the GraphQL document AST that will be executed. You can find more
details about the document AST in the [GraphQL specification](https://graphql.org/graphql-js/).

Now, re-running the application will log:

```json
{"level":30,"time":1660402270890,"pid":99991,"hostname":"eomm","name":"sample-app","msg":"Server listening at http://127.0.0.1:8080"}
{"level":30,"time":1660402270891,"pid":99991,"hostname":"eomm","name":"sample-app","msg":"Server listening at http://[::1]:8080"}
{"level":30,"time":1660402270901,"pid":99991,"hostname":"eomm","name":"sample-app","reqId":"req-1","req":{"method":"POST","url":"/graphql","hostname":"localhost:80","remoteAddress":"127.0.0.1"},"msg":"incoming request"}
{"level":30,"time":1660402270905,"pid":99991,"hostname":"eomm","name":"sample-app","reqId":"req-1","graphql":{"queries":["readMeaningOfLife"]}}
{"level":30,"time":1660402270911,"pid":99991,"hostname":"eomm","name":"sample-app","reqId":"req-1","res":{"statusCode":200},"responseTime":10.019375085830688,"msg":"request completed"}
```

If we look closely at the log line, we can see that the `graphql` property contains the list of queries that will be executed.

```json
{
  "level": 30,
  "time": 1660402270905,
  "pid": 99991,
  "hostname": "eomm",
  "name": "sample-app",
  "reqId": "req-1",
  "graphql": {
    "queries": [
      "readMeaningOfLife"
    ]
  }
}
```

Note that the `queries` object is an array because we can have multiple queries in a single request!
You can try it by modifying the `sample-app.js` adding a new query:

```js
await doQuery(app, `{
  one:readMeaningOfLife
  two:readMeaningOfLife
}`)
```

## Summary

You have now learned how to use the `preExecution` hook to log the queries that are being executed.
By doing this, you can see the queries that are being executed and be able to extract some metrics to
know the GQL queries usages.

This blog post has been an inspiration to create a mercurius plugin to log the queries and mutations!!
Check it out [`mercurius-logging`](https://github.com/Eomm/mercurius-logging)!

If you have found this useful, you may read [this article](https://backend.cafe/graphql-federation-playground-with-mercurius).

Now jump into the [source code on GitHub](https://github.com/Eomm/fastify-discord-bot-demo/tree/HEAD/bonus/graphql-logging) and start to play with the GraphQL implemented in Fastify.
Comment and share if you enjoyed this article!
