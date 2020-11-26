---
title: Fastify Error handlers
series: Fastify Bonus
---

# Fastify Error handlers

All you need to know to control the **Fastify v3** errors!

## Error types

Errors in the Fastify world could be grouped in:

1. Startup errors are triggered when the application starts and the server won't start
1. Runtime errors happen when the server receives an HTTP call and the server will remain up&running:
   1. Application errors are throws by the developer when the business logic need it
   1. Unexpected errors are throws when there is a bug
   1. Validation errors appear when the submitted data from a client doesn't match the endpoint's JSON schema
   1. 404 errors when the requested route doesn't exist

## Manage Runtime errors

Let's deep dive into the most interesting kinds of errors: handler's error.
During your application lifecycle, it is necessary to validate user input, check data consistency and so on.

So manage errors is a key feature that Fastify support through these options:

- The [`fastify.setErrorHandler()`](https://www.fastify.io/docs/v3.8.x/Server/#seterrorhandler) deals with all the thrown and sent `Error`s
- The [`onError` hook](https://www.fastify.io/docs/v3.8.x/Hooks/#onerror) to enhance the error output in specific encapsulated context (_checkout my [Encapsulation chapter](https://dev.to/eomm/fastify-demo-goes-to-production-499c) to deep on this design pattern_)
- The [`option.schemaErrorFormatter`](https://www.fastify.io/docs/v3.8.x/Server/#schemaerrorformatter) will improve the default **validation** errors messages
- The [`fastify.setNotFoundHandler()`](https://www.fastify.io/docs/v3.8.x/Server/#setnotfoundhandler) deals with missing routes, the `errorHandler` may  not be invoked in this case

As we see, Fastify has a lot of tools that can work together to archive all your need to reply with clear errors!

The first aspect to explain is the difference between:

- throwing an `Error`: this happens when an `Error` instance is processed
- sending a `JSON error`: this happens when an HTTP status code >= 300 is set and a JSON is processed
- unexpected exception: this happens due to nasty bug, don't worry, Fastify will handle it for you!

Here a code example in a sync and async handler:

```js
function callbackStyleHandler (request, reply) {
  // "throwing" an error
  reply.send(new Error('foo bar error'))
  // ...or sending a json error
  reply.code(500).send({ message: 'foo bar error' })
  // ...or unexpected exception
  'this is not an array'.sort() // fastify will handle the TypeError for you
}

async function asyncHandler (request, reply) {
  // "throwing" an error
  throw new Error('foo bar error')
  // ...or sending a json error
  reply.code(500)
  return { message: 'foo bar error' }
  // ...or unexpected exception
  'this is not an array'.sort() // fastify will handle the TypeError for you
}
```

So, based on what you are sending (in sync handlers) or returning (in async handler), the [`send` lifecycle](https://www.fastify.io/docs/master/Lifecycle/) will act like this:

```
                 ★ schema validation Error
                             │
                             └─▶ schemaErrorFormatter
                                        │
                   reply sent ◀── JSON ─┴─ Error instance
                                                │
                                                │         ★ throw an Error
               ★ send or return                 │                 │
                      │                         ▼                 │
 reply sent ◀── JSON ─┴─ Error instance ──▶ setErrorHandler ◀─────┘
                                                │
                           reply sent ◀── JSON ─┴─ Error instance ──▶ onError Hook
                                                                         │
                                                                         └─▶ reply sent
```

So, sending a `JSON error` will not execute the error handler and the `onError` hooks too.
What your functions return may impact the execution of your code!

Every component of this flow **can be customized for every route!!**
Thanks to all the [route options](https://www.fastify.io/docs/v3.8.x/Routes/#options) you can
add some route customization when needed that will overwrite the default setting in the fastify instance.

Notice that in `async` handler returns an `Error` or throws it is the same:

```js
throw new Error('foo bar error')
// it is like
return new Error('foo bar error')
```

_You can find a complete code example that replicates that reply.send flow at [github.com/Eomm/fastify-discord-bot-demo](https://github.com/Eomm/fastify-discord-bot-demo/tree/master/bonus/error-handling)_


## Manage Startup errors

These kind of errors are the most common at the beginning of a new application.
They can be triggered by:

- plugins that don't start due to an error, like a failed DB connection
- plugins that don't start **in time**, like a pre-fetch to a slow endpoint
- bad usages of the Fastify framework, like defining 2 routes with the same path

To manage these errors you have to check the [`listen`](https://www.fastify.io/docs/v3.8.x/Server/#listen) or the [`ready`](https://www.fastify.io/docs/v3.8.x/Server/#ready) results:

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

Instead, if you want to ignore the error throws by one plugin _(it should not, but Fastify lets you free to do what you want with your application)_
you can manage it like this and the server will start as expected.

```js
fastify.register((instance, ops, next) => {
  next(new Error('this plugin failed to load'))
}).after(err => {
  fastify.log.warn(err, 'Ops, my plugin fail to load, but nevermind')
})
```

Now, let's assume that the plugin may throw two errors: one you can ignore and one cannot be ignored:

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

Now, I hope I have been teaching you about all you need to know to manage the application errors in your Fastify server!

Write comments here below or open an issue on GitHub for any questions or feedback!
Thank you for reading!

## Acknowledgements

Thank you very much to [Alona](https://www.linkedin.com/in/alona-neri-loyevska-a80486114/) for the great feedback!
Image post credits to [xkcd](https://xkcd.com/1700/) (CC BY-NC 2.5)
