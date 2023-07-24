'use strict'

const STREAM_QUERY = `
  WITH start_time AS (SELECT pg_sleep(1) AS start_time)
  SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
  FROM items
  INNER JOIN desks ON desks.id = items.desk_id
  CROSS JOIN start_time
  LIMIT $1
`

module.exports = {
  STREAM_QUERY
}
