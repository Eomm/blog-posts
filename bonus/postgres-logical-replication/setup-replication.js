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

// pg_logical_slot_get_changes('footableslot2', NULL, NULL)

// async function selectLatestChangeset (slotName) {
//   const [currentWalLsn] = await sql`SELECT * FROM pg_current_wal_lsn()`
//   console.log({ currentWalLsn })
//   if (currentWalLsn) {
//     const [walLsn] = await sql`SELECT * FROM  pg_replication_slot_advance(${slotName}::text, ${currentWalLsn.pg_current_wal_lsn})`
//     console.log({ walLsn })
//   }
// }
