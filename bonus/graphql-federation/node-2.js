'use strict'

const schema = `#graphql
extend type Query {
  myTeam: Team
}

type Team {
  components: [User]
}

type User @key(fields: "id") @extends {
  id: ID! @external
}
`

module.exports = {
  schema,

  resolvers: {
    Query: {
      myTeam: function () {
        return {
          components: [
            { id: 1 },
            { id: 2 }
          ]
        }
      }
    }
  }
}
