
export default function api (fastify, opts, next) {
  // TODO

  fastify.setErrorHandler(function (error, request, reply) {
    reply.send(error)
  })

  fastify.put('/users/:userId',
    {
      handler: createUser,
      schema: {
        params: {
          userId: { type: 'integer' }
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'integer' },
            username: { type: 'string', maxLength: 32 },
            avatar: { type: 'string', maxLength: 50 },
            discriminator: { type: 'string', maxLength: 5 },
            email: { type: 'string', format: 'email' },
            verified: { type: 'boolean' },
            locale: { type: 'string', maxLength: 2 }
          },
          required: ['id', 'username']
        },
        response: {
          200: {
            type: 'object',
            properties: {
              userId: { type: 'integer' }
            }
          }
        }
      }
    })

  fastify.get('/users',
    {
      handler: searchUsers,
      schema: {
        // TODO
      }
    })

  next()
}

async function createUser (request, reply) {
  const { userId } = request.params

  await this.mongo.client.db()
    .collection('Users')
    .updateOne(
      { id: userId },
      {
        $set: request.body,
        $push: { visits: new Date() },
        $setOnInsert: { created: new Date() }
      },
      { upsert: true })

  request.log.debug('Track user %s', userId)
  return { userId }
}

async function searchUsers (request, reply) {
  return this.mongo.client.collection('Users')
    .find({})
    .toArray()
}
