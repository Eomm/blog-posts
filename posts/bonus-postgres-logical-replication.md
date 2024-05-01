# Real-Time Data Replication in Postgres and Node.js

Read it here: [`bonus/postgres-logical-replication/README.md`](../bonus/postgres-logical-replication/README.md)

# Resume Data Replication in Postgres and Node.js

This article is a continuation of the previous article on [Real-Time Data Replication in Postgres and Node.js](../bonus/postgres-logical-replication/README.md). So before reading this article, I recommend that you read the previous article first.

In our previous article, we discussed how to replicate data from a Postgres database to a Node.js application in real time using logical replication. However, if the Node.js application crashes or stops for some reason, the replication will cease, and we risk losing the data that our system produces in the meantime via another microservice or application.

Today, we will discuss how to resume replication from the last point where the Node.js application stopped!


## Creating a Replication Slot

To resume replication, we need to create a replication slot in the Postgres database. As mentioned in the previous article, a replication slot is a logical entity that keeps track of changes happening in the database and sends them to the subscriber. The `postgres` package that we used in the previous article automatically created a replication slot for us, but it was not persistent—it was a [`TEMPORARY`](https://www.postgresql.org/docs/16/view-pg-replication-slots.html) slot.

Since we want to resume replication from the last point where the Node.js application was stopped, we need to create a persistent replication slot. Let's create one in a new `setup-replication.js` file:

```js
import pg from 'pg'
const { Client } = pg

const client = new Client({ user: 'postgres', password: 'foopsw' })
await client.connect()

await createReplicationSlotIfNotExists('foo_slot')

await client.end()

async function createReplicationSlotIfNotExists (slotName) {
  const slots = await client.query('SELECT * FROM pg_replication_slots WHERE slot_name = $1', [slotName])
  console.log({ slots })

  if (!slots.rows.length) {
    const newSlot = await client.query("SELECT * FROM pg_create_logical_replication_slot($1, 'test_decoding')", [slotName])
    console.log('Created replication slot', newSlot.rows[0])
  }
}
```

We are using the [`pg_replication_slots`](https://www.postgresql.org/docs/16/view-pg-replication-slots.html) view to check whether a replication slot with the given name already exists. If it doesn't exist, we create a new replication slot using the [`pg_create_logical_replication_slot`](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-REPLICATION) function. Note that we specified the [`test_decoding` plugin](https://www.postgresql.org/docs/16/test-decoding.html) in the function to decode the changes in the replication slot. This is the default plugin for logical replication, and it ships with Postgres.
Be aware that there are other plugins like [`wal2json`](https://packages.ubuntu.com/noble/postgresql-16-wal2json), which must be installed separately in the Postgres database, allowing you to use them in the `pg_create_logical_replication_slot` function.

Now, run the `setup-replication.js` file to create a replication slot!

## Resuming the Replication

We are ready to create a new `consumer-resume.js` file and write the business logic, so let's jump into it:

```js
import { LogicalReplicationService, TestDecodingPlugin } from 'pg-logical-replication'

const client = new LogicalReplicationService({
  user: 'postgres',
  password: 'foopsw'
}, { acknowledge: { auto: false } })

client.on('data', async (lsn, log) => {
  if (log.trx) {
    console.log(`${lsn}) Received transaction: ${log.trx}`)
  } else {
    console.log(`${lsn}) Received log: ${log.schema}.${log.table} ${log.action}`)
  }

  await client.acknowledge(lsn)
})

const eventDecoder = new TestDecodingPlugin({})
await client.subscribe(eventDecoder, 'foo_slot')

process.on('SIGINT', async () => {
  await client.stop()
})
```

This time, we are using the [`pg-logical-replication`](https://www.npmjs.com/package/pg-logical-replication) package to demonstrate the resuming of replication. Its API is low-level, providing us with more control over the replication process.

The code can be explained as follows:

1. We are creating a new `LogicalReplicationService` instance and passing the connection options to it. Note that we are setting the `acknowledge.auto` option to `false` to manually acknowledge the changes; otherwise, they would be automatically acknowledged. By setting this option to `false`, we gain more control over the process.

2. We are listening to the `data` event to receive changes from the replication slot.
   - At this point, you should process the `log` and apply your business logic. In this case, we're just logging the changes to the console.
   - After processing the changes, you must acknowledge them using the `acknowledge` method; otherwise, the slot will not advance. The `lsn` (Log Sequence Number) is the unique identifier for each change in the database and is used to track changes in the replication slot.

3. We are creating a new `TestDecodingPlugin` instance and passing it to the `subscribe` method to establish a replication connection with the replication slot.

To start the application, run the `node consumer-resume.js` file, and it will begin receiving changes from the replication slot. If we did all the steps correctly, you can start the `node producer.js` file to produce changes in the database and see the changes in the consumer application.

If you stop the consumer application by pressing `Ctrl+C`, the replication will stop, and the slot will not move forward. However, if you start the consumer application again, it will resume replication from the last point where it was stopped! 🎉


## Conclusion

In this article, we discussed how to resume replication from the last point where the Node.js application was stopped. We created a persistent replication slot in the Postgres database and used the `pg-logical-replication` package to demonstrate resuming replication. This ensures that our application doesn't lose data produced by other microservices or applications during downtime.

Remember, the replication slot retains changes in the database until the slot is dropped or the changes are acknowledged by the subscriber. If not managed properly, this can lead to high disk usage because Postgres will keep the changes in the WAL logs indefinitely instead of removing them.

Another key point is that the `PUBLICATION` and `SUBSCRIPTION` features in Postgres provide more fine-grained control over the events of interest. In contrast, logical replication slots collect all changes in the database, and we must filter them in the subscriber application.

I hope you enjoyed this article and learned something new!
Does it deserve a comment and a share? 🚀
