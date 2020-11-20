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

## Manage Runtime errors

Let's deep dive into the most interesting kinds of errors: handler's error.
During your application lifecycle it is necessary to validate user input, check data consistency and so on.

So manage errors is a key feature that Fastify support in the best ways possible:

- The [`fastify.setErrorHandler()`](https://www.fastify.io/docs/v3.8.x/Server/#seterrorhandler) deals with all the thrown `Error`
- The [`onError` hook](https://www.fastify.io/docs/v3.8.x/Hooks/#onerror) to enhance the error output in specific encapsulated context (_checkout my [Encapsulation chapter](https://dev.to/eomm/fastify-demo-goes-to-production-499c) to deepon how Fastify implements this design pattern_)
- The [`option.schemaErrorFormatter`](https://www.fastify.io/docs/v3.8.x/Server/#schemaerrorformatter) will improve the default **validation** errors messages
- The [`fastify.setNotFoundHandler()`](https://www.fastify.io/docs/v3.8.x/Server/#setnotfoundhandler) deals with missing routes, the `errorHandler` will not be invoked in this specific case

As we see, Fastify has a lot of tools that can work togheter to archive all your needs to reply with clear errors!

Before we start it is mandatory to clarify that, when you will find the `Error` word, I mean a real instance of:

```js
const e = new Error('some mistake')
```

Instead, an `error object` will be a simple JSON that will describe an output:

```js
const objError = { message: 'some mistake' }
```

This difference is very important because executing these two sentences, is completely different:

```js
reply.send(new Error('foo bar'))
// ...
reply.code(500).send({ message: 'foo bar' })
```

The `send` lifecycle flow is:

```
                        schema validation Error
                                    │
                                    └─▶ schemaErrorFormatter
                                               │
                          reply sent ◀── JSON ─┴─ Error instance
                                                      │
                                                      │          any uncaught Errors
                      reply.send()                    │                 │
                            │                         ▼                 │
       reply sent ◀── JSON ─┴─ Error instance ──▶ setErrorHandler ◀─────┘
                                                      │
                                 reply sent ◀── JSON ─┴─ Error instance ──▶ onError Hook
                                                                                │
                                                                                └─▶ reply sent
```

So, sending an `error object` will not execute these functions at all and what your functions return
may impact the execution of your code, like hooks at first glance!


_You can find a complete code example that replicate that code flow at [github.com/Eomm/fastify-discord-bot-demo](https://github.com/Eomm/fastify-discord-bot-demo/tree/master/bonus/error-handling)_


## Manage Startup errors

These kind of errors are the most common at the beginning of a new application.
They can be triggered by:

- plugins that doesn't start due an error, like a failed db connection
- plugins that doesn't start **in time**, like a pre-fetch to a slow endpoint
- bad usages of the Fastify framework, like definint 2 routes with the same path

To manage these errors you must check the [`listen`](https://www.fastify.io/docs/v3.8.x/Server/#listen) or the [`ready`](https://www.fastify.io/docs/v3.8.x/Server/#ready) results:

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

Instead, if you want ignore the error throws by one plugin _(it should not, but Fastify let you do what you want with your application)_
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

## End

Now, I hope I have been teaching you all you need to know to manage the application errors in your Fastify server!

Write comments below or open an issue on GitHub for any questions or feedback!
Thank you for reading!
