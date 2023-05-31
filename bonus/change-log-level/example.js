'use strict'

async function example () {
  const app = require('fastify')({
    disableRequestLogging: true,
    logger: {
      level: 'error'
    }
  })

  // Register the plugin
  app.register(require('fastify-log-controller'))

  const pluginFn = async function plugin (app, opts) {
    app.get('/', async function handler (request, reply) {
      request.log.info('info message')
      return { hello: 'world' }
    })

    app.register(async function subPlugin (app) {
      app.get('/route', {
        handler: (request, reply) => {
          request.log.info('info message')
          return {}
        }
      })
    }, { logCtrl: { name: 'foo' } })
  }

  const pluginOpts = {
    logCtrl: { name: 'bar' } // ❗️ Set a unique name for the encapsulated context
  }

  // Create an encapsulated context with register and set the `logCtrl` option
  app.register(pluginFn, pluginOpts)

  // Check that the route logs the `hello world` message!
  await app.listen({ port: 3000 })
}

example()
