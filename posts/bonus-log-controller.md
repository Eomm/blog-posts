# Unlock the Power of Runtime Log Level Control

As a backend developer, logging is an essential aspect of monitoring and debugging applications.
Traditionally, changing the log level of an application required restarting it or modifying the configuration and redeploying.

However, there are scenarios where changing the log level at runtime becomes necessary to efficiently monitor and troubleshoot applications.
This article introduces a the new [`fastify-log-controller`](https://github.com/Eomm/fastify-log-controller) plugin that enables changing the log level of your application at runtime, without the need for restarts or resetting the in-memory state!


## The wrong log level

Fastify is awesome, and it provides a lot of logging features out of the box:

- One log level for the entire application
- One log level for each encapsulated context
- One log level for each route

This means that you can write this code to customize the log level of your application:

```js
const fastify = require('fastify')({
  logger: {
    level: 'error', // 🔵 application log level
  },
})

fastify.register(somePlugin, {
  logLevel: 'info', // 🔵 encapsulated context log level
})

fastify.get('/some-route', {
  logLevel: 'debug', // 🔵 route log level
  handler: async () => {
    return { hello: 'world' }
  }
})
```

This feature is useful when you want to reduce the noise of the logs or increase the verbosity of a specific context or route.
Although this feature is powerful, it's not possible to change it at runtime by default.  
So, if you don't implement a custom solution, you can't adapt to changing debugging or monitoring requirements without **restarting the application**! -and in the worst case, you may need to **redeploy the application** if the log level is defined in the configuration file!

Sometimes, you may need to increase the log level to get more detailed logs for specific contexts or decrease it to reduce the noise. Having the ability to modify the log level dynamically can significantly enhance the debugging and monitoring capabilities of your application, helping your support team to troubleshoot issues faster 🚀!


## How to change the log level at runtime

The [`fastify-log-controller`](https://github.com/Eomm/fastify-log-controller) plugin provides a simple and elegant solution to the problem of changing log levels at runtime.  
By registering this plugin in your Fastify application, it automatically adds a new route at `POST /log-level` _(configurable)_ that allows you to control the log levels for different encapsulated contexts!

To use this plugin, you need to follow these steps:

1. Install the plugin and register it in your Fastify application
2. Assign to each encapsulated context or route a unique name
3. Call the `POST /log-level` route to change the log level of a specific unique name


Here is the first step:

```bash
npm install fastify-log-controller
```

Create a new file `example.js` and add the following scaffold:

```js
async function example () {
  const app = require('fastify')({
    disableRequestLogging: true, // Disable the default request logging to reduce the noise
    logger: {
      level: 'error'
    }
  })

  // Register the plugin
  app.register(require('fastify-log-controller'))

  // 📝 ... Define your routes and encapsulated contexts ... 📝

  // Check that the route logs the `hello world` message!
  await app.listen({ port: 3000 })
}

example()
```

Now let's see how to change the log level of a specific encapsulated context.

### Customize the log level of an encapsulated context

To customize the log level of an encapsulated context, you need to assign a unique name to it.
So, modify the `example.js` file as follows:

```js
  // .. app.register(require('fastify-log-controller'))

  const pluginFn = async function plugin (app, opts) {
    app.get('/', async function handler (request, reply) {
      request.log.info('info message')
      return { hello: 'world' }
    })
  }

  const pluginOpts = {
    logCtrl: { name: 'bar' } // ❗️ Set a unique name for the encapsulated context
  }

  // Create an encapsulated context with register and set the `logCtrl` option
  app.register(pluginFn, pluginOpts)

  // ... await app.listen({ port: 3000 })
```

Now, if you run the application with `node example.js`, you shouldn't see any log message in the console.
Even if you call the `/` route, the log level is set to `error`, and the `info` message is not logged.

To change the log level of the `bar` encapsulated context, you need to call the `POST /log-level` route with the following payload:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"level": "debug", "contextName": "bar"}' \
  http://localhost:3000/log-level
```

Now, if you call the `/` route, you should see the `info` message in the console!
Since the log level of the `bar` encapsulated context is set to `debug`, the `info` message is logged.

> **Note**  
> Changing the log level of an encapsulated context will change the log level of all the routes registered in it!

### Customize the log level of a route

To customize the log level of a route, you need to do the same thing as for the encapsulated context.
In this case you will need to wrap the route with the `register` method and set the `logCtrl` option as before.

So, modify the `example.js` file as follows:

```js
  // .. app.register(require('fastify-log-controller'))

  const pluginFn = async function plugin (app, opts) {
    app.get('/', async function handler (request, reply) {
      request.log.info('info message')
      return { hello: 'world' }
    })

    // Wrap the route with register and set the `logCtrl` option as before
    app.register(async function subPlugin (app) {
      app.get('/route', {
        handler: (request, reply) => {
          request.log.info('info message')
          return {}
        }
      })
    }, { logCtrl: { name: 'foo' } })
  }

  // ... const pluginOpts = {
```

Now, if you run the application with `node example.js`, you shouldn't see any log message in the console.
Even if you call the `/route` URL, the log level is set to `error`, and the `info` message is not logged.

To change the log level of the `/route` route, you need to call the `POST /log-level` route with the following payload:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"level": "debug", "contextName": "foo"}' \
  http://localhost:3000/log-level
```

Now, if you call the `/route` route, you should see the `info` message in the console and the `bar` encapsulated context is untouched!

> **Note**  
> If you want more features like changing the log level of the entire application, you can [open a feature request](https://github.com/Eomm/fastify-log-controller/issues/2)!

### Plugin options

The `fastify-log-controller` plugin accepts the following options:

- `optionKey: string` _(default: `logCtrl`)_  
  The key used to set the log level of an encapsulated context or route.
- `routeConfig: object` _(default: `{}`)_  The object can contain the [Fastify route configuration](https://www.fastify.io/docs/latest/Reference/Routes/#routes-options).
  The configuration of the `POST /log-level` route. You can't change the `handler` and `schema` properties only - so you will be able to add an authentication strategy.


## Summary

In this article you have found a convenient solution to the problem of changing log levels at runtime in a Fastify application. By registering this plugin, you gain the ability to dynamically control the log levels for different encapsulated contexts without the need for application restarts or resetting the in-memory state.

This plugin introduces a new route at `/log-level`, allowing you to send a `POST` request to modify the log level for a specific encapsulated context. With the ability to adjust log levels at runtime, you can fine-tune your logging strategy, enabling more detailed logs for debugging or reducing noise in production environments.

If you want to go deeper into the encapsulated context concept, you can read these sources:

- [YouTube Video](https://www.youtube.com/watch?v=BnnL7fAKqNU)
- [Complete Guide to Fastify plugin system](https://backend.cafe/the-complete-guide-to-the-fastify-plugin-system)
- [What is the exact use of `fastify-plugin`](https://stackoverflow.com/questions/61020394/what-is-the-exact-use-of-fastify-plugin/61054534#61054534)

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
