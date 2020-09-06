
import Fastify from 'fastify'
import app from './app.mjs'

const server = Fastify({
  logger: true,
  pluginTimeout: 10000
})

server.register(app)

server.listen(process.env.PORT || 3000, '0.0.0.0', (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
