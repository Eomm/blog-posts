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
