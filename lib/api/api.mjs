
import schema from './schema.mjs'
import casual from 'casual'

export default function api (fastify, opts, next) {
  fastify.setErrorHandler(function (error, request, reply) {
    reply.send(error)
  })

  fastify.put('/users/:userId', {
    handler: createUser,
    schema: schema.createUser
  })

  fastify.get('/users', {
    handler: searchUsers,
    schema: schema.searchUsers
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
        $set: fakeData(request.body),
        $push: { visits: new Date() },
        $setOnInsert: { created: new Date() }
      },
      { upsert: true })

  request.log.debug('Track user %s', userId)
  reply.code(201)
  return { userId }
}

async function searchUsers (request, reply) {
  const { offset, limit } = request.query

  const query = await this.mongo.client.db().collection('Users')
    .find({}, { projection: { _id: 0, visits: { $slice: -1 } } })
    .sort({ 'visits.$0': 1 })
    .skip(offset)
    .limit(limit)

  const total = await query.count()
  const rows = await query.toArray()

  return { rows, total }
}

/**
 * The GDPR don't let us to store personal information
 * without adding burden to this tutorial, so we fake the
 * data
 */
function fakeData (user) {
  user.id = casual.integer(0, 401404362695639040)
  user.username = casual.username
  user.email = casual.email
  return user
}
