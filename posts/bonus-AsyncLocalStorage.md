# Managing Request-Scoped Data in Fastify

I was looking at the [Fastify plugin list](https://eomm.notion.site/7a064537ee794af698684df68e215b54?v=4034009f43bd4d599a31701c4246d9fa&pvs=4)
and found myself asking, _"What is this [`@fastify/request-context` plugin](https://github.com/fastify/fastify-request-context)?"_  
So, I checked it out, and here I am, writing a post about it to share what it is and how it can be useful for you!

## What is AsyncLocalStorage?

Managing state across asynchronous operations has always been a challenge in Node.js.  
Traditional methods like passing context objects through function parameters or using global variables are the easiest way to share data across functions. However, they can quickly become unmanageable, especially in large applications with deeply nested asynchronous calls, making the code difficult to test.

This is where [**AsyncLocalStorage**](https://nodejs.org/api/async_context.html#class-asynclocalstorage),
a core module introduced in Node.js 13, comes in handy.  
It provides a way to store and retrieve data that persists through an asynchronous execution context.
Unlike global variables, which are shared across all requests, `AsyncLocalStorage` allows developers
to maintain **request-scoped data**, meaning each incoming request gets **its own isolated storage**.  

This feature seems to overlap with [Fastify's Decorators](https://fastify.dev/docs/latest/Reference/Decorators/), but it's not the same. Let's see why!

### How It Works

The basic idea behind `AsyncLocalStorage` is that it creates an execution context that is preserved
throughout asynchronous operations, even across `setTimeout` or database queries.  

Here’s a simple example with comments:

```javascript
import { AsyncLocalStorage } from "async_hooks";

// Create a new instance of AsyncLocalStorage that will be unique per application
const appAsyncLocalStorage = new AsyncLocalStorage();

// Simulate an incoming request every 2 seconds
setInterval(() => {
  // Generate a random request ID that will be unique per request
  const requestId = Math.random().toString(36).substring(7);

  // Run the `reqHandler` function in the AsyncLocalStorage context
  // This creates the context and binds the `store` object to it
  const store = { requestId };
  appAsyncLocalStorage.run(store, function reqHandler() {
    logWithRequestId("Processing request...");
    setTimeout(() => logWithRequestId("Finished processing."), 3_000);
  });
}, 2_000);

// Main business logic function
// Through `appAsyncLocalStorage.getStore()`, we can access the `store` object
// that was bound to the AsyncLocalStorage context in `reqHandler`
function logWithRequestId(message) {
  const store = appAsyncLocalStorage.getStore();
  const requestId = store?.requestId || "unknown";
  console.log(`[Request ${requestId}]: ${message}`);
}
```

The above code snippet provides the `requestId` to the `logWithRequestId` function without passing it as a parameter!  
It still requires access to the `appAsyncLocalStorage` instance to retrieve the `store` object,
but with a single variable, we can access everything we need throughout the request context.

### Why Is This Important?

Without `AsyncLocalStorage`, you would need to manually pass the `requestId` to every function that requires it,
which can be cumbersome and error-prone.  
With `AsyncLocalStorage`, the context is automatically preserved throughout the request lifecycle,
making it much easier to track request-specific data.  

Think about all the times you've had to pass a `logging` or `config` object to every function.  
Or when you manually tracked the start and end of a request.  
Or even when you implemented a tracing system to follow requests through multiple services.  

With `AsyncLocalStorage`, you can forget about that spaghetti code and focus on the request context's store!

## How to Use the `@fastify/request-context` Plugin

Fastify already solves multiple problems with its decorators:

- It provides logging through the `request.log` object.
- It provides configuration through the `fastify.config` object, thanks to the [`@fastify/env` plugin](https://github.com/fastify/fastify-env).
- It supports [Diagnostic Channels](https://fastify.dev/docs/latest/Reference/Hooks/#diagnostics-channel-hooks) to track the request lifecycle.

The [`@fastify/request-context`](https://github.com/fastify/fastify-request-context) plugin takes things
further by offering a structured way to manage request-scoped data without the hassle of manual context management.

### Quick Start

After installing the plugin, you can register it in your Fastify application.  
Let’s see a real-world example:

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

  // Simulate some business logic
  debugBusiness.push("Called external service 1");
  // Do something...
  debugBusiness.push("Processed external service 2");

  // Simulate an error
  throw new Error("Something went wrong 😱");
});

app.setErrorHandler(function (err, request, reply) {
  const debugBusiness = request.requestContext.get("logicStep");

  this.log.error({ err, debugBusiness }, "An error occurred");
  reply.status(500).send("Internal Server Error");
});

app.inject("/");
```

In this example, we have a Fastify application with a single route that simulates a complex business logic flow.  
Thanks to the `@fastify/request-context` plugin, we can store the `logicStep` array in the request context and access it
in every part of the application by accessing the `request` object.

The real power of this plugin is that you can access the `logicStep` array in
the error handler **without passing it through function parameters**.  
This allows you to push trace information across the entire application and log it when an error occurs,
helping you understand what happened before the failure.

Manually passing request-specific data through function arguments makes the code messy and difficult to maintain.  
With this plugin, you can access context-specific data anywhere in the request lifecycle without modifying function signatures.

## `@fastify/request-context` vs Decorators

Why use the `@fastify/request-context` plugin and `AsyncLocalStorage` instead of Fastify's Request and Reply decorators?  
Aren't they achieving the same goal?

_Not exactly._

To understand the difference, let’s briefly look at how Fastify decorators work.  
Fastify decorators mutate the Request and Reply prototypes, adding new properties to them.  
Every time an HTTP request is received, Fastify creates new Request and Reply objects using these modified prototypes,
automatically making decorators available.

Sounds great, right? But there’s a catch!

If you add **reference-type objects** (arrays or JSON objects) to the Request or Reply object,
they will be shared across all requests.  
If one request modifies them, it will affect all other requests!  
This can lead to unexpected behavior and hard-to-track bugs.  

Due to this, the Fastify team **discouraged** using reference-type objects in decorators
starting from [v5](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/#removed-support-from-reference-types-in-decorators).

You can still use decorators for reference-type objects, but it becomes more complex and error-prone.  
Here’s an example requiring **two decorators** and a **lazy-loading approach**:

```javascript
app.decorateRequest('logicStepValue', null)
app.decorateRequest('logicStep', {
  getter () {
    this.logicStepValue ??= [];
    return this.logicStepValue;
  },
})
```

This is where the `@fastify/request-context` plugin shines.  
It provides a **structured**, **safe**, and **isolated** way to manage request-specific
data **without the risk of data leakage across requests**!

## Summary

The `@fastify/request-context` plugin offers a structured, efficient way to manage request-scoped data in Fastify applications.  
It simplifies code, improves maintainability, enhances logging, and makes debugging significantly easier.  

By leveraging this plugin, you ensure that request-specific data
remains **consistent** and **accessible** throughout the request lifecycle **without unnecessary complexity**.

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).  
Comment, share, and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
