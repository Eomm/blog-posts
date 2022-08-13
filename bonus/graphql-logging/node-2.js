'use strict'

const schema = `#graphql
extend type Query {
  myTeam: Team
}

extend type Mutation {
  addComponent: Boolean
}

type Team {
  components: [User]
}

type User @key(fields: "id") @extends {
  id: ID! @external
}
`

const teamComponents = [
  { id: 1 },
  { id: 2 }
]

module.exports = {
  schema,

  resolvers: {
    Query: {
      myTeam: function () {
        return {
          components: teamComponents
        }
      }
    },
    Mutation: {
      addComponent: function () {
        if (teamComponents.length >= 10) {
          throw new Error('Team is full')
        }

        teamComponents.push({ id: teamComponents.length + 1 })
        return true
      }
    }
  }
}
