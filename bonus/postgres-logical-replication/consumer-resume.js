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
  } else {
    // console.log(`${lsn}) Received technical log: ${log.tag}`)
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
