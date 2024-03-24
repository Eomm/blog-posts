import pg from 'pg'
const { Client } = pg

const client = new Client({
  user: 'postgres',
  password: 'postgres'
})

await client.connect()

await client.query('INSERT INTO foo (col1, col2) VALUES ($1, $2)', ['Hello world!', 42])
console.log('Inserted new row')

await client.query('UPDATE foo SET col1 = $1, col2 = $2 WHERE id = $3', ['Hello world!!!', 52, 1])
console.log('Updated row')

await client.end()

// ?!
// await client.query(`ALTER TABLE "${t.db}"."${t.name}" REPLICA IDENTITY FULL`);
