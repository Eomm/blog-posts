# Managing Request-Scoped Data in Fastify

I was looking at the [Fastify plugin list](https://eomm.notion.site/7a064537ee794af698684df68e215b54?v=4034009f43bd4d599a31701c4246d9fa&pvs=4)
and I found myself asking, _"What is this [`@fastify/request-context` plugin](https://github.com/fastify/fastify-request-context)?"_.
So, I checked it out and, here I am, writing a post about it to share what is it and how it can be useful for you!

## What is AsyncLocalStorage?

Managing state across asynchronous operations has always been a challenge in Node.js.
Traditional methods like passing context objects through function parameters or using global variables is the
easiest way to share data across functions, but they can quickly become unmanageable, especially in large applications with deeply nested asynchronous calls and it transforms the code into an untestable application.

This is where [**AsyncLocalStorage**](https://nodejs.org/api/async_context.html#class-asynclocalstorage), a core module introduced in Node.js 13, comes in handy.  
It provides a way to store and retrieve data that persists through an asynchronous execution context.
Unlike global variables, which are shared across all requests, `AsyncLocalStorage` allows developers to maintain **request-scoped data**, meaning each incoming request gets **its own isolated storage**.

This feature seems to overlap with the [Fastify's Decorators](https://fastify.dev/docs/latest/Reference/Decorators/),
but it's not the same... Let's see why!

### How It Works

The basic idea behind `AsyncLocalStorage` is that it creates an execution context that is preserved throughout asynchronous operations, even across `setTimeout`, or database queries. Here’s a simple example with a commentary:

```javascript
// Import the AsyncLocalStorage class
import { AsyncLocalStorage } from "async_hooks";

// Create a new instance of AsyncLocalStorage that will be unique per application
const appAsyncLocalStorage = new AsyncLocalStorage();

// Here we simulate an incoming request every 2 seconds
setInterval(() => {
  // Generate a random request ID that will be unique per request
  const requestId = Math.random().toString(36).substring(7);

  // We run the `reqHandler` function in the AsyncLocalStorage context
  // that creates the context and bounds the `store` object to it
  const store = { requestId };
  appAsyncLocalStorage.run(store, function reqHandler() {
    logWithRequestId("Processing request...");
    setTimeout(() => logWithRequestId("Finished processing."), 3_000);
  });
}, 2_000);

// This is the main business logic function
// Through the `appAsyncLocalStorage.getStore()` method, we can access the `store` object
// that was bound to the AsyncLocalStorage context in the `reqHandler` function
function logWithRequestId(message) {
  const store = appAsyncLocalStorage.getStore();
  const requestId = store?.requestId || "unknown";
  console.log(`[Request ${requestId}]: ${message}`);
}
```

The previous code snippet can provide the `requestId` to the `logWithRequestId` function
without passing it as a parameter!
Still, it needs to access the `appAsyncLocalStorage` instance to get the `store` object,
but with a single variable, we can access everything we need throughout the request context's store!

### Why Is This Important?

Without `AsyncLocalStorage`, you would need to manually pass the `requestId` to every function that needs access to it,
which can be cumbersome and error-prone.
With `AsyncLocalStorage`, the context is automatically preserved throughout the lifecycle of the request,
making it much easier to track request-specific data.

Do you remember all your codebase where you had to pass the `logging` or `config` object to every function?
Do you remember all the code added to track the start and end of a request?
Do you ever had to implement a tracing system to track the request through multiple services?

With `AsyncLocalStorage`, you can forget about all of that spaghetti code and focus on the AsyncLocalStorage's store!

## How to use the `@fastify/request-context` Plugin

While Fastify has already solved multiple problems with its decorators:

- It provides the logger through the `request.log` object
- It provides the configuration through the `fastify.config` object thanks to the [`@fastify/env` plugin](https://github.com/fastify/fastify-env)
- It supports the [Diagnostic channels](https://fastify.dev/docs/latest/Reference/Hooks/#diagnostics-channel-hooks) to track the request lifecycle

The [`@fastify/request-context`](https://github.com/fastify/fastify-request-context) plugin provides a more structured way to manage request-scoped data
offering a seamless way to store and retrieve request-specific data without the hassle of manual context management.

### Quick Start

After installing the plugin, you can register it in your Fastify application.
Let's see a real-world example of how to use the `@fastify/request-context` plugin:

```javascript
import Fastify from "fastify";
import fastifyRequestContext from "@fastify/request-context";

const app = Fastify({ logger: true });

app.register(fastifyRequestContext, {
  defaultStoreValues() {
    return {
      logicStep: [],
    };
  },
});

app.get("/", async function longHandler(req, reply) {
  const debugBusiness = req.requestContext.get("logicStep");

  // do some business logic
  debugBusiness.push("called external service 1");

  // do some business logic
  debugBusiness.push("processed external service 2");

  // call another handler but..
  throw new Error("Something went wrong 😱");
});

app.setErrorHandler(function (err, request, reply) {
  const debugBusiness = request.requestContext.get("logicStep");

  this.log.error({ err, debugBusiness }, "An error occurred");
  reply.status(500).send("Internal Server Error");
});

app.inject("/");
```

In this example, we have a Fastify application with a single route that simulates a very complex business logic flow.
Thanks to the `@fastify/request-context` plugin, we can store the `logicStep` array in the request context and access it in every handler.

The real power of this plugin is that you can access the `logicStep` array in the error handler
without passing it through the function parameters! So you will be able to push some trace information
across the whole application and log it when an error occurs to understand what happened before the error!

Manually passing request-specific data through function arguments can make the code messy and hard to maintain.
With this plugin, you can access context-specific data anywhere in the request lifecycle without modifying function signatures.

## `@fastify/request-context` vs Decorators

But why should you use the `@fastify/request-context` plugin and `AsyncLocalStorage` instead of the Fastify Request and Reply decorators?
They reach the same goal, right?

Not exactly.

I must explain a bit how the Fastify decorators work to understand the difference between the two approaches.
The Fastify decorators mutate the Request and Reply prototypes, adding new properties to them.
So, every time an HTTP request is received, Fastify creates a new Request and Reply object using
the modified Request and Reply prototypes, and the decorators are available in the new objects automatically.

Cool, right? But there is a catch!

If you want to add some **reference types objects** (Arrays and JSON Objects) to the Request or Reply object,
you will have to be careful!
**Because the reference types are shared across all the requests, and if you modify them in one request, you will modify them in all the requests!**
This can lead to unexpected behavior and bugs that are hard to track down, so this approach has been
discouraged by the Fastify team in the [v5 release](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/#removed-support-from-reference-types-in-decorators).

That said, it is still possible to use the Fastify Request and Reply decorators to store reference types objects,
but it bacomes a bit more complex and error-prone. This is an example that shows how a temporary map is needed to store the reference types objects:

```javascript
const tracker = new WeakMap();
app.decorateRequest("logicStep", {
  getter() {
    if (tracker.has(this)) {
      return tracker.get(this);
    }
    tracker.set(this, []);
    return tracker.get(this);
  },
});
```

This is where the `@fastify/request-context` plugin comes in handy.
It provides a structured way to store and retrieve request-specific data **without the risk of sharing data across requests**!

## Summary

The `@fastify/request-context` plugin provides a structured, efficient way to manage request-scoped data in Fastify applications.
It simplifies code, improves maintainability, enhances logging, and makes debugging significantly easier.
By leveraging this plugin, you can ensure that request-specific data remains consistent and accessible
throughout the request lifecycle without unnecessary complexity.

If you enjoyed this article and that you’ll like [_'Accelerating Server-Side Development with Fastify'_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
