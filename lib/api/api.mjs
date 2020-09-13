
export default function api (fastify, opts, next) {
  // TODO
  fastify.get('/', () => 'this is the api')
  next()
}
