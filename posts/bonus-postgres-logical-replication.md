# Real-Time Data Replication in Postgres and Node.js

Read it here: [`bonus/postgres-logical-replication/README.md`](../bonus/postgres-logical-replication/README.md)

# Resume data replication in Postgres and Node.js

## How to resume replication from the point where the Node.js application was stopped

This article is a continuation of [Real-time data Replication in Postgres and Node.js](https://backend.cafe/real-time-data-replication-in-postgres-and-nodejs). Before reading this article, I recommend you read the previous one because it provides essential context to the points I cover.

In our previous article, we discussed how to replicate data from a Postgres database to a Node.js application in real-time using logical replication. However, if the Node.js application crashes or stops for some reason, the replication will cease, and we risk losing the data that our system produces in the meantime via another microservice or application.

In this article, I discuss how to resume replication from the last point where the Node.js application stopped
by using a persistent replication slot in the Postgres database. This ensures that our application doesn't lose events produced by other microservices or applications during downtime.


## Creating a replication slot

To resume replication, we need to create a replication slot in the Postgres database. A replication slot is a logical entity that keeps track of changes happening in the database and sends them to the subscriber. The `postgres` package we used in the previous article automatically created a replication slot for us, but it was not persistent, it was a [`TEMPORARY`](https://www.postgresql.org/docs/16/view-pg-replication-slots.html) replication slot that was removed when the subscriber disconnected.

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

  if (!slots.rows.length) {
    const newSlot = await client.query("SELECT * FROM pg_create_logical_replication_slot($1, 'pgoutput')", [slotName])
    console.log('Created replication slot', newSlot.rows[0])
  } else {
    console.log('Slot already exists', slots.rows[0])
  }
}
```

We are using the [`pg_replication_slots`](https://www.postgresql.org/docs/16/view-pg-replication-slots.html) view to check whether a replication slot with the given name already exists. If it doesn't exist then we create a new replication slot using the [`pg_create_logical_replication_slot`](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-REPLICATION) function.

Note that we specified the [`pgoutput` plugin](https://www.postgresql.org/docs/16/protocol-logical-replication.html) in the function to decode the changes in the replication slot. This is the default plugin for logical replication, and it ships with Postgres.
Be aware that there are other plugins, such as:
- [`test_decoding` plugin](https://www.postgresql.org/docs/16/test-decoding.html) is the simplest plugin that ships with Postgres to start building your own custom plugin.
- [`wal2json`](https://packages.ubuntu.com/noble/postgresql-16-wal2json), which must be installed separately in the Postgres database, allowing you to use them in the `pg_create_logical_replication_slot` function.

Note that each plugin has its own advantages and disadvantages, so choose the one that best fits your use case.
The biggest difference if you try to use `test_decoding` versus `pgoutput` is that the former does not accept a publication name
as a parameter while the [latter does](https://github.com/postgres/postgres/blob/3c469a939cf1cc95b136653e7c6e27e472dc0472/src/backend/replication/pgoutput/pgoutput.c#L449-L452). This means that you can use `pgoutput` to filter the changes you want to replicate, while `test_decoding` will replicate all changes in the database without filtering them!

Now, run the `setup-replication.js` file to create a replication slot!

## Configuring the consumer

In the previous article, we already created the `setup-consumer.js` that creates the publications that
our application is interested in. So, we can reuse the same file and just run it — if we haven't already.

As a reminder: you will first need to start the Postgres server and create the `foo` database.

## Resuming the replication

We are ready to create a new `consumer-resume.js` file that will resume replication from the last point where the Node.js application was stopped, so let's jump into it:

```js
import { LogicalReplicationService, PgoutputPlugin } from 'pg-logical-replication'

const client = new LogicalReplicationService({
  user: 'postgres',
  password: 'foopsw'
}, { acknowledge: { auto: false } })

client.on('data', async (lsn, log) => {
  if (log.tag === 'insert') {
    console.log(`${lsn}) Received insert: ${log.relation.schema}.${log.relation.name} ${log.new.id}`)
  } else if (log.relation) {
    console.log(`${lsn}) Received log: ${log.relation.schema}.${log.relation.name} ${log.tag}`)
  }

  await client.acknowledge(lsn)
})

const eventDecoder = new PgoutputPlugin({
  // Get a complete list of available options at:
  // https://www.postgresql.org/docs/16/protocol-logical-replication.html
  protoVersion: 4,
  binary: true,
  publicationNames: [
    'foo_odd',
    'foo_update_only'
  ]
})

console.log('Listening for changes...')
process.on('SIGINT', async () => {
  console.log('Stopping client...')
  await client.stop()
})

await client.subscribe(eventDecoder, 'foo_slot')
```

This time, we are using the [`pg-logical-replication`](https://www.npmjs.com/package/pg-logical-replication) package to demonstrate the resuming of replication. Its low-level API provides us more control over the replication process,
otherwise we would not be able to configure the Plugin to receive only the changes we are interested in.

The code can be explained as follows:

1. We are creating a new `LogicalReplicationService` instance and passing the connection options to it. Note that we are setting the `acknowledge.auto` option to `false` to manually acknowledge the changes; otherwise, they would be automatically acknowledged. By setting this option to `false`, we gain even more control over the process.

2. We are listening to the `data` event to receive changes from the replication slot.
   - At this point, you should process the `log` and apply your business logic. In this case, we're just logging the changes to the console.
   - After processing the changes, you must acknowledge them using the `acknowledge` method; otherwise, the slot will not advance. The `lsn` (**Log Sequence Number**) is the unique identifier for each change in the database and is used to track changes in the replication slot.

3. We are creating a new `PgoutputPlugin` instance and passing it to the `subscribe` method to establish a connection with the replication slot.

To start the application, run the `node consumer-resume.js` file, and it will begin receiving changes from the replication slot. If we did all the steps correctly, you can start the `node producer.js` file that we
wrote in the previous article to produce changes in the database and see the changes in the consumer application.

If you stop the consumer application by pressing `Ctrl+C`, the replication will stop, and the slot will not move forward. However, if you start the `consumer-resume.js` application again, it will resume replication from the last point where it was stopped! 🎉

Moreover, we can see that the output shows only the changes from the `foo_odd` and `foo_update_only` publications, which we configured in the `PgoutputPlugin` instance so we will see updates and inserts with odd `id` numbers only:

```sh
0/15648E0) Received insert: public.foo 18
0/15649A0) Received log: public.foo update
0/1564AF0) Received log: public.foo update
0/1564B80) Received insert: public.foo 20
0/1564C40) Received log: public.foo update
0/1564D90) Received log: public.foo update
0/1564E20) Received insert: public.foo 22
0/1564EE0) Received log: public.foo update
0/1565030) Received log: public.foo update
0/15650C0) Received insert: public.foo 24
```

## Conclusion

In this article, we discussed how to resume replication from the last point where the Node.js application was stopped.

We created a persistent replication slot in the Postgres database and used the `pg-logical-replication` package to demonstrate resuming replication. This ensures that our application doesn't lose data produced by other microservices or applications during downtime.

In doing so, we did not change the `producer.js` file, which means that the producer can continue to produce changes in the database without any issues and the previous Publications setup is still valid: we just configured manually the
replication slot and the new consumer.

Remember, the replication slot retains changes in the database until the slot is dropped or the changes are acknowledged by the subscriber. If not managed properly, this can lead to high disk usage because Postgres will keep the changes in the WAL logs indefinitely instead of removing them.

I hope you enjoyed this article and learned something new!
Does it deserve a comment and a share? 🚀
