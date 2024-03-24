import postgres from 'postgres'

// Replication slot names may only contain:
//  lower case letters, numbers, and the underscore character
const slotName = 'footableslot2'
const pubName = 'footablepub2'

const sql = postgres({
  debug: true,
  user: 'postgres',
  password: 'postgres',
  publications: [pubName]

})

await createDatabase()

await createReplicationSlot(slotName)
await selectLatestChangeset(slotName)

await createPublication(pubName)
console.log('Initialized database, replication slot, and publication')

const { unsubscribe } = await sql.subscribe(
  '*:foo',
  (row, { command, relation, key, old }) => {
    console.log({
      row,
      key,
      old
    })
  },

  function onConnect () {
    // Callback on initial connect and potential reconnects
    console.log('Connected to the publication')
  }
)

async function createDatabase () {
  await sql`CREATE TABLE IF NOT EXISTS foo (
    id SERIAL PRIMARY KEY,
    col1 VARCHAR,
    col2 INT
  )`
}

async function createReplicationSlot (slotName) {
  const [replicationSlotExists] = await sql`SELECT * FROM pg_replication_slots WHERE slot_name = ${slotName}::text`
  console.log({ replicationSlotExists })

  if (!replicationSlotExists) {
    const [newSlot] = await sql`SELECT * FROM pg_create_logical_replication_slot(${slotName}::text, 'test_decoding')`
    console.log('Created replication slot', newSlot)
  }
}

async function selectLatestChangeset (slotName) {
  const [currentWalLsn] = await sql`SELECT * FROM pg_current_wal_lsn()`
  console.log({ currentWalLsn })
  if (currentWalLsn) {
    const [walLsn] = await sql`SELECT * FROM  pg_replication_slot_advance(${slotName}::text, ${currentWalLsn.pg_current_wal_lsn})`
    console.log({ walLsn })
  }
}

async function createPublication (pubName) {
  const [pub] = await sql`SELECT * FROM pg_publication WHERE pubname = ${pubName}::text`
  if (!pub) {
    await sql`CREATE PUBLICATION ${sql.unsafe(pubName)} FOR TABLE foo`
    console.log('Created publication')
  }

  // await client.query(
  //   `ALTER PUBLICATION ${this.publicationName} SET TABLE ${tableIdentifiersForPublication.join(', ')}`,
  // );
}
