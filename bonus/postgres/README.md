# Streaming PostgreSQL data with Fastify

## Discover how to stream a massive amount of data from a PostgreSQL database to a Reactjs client

In recent years, we have been surrounded by cool, interactive data visualizations.
These visualizations are powered by datasets stored in databases and made available through APIs.

Clients can then query the API and get the data they need to render the visualization.

But what happens when the dataset is enormous?
And what if the query to access the data is **complex** and **slow**?

You may be used to adding a 'cool' loading animation to your visualization and waiting for the data to be loaded
but this is not the best user experience.

So, we will see how to stream a massive amount of data from a PostgreSQL database to a Reactjs client!

## Build the dataset

I will go fast here because this is not the main topic of this article, and the code is available on [GitHub][repo].

We will create two tables that represent our huge dataset:

| Table | Rows | Description |
| --- | --- | --- |
| `desks` | 200,000 | 200 thousand desks in a building |
| `items` | 10,000,000 | 10 million items on the desks |

The query we are going to analyze is the following:

```sql
  WITH start_time AS (SELECT pg_sleep(1) AS start_time)
  SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
  FROM items
  INNER JOIN desks ON desks.id = items.desk_id
  CROSS JOIN start_time
```

It reads all the items and the desks they are on and returns the result with a row number.

Since the query is not too slow, we need to slow it down to simulate a real-world scenario with multiple joins and aggregations.
The `pg_sleep(1)` forces PostgreSQL to wait for 1 second before returning the result.

Now we can start the PostgreSQL server with a quick Docker command:

```bash
docker run --rm -p 5432:5432 --name fastify-postgres -e POSTGRES_PASSWORD=postgres -d postgres:15-alpine
```

Finally, we can seed the database with the tables and the data with the [`node seed.js` script on GitHub][repo].
It will take a few minutes to complete, but we will have a huge dataset to play with at the end!

## Build the API

We are going to use [Fastify](https://www.fastify.dev/) to build the API,
it has everything we need to build a fast and scalable API in no time 🎉.

But, before writing the code, we need to think about the API we want to build.
Since we want to return a huge amount of data, we can't run the query and return the result in one shot: whatever server we use, it will run out of memory!

So we need to stream the result of the query to the client by using different techniques:

- **Batching**: we can run the query in batches and return the result in chunks.
- **Streaming**: we can stream the result of the query to the client as soon as we get the data.

The Batching approach can be implemented using the SQL language's `LIMIT` and `OFFSET` clauses.
So we don't need any external library to implement it.

The Streaming approach is more complex, but it is more efficient and allows us to return the data as soon as we get it.
A quick Google search will show you that a few libraries can help us with this task:

- [`pg-cursor`](https://www.npmjs.com/package/pg-cursor)
- [`pg-query-stream`][pg-stream]

Both libraries are great, but the `pg-query-stream` has a better API, so we will use it.

> **Note**  
> I tested both `pg-` libraries before noticing that `pg-query-stream` uses `pg-cursor` under the hood 😅
> The performance of the two libraries is the same, so we will discuss `pg-query-stream` only.

Now that we know what to do, we can start writing the code!

### Project setup

We will create a quick project setup.
It is important to note that the code is not optimized for production use. This is to keep it as simple as possible.

If you want to learn more about Fastify, you may find the [Fastify book](https://backend.cafe/fastify-v4-book) helpful!

So, let's start creating a new project from scratch with the following commands:

```bash
# Create the project
mkdir fastify-postgres-high-volume
cd fastify-postgres-high-volume
npm init -y

# Install Fastify
npm install fastify @fastify/postgres

# Install the PostgreSQL driver and utilities
npm install pg pg-query-stream JSONStream
```

Create the `app.js` file with the following content:

```js
const fs = require('fs').promises

// Create the Fastify server
const app = require('fastify')({ logger: true })

// A simple route to serve the Reactjs application
app.get('/', async function serveUi (request, reply) {
  reply.type('text/html')
  return fs.readFile('./index.html')
})

// Register the PostgreSQL plugin to connect to the database
app.register(require('@fastify/postgres'), {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
  max: 20
})

// Register some plugins to implement the API - we will see them later
app.register(require('./lib/batch'))
app.register(require('./lib/stream'))

// Start the server
app.listen({ port: 8080, host: '0.0.0.0' })
```

It is time to scaffold the `lib/batch.js` plugin:

```js
module.exports = async function (app, opts) {
  app.get('/api/batch', queryBatch)
}

async function queryBatch (request, reply) {
  const notImplemented = new Error('Not implemented')
  notImplemented.statusCode = 501
  throw notImplemented
}
```

Let's scaffold the `lib/stream.js` plugin too:

```js
module.exports = async function (app, opts) {
  app.get('/api/stream', queryStream)
}

async function queryStream (request, reply) {
  const notImplemented = new Error('Not implemented')
  notImplemented.statusCode = 501
  throw notImplemented
}
```

We are going to implement the two plugins in the next sections.

The last thing we need to do is to create the `index.html` file that will be served by the server.
I have created a simple Reactjs application in a single HTML file. You can find it on [GitHub][react].
The code is not important for this article, so I will not discuss it here; moreover, we need the API to be up and running to test the client, so we will explore it later.

At this point, we can start the server with the following command:

```bash
node app.js
```

> 💡 Node.js Tip  
> If you are running Node.js 20 or newer, you can use the `node --watch app.js` flag to reload the server when the code changes!
> It doesn't require any external library and is very useful during development.

Once the server is up and running, we can open the browser and navigate to `http://localhost:8080` and
we should see the `index.html` application!

We can now implement the API's business logic!


### Implementing the Batching approach

The Batching approach is the most common one to implement since it is used broadly in the industry to paginate the results of a query.
The idea is to run the query in batches and return the data chunks, so we need two inputs from the client:

- `limit`: the number of rows to return in each chunk.
- `offset`: the number of rows to skip before returning the batch result.

We can get these two values in the `request.query` object by adding a JSON schema to the route that validates the input:

```js
app.get('/api/batch', {
  schema: {
    query: {
      type: 'object',
      properties: {
        offset: { type: 'number', default: 0 },
        limit: { type: 'number', default: 50_000 }
      }
    }
  }
}, queryBatch)
```

The `queryBatch` implementation will look like this:

```js
async function queryBatch (request, reply) {
  // Get the input from the client
  const offset = request.query.offset
  const batchSize = request.query.limit

  // The slow query we want to run
  const slowQuery = `
    WITH start_time AS (SELECT pg_sleep(1) AS start_time)
    SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
    FROM items
    INNER JOIN desks ON desks.id = items.desk_id
    CROSS JOIN start_time

    OFFSET $1
    LIMIT $2;
  `

  // Run the query and return the result
  const result = await this.pg.query(slowQuery, [offset, batchSize])
  return result.rows
}
```

When the client calls the `/api/batch` route, the server will run the `slowQuery` and return the result.

The `this.pg` object is an Application Decorator injected by the `@fastify/postgres` plugin, and it is a PostgreSQL pool!

We can now test the API by running the following command:

```bash
curl http://localhost:8080/api/batch?offset=0&limit=10000
```

The server should return the first 10,000 rows of the result of the `slowQuery`!
Note that the response will pop up in the terminal after 1 second at the latest 🐌.

### Implementing the Streaming approach

The Streaming approach **could** be more complex to implement. However, thanks to the [`pg-query-stream`][pg-stream] library, it is not ✨.

The idea is to stream the result of the query to the client as soon as we get the data.
So we need to create a stream that reads the result of the query and pipe it to the client.
The input we need from the client is the `limit` only because we are going to stream the result and don't need to skip anything.

We can read the `limit` input from the `request.query` object by adding a JSON schema to the route that validates the input:

```js
app.get('/api/stream', {
  schema: {
    query: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50_000 }
      }
    }
  }
}, queryStream)
```

Now we can implement the `queryStream` function:

```js
const QueryStream = require('pg-query-stream')
const JSONStream = require('JSONStream')

async function queryStream (request, reply) {
  // Get the PostgreSQL client from the pool
  const client = await this.pg.connect()

  // The slow query we want to run
  const slowQuery = `
    WITH start_time AS (SELECT pg_sleep(1) AS start_time)
    SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
    FROM items
    INNER JOIN desks ON desks.id = items.desk_id
    CROSS JOIN start_time

    LIMIT $1;
  `

  // Create a new stream that runs the query
  const query = new QueryStream(slowQuery, [request.query.limit], {
    highWaterMark: 500
  })

  // Run the query and return the stream
  const stream = client.query(query)
  stream.on('end', () => { client.release() })
  return stream.pipe(JSONStream.stringify())
}
```

Let's analyze the code:

1. We create a new PostgreSQL client by calling `this.pg.connect()` that returns an available `client` from the pool.
2. We create a new `QueryStream` that will run the same `slowQuery` as the batch implementation except for the `OFFSET` clause:
  - It is important to note that we need to set the `highWaterMark` option to read a good amount of rows from the database. The [default value is 16](https://nodejs.org/api/stream.html#streamgetdefaulthighwatermarkobjectmode), which is too low for our use case!
3. We create a new `stream` by calling `client.query(query)` that will execute the query.
4. We must remember to listen for the `end` event of the `stream` to release the `client` back to the pool.
5. We return the `stream` piped to a `JSONStream` that will convert the result to a JSON string. Fastify will automatically manage the stream and send the result to the client!

We can now test the API by running the following command:

```bash
curl http://localhost:8080/api/stream?limit=10000
```

The server should return the first 10,000 rows of the result of the `slowQuery`!

You should see the result being streamed to the terminal as soon as the server gets the data from the database!
There is no delay between the rows, so the client can start to render the data as soon as it gets it!
The pop-up effect is gone! 🚀

## Build the client

Now that we have the API up and running, we can build the client to test the API and see the effect of the two approaches.
Since I like minimalism 🤣 and don't want to spend too much time on the client, I will use the [Reactjs application][react] I have created before.

It is a simple application with the following features:

- An input to set globally for the application how many rows we must fetch from the API calls.
- A button to call the `/api/batch` route and show the time it takes to get the result.
  - An input to set the maximum number of rows to get for each batch: we can't get all the rows in one shot, or the server will run out of memory!
- A button to call the `/api/stream` route and show the time it takes to get the result.

Here is a screenshot of the application:

![the application UI](../../posts/assets/pg-idle.png)

Now, let's press the buttons and see what happens!

## Results

If we press the buttons with the default values, we will get the following results:

![the application UI results](../../posts/assets/pg-results.png)

It must be noted that the results include the time it takes to parse the data in the browser.

Before analyzing the results, let's try to play with the inputs to see how the results change.

What happens if we increase the batch size to 350,000?

![the application UI results](../../posts/assets/pg-big-batch.png)

The batch approach is much faster than before, and it beats the streaming method!

Let's analyze the results:

| Total Rows | Batch Size | Batch Result Time (sec) | Stream Result Time (sec) | Number of Batches |
| --- | --- | --- | --- | --- |
| 500,000 | 50,000 | ~14 | ~7 🥇 | 10
| 500,000 | 350,000 | ~5 🥇 | ~7 | 2
| 1,000,000 | 350,000 | ~8 🥇 | ~15 | 3
| 3,000,000 | 350,000 | ~30 🥈 | ~30 🥈 | 9
| 3,500,000 | 350,000 | ~36 | ~34 🥇 | 10
| 5,000,000 | 350,000 | ~63 | ~53 🥇 | 15

> Each test result is the best of 3 tests after refreshing the web page and clearing the cache.
> The Fastify server runs locally on a MacBook Pro 2019 and is never restarted during the tests.

The results are exciting!
The streaming approach is faster than the batch approach when the number of batches (calculated by `totalRows / batchSize`) is higher or equal to 10.

Is this a general rule? Let's answer this question by doing some investigating!

Watch this video taken from the Chrome DevTools's Network tab about the 2nd test result:

![the application UI results](../../posts/assets/pg-network.gif)

We can see that the batch approach makes two requests to the server, while the streaming approach makes only one request.
But the `Content Download` time is much higher for the streaming approach.

Could we improve it?
Yes, of course!! Let's try to increase the `highWaterMark` option of the `QueryStream` to 5MB!

```js
const query = new QueryStream(slowQuery, [request.query.limit], {
  highWaterMark: 5e6
})
```

Let's rerun the tests, and you should see that the total time takes ~4/5 seconds for the streaming approach (body parsing included)!
The `Content Download` time is now ~2 seconds, so by increasing the `highWaterMark`, we speed up the download of the data **x2**!

Now, if we rerun the 3rd test with the new `highWaterMark`, the streaming approach ends in ~10 seconds, so we cut down the time by 1/3!

This means that the 10 batches rule is not a general rule to defeat the streaming approach, but it depends on how we configure our stream.

So the speed relation of the two approaches is the following:

- **Batching**: If we have a small number of batches, the batch approach is faster to implement and run. But we can't increase the batch size too much to reduce the number of batches. The 350,000 rows batch size fetched ~30 MB of data; that's way too much for a single set but was helpful for our understanding.

- **Streaming**: It is not always the fastest approach if we don't configure the stream properly. However, it is the most efficient approach because it doesn't require loading all the data in memory before sending it to the client. Moreover, it is the more stable approach in the long run because it doesn't require changing the batch size when the dataset grows, and it lets us build more responsive UI applications.

## Summary

In this article, we have seen how to stream a massive amount of data from a PostgreSQL database to a Reactjs client!
We explored two different approaches, and we have seen how to implement them with Fastify and the `pg-query-stream` library.

The performance of the two approaches has been compared, and we have seen that the streaming approach is the most efficient and stable in the long run — even if it is not always the fastest.

We analyzed the results and found a relation between each approach and its performance.
Now you can choose the best approach for your use case by knowing the pros and cons of each approach!

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!

[repo]: https://github.com/Eomm/blog-posts/tree/HEAD/bonus/postgres/
[react]: https://github.com/Eomm/blog-posts/tree/HEAD/bonus/postgres/index.html
[pg-stream]: https://www.npmjs.com/package/pg-query-stream
