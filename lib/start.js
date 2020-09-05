
import Fastify from 'fastify'
import dotenv from 'dotenv'

import app from './app.js'

dotenv.config()

const server = Fastify({
  logger: process.env.NODE_ENV === 'development',
  pluginTimeout: 10000
})

server.register(app)

server.listen(process.env.PORT || 3000, '0.0.0.0', (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
