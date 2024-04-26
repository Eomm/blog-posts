import postgres from 'postgres'

const sql = postgres({
  debug: true,
  user: 'postgres',
  password: 'foopsw',
  publications: [
    'foo_odd',
    'foo_update_only'
  ]
})

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
