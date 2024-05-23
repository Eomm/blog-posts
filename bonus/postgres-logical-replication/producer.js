import pg from 'pg' // npm install pg
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

// ?!
// await client.query(`ALTER TABLE "${t.db}"."${t.name}" REPLICA IDENTITY FULL`);
