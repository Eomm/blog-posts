
module.exports = `#graphql
directive @auth(
  role: String
) on OBJECT

type Query {
  searchData: Grid
}

union Grid = AdminGrid | ModeratorGrid | UserGrid


type AdminGrid {
  totalRevenue: Float
}

type ModeratorGrid {
  banHammer: Boolean
}

type UserGrid {
  basicColumn: String
}
`
