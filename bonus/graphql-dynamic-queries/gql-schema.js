
module.exports = `#graphql
directive @auth(
  role: String
) on OBJECT

type Query {
  searchData: Grid
}

union Grid = AdminGrid | ModeratorGrid | UserGrid

type AdminGrid @auth(role: "admin") {
  totalRevenue: Float
}

type ModeratorGrid @auth(role: "moderator") {
  banHammer: Boolean
}

type UserGrid @auth(role: "user") {
  basicColumn: String
}
`
