
# Real-time data replication in Postgres and Node.js

## Understand how to do a real-time data replication in Postgres with Node.js

In today's fast-paced digital landscape, businesses rely heavily on data to drive decision-making processes. 
Real-time data replication has emerged as a critical capability for organisations seeking to stay ahead of the curve, enabling them to synchronise data across multiple databases seamlessly. 
To make a few practical examples, real-time data replication is essential for scenarios such as:

- Keeping different databases in sync, which is a typical scenario when a company acquires another company and needs to merge the data.
- Relying on a database to trigger events in other systems; for example, when a new user is created in the database, a welcome email is sent without modifying existing code or introducing new architecture components like message queues.
- Keeping an application's in-memory cache in sync with the database to improve the performance of read queries.
- For high availability and disaster recovery scenarios.

As you can see, real-time data replication is a powerful tool that can be used in various scenarios to improve the performance, reliability and scalability of your applications.

In this blog post, we'll explore the power of Postgres replication management, to understand how to do a real-time data replication in Postgres with Node.js.  
_You will need to run some Docker commands to set up a Postgres instance with logical replication enabled, but it is a copy-paste operation._

## Introduction to Postgres replication management

PostgreSQL is a powerful open-source relational database system known for its robust features and extensibility.
One of its standout capabilities is **replication management**, allowing you to replicate data from one database to another in real-time. This feature is invaluable to organisations that require characteristics such as:

- High availability: the primary database fails, and a standby server takes over seamlessly.
- Load balancing: distributing read queries across multiple replicas to improve performance.
- Data distribution: synchronising data across geographically distributed systems.

Postgres offers various mechanisms to support the listed scenarios where each solution has its strengths and use cases.
To list a few:

- Synchronous multimaster replication: a query must be committed on all nodes before returning to the client. Very high availability and data consistency but with a performance cost.
- Write-ahead Log Shipping (WAL): the primary server sends WAL segments to standby servers, which replay them to stay in sync. It's a simple and reliable solution but with a potential for data loss.
- Logical Replication: replicates individual changes (inserts, updates, deletes) rather than entire WAL segments. It's suitable for scenarios such as data warehousing, data distribution and selective replication. Moreover, it allows for more granular control over which tables and changes are replicated and it is possible to replicate data between different versions of Postgres or multiple sources!

The complete list of replication mechanisms can be found in the [Postgres documentation](https://www.postgresql.org/docs/16/different-replication-solutions.html).

In this blog post, we'll focus on [**Logical Replication**](https://www.postgresql.org/docs/16/logical-replication.html) mechanism.

### The WAL file

The Write-ahead Log (WAL) is a fundamental concept in Postgres replication and we mentioned it in the previous section.
The WAL is a file that stores all changes made to the database, such as inserts, updates and deletes, in a sequential manner.
We could say that the WAL is our source of truth, and this file is handled by Postgres to guarantee data consistency and [durability](https://www.postgresql.org/docs/16/wal-reliability.html) in case of a crash or disk failure.

We must discuss the WAL because it is the foundation of Postgres replication. We can configure Postgres to handle the WAL file, and we can use it to replicate data across multiple databases. So we must understand the [`wal_level`](https://www.postgresql.org/docs/16/runtime-config-wal.html#GUC-WAL-LEVEL) configuration parameter.
This parameter defines how much information is written to the WAL file. The possible values are:

- `minimal`: only the information needed to recover from a crash is written to the WAL file.
- `replica`: the default value, it writes enough information to support WAL archiving and replication.
- `logical`: it stores the same information as `replica` and additional information needed for logical replication, so this configuration requires more disk space.

## Developing a real-time data replication system with Node.js

To develop a real-time data replication system with Node.js, we must follow these steps:

1. Initialise the Postgres database.
2. Create a data producer we want to replicate.
3. Create a data consumer that replicates the data through the Postgres replication mechanism.

So let's start!

### Setting up Postgres

We can start our journey into Postgres replication management by starting a Postgres instance and configuring it to support logical replication. Let's use Docker for this task:

```bash
docker run \
  --name demo-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=foopsw \
  postgres:16 \
  postgres -c "wal_level=logical"
```

This command will start a Postgres instance with logical replication enabled, and you can connect to it using the following command:

```bash
docker exec -it demo-postgres psql -U postgres
```

Now, from the Postgres shell, we can create a database and a table to work with:

```sql
CREATE TABLE IF NOT EXISTS foo (
  id SERIAL PRIMARY KEY,
  col1 VARCHAR,
  col2 INT
);
```

To check if the table was created successfully,
the following command lists the user's tables in the database:

```sql
\dt
```

### Creating a data producer

Now that we have our Postgres instance set up, let's create a Node.js application that acts as a data producer.
This application will insert data into the `foo` table we created earlier and represent the source of data replication.
It could be a web application, an IoT device, or any other data source you may have.

Let's create a `producer.js` file and implement the following logic:

- It connects to the Postgres database.
- Every second, it inserts a new row into the `foo` table or updates the last inserted row alternatively.
- It listens for a `SIGINT` signal to gracefully close the connection.

```javascript
import pg from 'pg' // ℹ️ npm install pg
const { Client } = pg

const client = new Client({
  user: 'postgres',
  password: 'foopsw'
})

await client.connect()

let counter = 0
let lastId = 0
const fakeUserInteraction = setInterval(async () => {
  if (counter % 2 === 0) {
    const res = await client.query('INSERT INTO foo (col1, col2) VALUES ($1, $2) RETURNING id', ['Hello world!', counter])
    lastId = res.rows[0].id
    console.log(`Inserted new row: ${lastId}`)
  } else {
    await client.query('UPDATE foo SET col1 = $1, col2 = $2 WHERE id = $3', ['Hello world!!!', 42, lastId])
    console.log(`Updated row ${lastId}`)
  }

  counter++
}, 1000)

process.on('SIGINT', async () => {
  clearInterval(fakeUserInteraction)
  await client.end()
})
```

To run this code the `node producer.js` command is enough.

### Creating a data consumer

The data consumer is the other side of the replication process. It can be another Postgres instance, or even a different a different database engine. Postgres allows us to replicate the data seamlessly across different versions of the Postgres database just by configuring them accordingly (not the topic of this blog post, but there are good [video tutorials](https://www.youtube.com/watch?v=3Z4Hhh5EnLA) for this use case).

Our use case is to replicate the data to a Node.js application! This application will connect to the Postgres database and listen for changes in the `foo` table using the logical replication mechanism.

#### Setting up the data consumer

To set up the data consumer, we must introduce some new Postgres concepts:

- [**Publication**](https://www.postgresql.org/docs/16/logical-replication-publication.html): A publication defines a set of tables and changes to be replicated. We must create a publication to specify which tables and changes are replicated.
- [**Subscription**](https://www.postgresql.org/docs/16/logical-replication-subscription.html): A subscription defines the source of replication (e.g., primary server) and the target replica(s). We must create a subscription to subscribe to changes happening in the `foo` table.
- [**Replication slot**](https://www.postgresql.org/docs/16/warm-standby.html#STREAMING-REPLICATION-SLOTS): A replication slot is like a bookmark in the WAL file that keeps track of the last WAL segment read by a client. It forces the primary server to retain the WAL segments required by any client that is using the replication slot.

We need to create all these objects in the Postgres database before we can start listening for changes.
Let's do it programmatically with Node.js by creating a `setup-consumer.js` file:

```js
import pg from 'pg'
const { Client } = pg

const client = new Client({ user: 'postgres', password: 'foopsw' })
await client.connect()

await createPublicationIfNotExists('foo_even', 'TABLE foo WHERE (id % 2 = 0);')
await createPublicationIfNotExists('foo_update_only', "TABLE foo WITH (publish = 'update');")

await client.end()

async function createPublicationIfNotExists (pubName, condition) {
  const pub = await client.query('SELECT * FROM pg_publication WHERE pubname = $1', [pubName])

  if (!pub.rows.length) {
    await client.query(`CREATE PUBLICATION ${pubName} FOR ${condition}`)
    console.log(`Created publication ${pubName}`)
  } else {
    await client.query(`ALTER PUBLICATION ${pubName} SET ${condition}`)
    console.log(`Updated publication ${pubName}`)
  }
}
```

The code shows how to create and update a publication. When a publication is created, it specifies:

1. Which tables and columns are included in the replication process?
  - If no columns are specified, all columns are included.
  - It is possible to list multiple tables or set `FOR ALL TABLES;` to include all tables in the replication process.
2. Which operations are included in the replication process?
  - The default is to include all operations (inserts, updates, deletes).
  - It is possible to specify only inserts, only updates, or only deletes.

We have created two publications in the code snippet above:

- `foo_even`: it includes only rows where the `id` is an even number.
- `foo_update_only`: it includes only updates.

As shown, the publications are very flexible and can be tailored to specific use cases.

#### Subscribing to changes

Finally, we are ready to create the `consumer.js` file to listen for changes in the `foo` table.
To do so, we will use the [`postgres`](https://www.npmjs.com/package/postgres) module because it provides
a simple way to consume the logical replication data changes or we should implement the [logical replication protocol](https://www.postgresql.org/docs/16/protocol-logical-replication.html) ourselves.
Alternatively, you can use the [`pg-logical-replication`](https://www.npmjs.com/package/pg-logical-replication) library — it depends on your preference.

To create the `consumer.js` file, we can use the following code snippet. So first we must connect to the Postgres database
and list all the publications we want to subscribe to:

```js
import postgres from 'postgres'

const sql = postgres({
  debug: true,
  user: 'postgres',
  password: 'foopsw',
  publications: [
    'foo_even',
    'foo_update_only'
  ]
})
```

Then we can subscribe to the changes happening in the `foo` table:

```js
const eventPattern = '*:foo'
const { unsubscribe } = await sql.subscribe(
  eventPattern,
  (row, { command, relation, key, old }) => {
    console.log({
      command,
      row
    })
  },

  function onConnect () {
    // Callback on initial connect and potential reconnects
    console.log('Connected to the publication')
  }
)

process.on('SIGINT', async () => {
  await unsubscribe()
  process.exit()
})
```

If we run the `node consumer.js` command, we will see the `console.log` output every time the `producer.js`:

- Insert a row with an even ID in the `foo` table.
- Update a row in the `foo` table.

Note that the [`eventPattern`](https://github.com/porsager/postgres?tab=readme-ov-file#subscribe-pattern)
is just a feature of the `postgres` module that allows us to filter the changes we are getting from the database.
The main driver is and will always be the Postgres publication we created earlier with the `setup-consumer.js` script.

So far we did not create the Replication Slot, but the `postgres` module will do it for us by calling
the [`CREATE_REPLICATION_SLOT`](https://www.postgresql.org/docs/16/protocol-replication.html#PROTOCOL-REPLICATION-CREATE-REPLICATION-SLOT) command creating a [`TEMPORARY`](https://github.com/porsager/postgres/blob/cc688c642fc98c4338523d3e281e03bf0c3417b8/src/subscribe.js#L85) slot.
Every subscription needs a Replication Slot to track the changes that they are consuming.

Note that the Replication Slot MUST be deleted or consumed by the client, otherwise — if it isn't then the WAL file
in the primary server will not be truncated and the disk space will grow indefinitely!
Luckily, the `postgres` module creates a temporary replication slot that is automatically deleted
when the connection is closed.

Now our Node.js application is ready to listen for changes in the `foo` table and replicate them in real-time!

## Conclusion

PostgreSQL's replication capabilities are a cornerstone of its reliability and scalability.
We just scratched the surface of what is possible with Postgres replication management,
but we have seen how to set up a real-time data replication system using Node.js and Postgres logical replication.

Another interesting use case is to use the logical replication mechanism to read all the changes happening in the database
while the Node.js application was offline.
This is possible by handling the Replication Slot manually and it can be done with the [`pg-logical-replication`](https://www.npmjs.com/package/pg-logical-replication#2-usage) module's API, but this will be the topic of another blog post!

We hope this blog post has given you a good starting point to explore Postgres replication management further.
Here are some resources to deepen your knowledge:

- https://www.youtube.com/watch?v=WXKxwl9k5Q8
- https://www.youtube.com/watch?v=3Z4Hhh5EnLA
- https://www.youtube.com/watch?v=E6W-ZWVRAHU

Comment and share if you enjoyed this article!
