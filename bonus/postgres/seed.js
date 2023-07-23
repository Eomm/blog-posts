const pg = require('pg')

const sql = `
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS desks;

CREATE TABLE desks (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  desk_id INTEGER NOT NULL REFERENCES desks(id)
);


INSERT INTO desks (name) (
  SELECT md5(random()::text) FROM generate_series(1,1000)
);

WITH max_desk AS (
  SELECT MAX(id) AS id FROM desks
)
INSERT INTO items (desk_id) (
  SELECT trunc(random() * max_desk.id) + 1
  FROM generate_series(1,10000000)
  INNER JOIN max_desk ON TRUE
);
`

seed()

// docker run --rm -p 5432:5432 --name fastify-postgres -e POSTGRES_PASSWORD=postgres -d postgres:15-alpine
async function seed () {
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres'
  })

  await client.connect()
  console.log('Connected to Postgres')

  console.time('seed')
  const res = await client.query(sql)
  console.timeLog('seed', `Seeded Postgres with ${res.at(-1).rowCount} rows`)

  await client.end()
  console.log('Disconnected from Postgres')
}
