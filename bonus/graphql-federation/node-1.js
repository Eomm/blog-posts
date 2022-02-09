'use strict'

const faker = require('faker')

const userCounter = 10
const users = Object.freeze(new Array(userCounter).fill(0).map((_, i) => {
  return {
    id: i,
    name: faker.name.findName(),
    bestFriendId: faker.datatype.number({ min: 0, max: userCounter - 1 })
  }
}))

const schema = `#graphql
   type Query {
    zero: User
  }

  type User @key(fields: "id") {
    id: ID!
    name: String
    bestFriend: User
  }
`

module.exports = {
  schema,

  resolvers: {
    Query: {
      zero: function () {
        return users[0]
      }
    },
    User: {
      bestFriend: function (user) {
        return users[user.bestFriendId]
      }
      // async __resolveReference (queries, context) {
      //   context.app.log.info({ queries }, 'User.__resolveReference')
      //   return queries.map(({ obj }) => users[+obj.id])
      // }
    }
  },

  loaders: {
    User: {
      async __resolveReference (queries, context) {
        context.app.log.info({ queries }, 'User.__resolveReference')
        return queries.map(({ obj }) => users[+obj.id])
      }
    }
  }
}
