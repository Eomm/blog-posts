# Fastify Introduces the New `onListen` Hook!

Fastify v4.XXXXXX.0 has just been released, featuring a brand-new [`onListen`](https://github.com/fastify/fastify/pull/4899) Application hook. In this article, we'll explore what it is and how you can leverage it in your Fastify applications.


## Understanding Fastify Hooks

Fastify's hooks are a fundamental aspect of its design. Hooks are functions that get called at specific points in a component's lifecycle. They allow you to inject custom functionality at these crucial moments, thus altering the component's behavior.

Hooks are particularly useful for breaking down your application logic into reusable pieces that can be executed at specific times.

Fastify offers two primary types of hooks:

- **Application hooks**: These consist of 5 hooks that are invoked in a specific order during the application's lifecycle.
- **Request/Reply hooks**: There are a total of 10 hooks that are called in a specific order during the [HTTP request lifecycle](https://fastify.dev/docs/latest/Reference/Lifecycle).

Each hook type serves a distinct purpose and comes with its own API.
Before diving into the new `onListen` hook, let's briefly overview Fastify's hooks.


## Application Hooks

Application hooks allow you to customize how your Fastify application initializes and closes.
These hooks play a crucial role in starting and stopping the application gracefully.

🛫 The application hooks during application startup include:

- `onRoute`: Triggered when a route is registered.
- `onRegister`: Invoked when an encapsulated plugin is registered.
- `onReady`: Called when the application is ready but not yet listening to incoming requests.

If any of these hooks throw an error, the application won't start. These hooks are essential for performing mandatory checks before launching the application, and they execute in the order they are registered.

🛬 The application hooks during application shutdown are:

- `preClose`: Executed before the application is closed, while HTTP requests are still being processed.
- `onClose`: Triggered when the application no longer accepts new requests.

These hooks are handy for performing cleanup tasks before shutting down the application, such as closing a database connection. However, they behave differently when an error is thrown:

- `preClose` hooks are executed in the order they are registered, and if one of them throws an error, subsequent hook functions are not executed. It is likely that you will not use this hook in your application.
- `onClose` hooks are executed in the reverse order they are registered, and if one of them throws an error, the following hook functions are executed regardless.

You can find more details about these hooks in my [Fastify book 📙](https://backend.cafe/the-fastify-book-is-out)!

### The New `onListen` Hook

With the release of Fastify v4.XXXXXX.0, we introduce the sixth application hook: `onListen`.
This hook is called when the application is ready, and the server is actively listening to incoming requests.

The API for the `onListen` hook is consistent with other application hooks, supporting both async/await and callback styles:

```js
// async/await style
app.addHook('onListen', async function () {
  // Some async code
})

// or callback style
app.addHook('onListen', function (done) {
  // Some code
  const err = null;
  done(err)
})
```

In the application startup sequence, you can now list this new hook as the final step:

- `onRoute`
- `onRegister`
- `onReady`
- ⭐️ `onListen`: Invoked when the application is ready, and the server is actively handling incoming requests.

It's essential to note that this hook has some differences compared to the others of the same type:

1. If the `onListen` hook throws an error, the application will still start anyway, similar to the behavior of the `onClose` hook.
2. Since the server is already processing HTTP requests, be cautious of potential race conditions if you attempt to load data needed by your routes.
3. If you don't call `app.listen()` in your tests, this hook will not be executed.

So, when should you use the `onListen` hook?

This hook was added in response to community requests to perform tasks that require the server to be actively listening to incoming requests. A common use case is loading external data from a remote service to populate the application cache.

The power of the `onListen` hook lies in its ability to load data asynchronously without blocking or delaying the application startup. It's perfect for loading non-mandatory data for your routes. If you need to load data that's essential for a decorator and must be available before the application starts, consider using the `onReady` hook instead.


## Request/Reply Hooks

While we won't delve into Request/Reply hooks in this article, you can find comprehensive information in the [Fastify documentation](https://fastify.dev/docs/latest/Reference/Hooks/#requestreply-hooks) or in the detailed [Fastify book 📙](https://backend.cafe/the-fastify-book-is-out) in chapter 4!


## Summary

In this article, we've introduced the new `onListen` hook, explained how it works, and highlighted its use cases. Fastify continues to evolve in response to the community's needs, and this hook is a prime example of that.

If you found this article helpful, please leave a comment, share it with others, and follow me on [Twitter](https://twitter.com/ManuEomm) for more updates!
