# Fastify Error handlers

All you need to know to control the Fastify errors!

## Error types

Errors in the Fastify world could be gouped in:

1. Startup errors are triggerd when the application starts and the server won't start
1. Runtime errors happen when the server receives an HTTP call and it could be:
   1. Application errors are throws by the developer when the business logic need it
   1. Unexpected errors are throws when there is a bug
   1. Validation errors appear when the submitted data from a client doesn't match the endpoint's JSON schema
   1. 404 errors when the routes doesn't exists

## Manage Startup errors

This kind of error is the most common when developing a fresh new application.
It can be triggered by:

- plugins that doesn't start
- plugins that doesn't start **in time**
- bad usages of the Fastify framework

To manage these errors the most common way is to check the `listen` results:

```js
fastify.register((instance, ops, next) => {
  next(new Error('this plugin failed to load'))
})

fastify.listen(8080, (err) => {
  if (err) {
    // startup error
    fastify.log.fatal(err)
    process.exit(1)
  }
})
```

Instead, if you want ignore the error throws by one plugin _(it should not, but you must be free to do what you want with your code)_
you can manage it like this and the server will start as expected.

```js
fastify.register((instance, ops, next) => {
  next(new Error('this plugin failed to load'))
}).after(err => {
  fastify.log.warn(err, 'Ops, my plugin fail to load, but nevermind')
})
```

Now, lets assume the plugin may throw two errors: one you can ignore and one cannot be ignored:

```js
fastify.register((instance, ops, next) => {
  if (condition) {
    next(new Error('cannot be ignored'))
  } else {
    next(new Error('can be ignored'))
  }
}).after((err, instance, next) => {
  if (err.message === 'cannot be ignored') {
    next(err)
  } else {
    fastify.log.warn(err, 'Ops, my plugin fail to load, but nevermind')
    next()
  }
})
```

### Timeout

As said, the plugin has a maximum amount of time to start correctly.
To customize this timeout you can set the [`pluginTimeout`](https://www.fastify.io/docs/latest/Server/#plugintimeout) option:

```js
const fastify = Fastify({
  pluginTimeout: 100000, // millisec
  logger: true
})
```
