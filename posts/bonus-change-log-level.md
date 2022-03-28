# How to change the log level in Fastify

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

Fastify has a built-in logger that you can use out of the box: [`pino`](https://github.com/pinojs/pino).
By default you can configure during the server initialization, but you can also change the log level at runtime!
Let's see how to do it!

## The log level

The log level is the threshold that the logger will use to decide if a message should be logged or not.
The typical log levels are:

- `'fatal'`
- `'error'`
- `'warn'`
- `'info'`
- `'debug'`
- `'trace'`

For example, when the log level is set to `warn`, all the lower levels are filtered out and you will be not able to see them.
So, you will see all the messages that are printed with `warn` or upper levels (`error` and `fatal` in this case).

## Setting the default log level

Typically, you will want to set the log level during the server initialization like this:

```js
const fastify = require('fastify')({
  disableRequestLogging: true,
  logger: {
    level: process.env.LOG_LEVEL
  }
})

fastify.get('/', async (request, reply) => {
  request.log.info('Hello World!')
  return { hello: 'world' }
})

fastify.listen(8080)
```

Doing so, you can setup the log level based on the environment variable `LOG_LEVEL` in order to configure it as:

- `debug`: during the development phase in your laptop
- `error`: when the application is deployed in production

But how could you log a single route?

## Setting a log level per route

❗️ Let's imagine that a new feature has been implemented and you would like to ship it within a low log level.

Fastify makes it easy to do so by using the `logLevel` route's option:

```js
fastify.get('/', { logLevel: process.env.LOG_LEVEL_ROUTE }, async (request, reply) => {
  request.log.info('Hello World!')
  return { hello: 'world' }
})
```

‼️ What if... the new endpoint is under pressure and logs hundred messages per seconds?

Many Log Management Softwares (LMS) are billed per lines, so more logs mean more money 💸

To solve this, you could change the `LOG_LEVEL_ROUTE` environment variable to `debug` and restart the server, but this has some drawbacks:

- you need to schedule the restart of the application or you may need to do it manually
- your system restart could take a considerable amount of time

How to solve this problem?

## Changing the log level at runtime

You may want to change the log level at runtime by updating the [`request.log`](https://www.fastify.io/docs/latest/Reference/Request/)!

```js
let logLevelSwitch = process.env.LOG_LEVEL_ROUTE

setInterval(() => {
  logLevelSwitch = logLevelSwitch === 'debug' ? 'error' : 'debug'
}, 5000)

fastify.get('/', {
  logLevel: 'debug',
  onRequest: (request, reply, done) => {
    console.log(`Changing log level to ${logLevelSwitch}`) // just show the level change
    request.log.level = logLevelSwitch
    done()
  }
}, async (request, reply) => {
  request.log.info('Hello World!')
  return { hello: 'world' }
})
```

In the code example above, we are setting changing the route's log level every 5 seconds, at runtime!

This is a very powerful feature that you can use:

- to reduce your application costs
- to speed up your application setting the log level to `error` when the application is under heavy load and `info` when it is idle
- to debug errors that you can't reproduce in test environments
- monitor the application

Note this is just an example you can start with to adapt to your needs.

## End

This article shows you how much flexibile Fastify and its components are.
Within Fastify you can manipulate and configure everything for each route incrementing your control over your application.

For more Fastify content, follow me on [Twitter](https://twitter.com/ManuEomm)!

Write comments here below or open an issue on GitHub for any questions or feedback!
Thank you for reading!

## Acknowledgements

