'use strict'

const STREAM_QUERY = `
  SELECT items.id, desks.name, row_number() OVER (ORDER BY items.id) AS row_number
  FROM items
  INNER JOIN desks ON desks.id = items.desk_id
  ORDER BY items.id
  LIMIT $1
`

module.exports = {
  STREAM_QUERY
}
