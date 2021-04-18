---
title: Why should I prefer Fastify to Expressjs?
series: Fastify Bonus
---

# "Why should I prefer Fastify to Expressjs?"

A lot of people ask me this question over and over again, so I would like to share why **I** prefer
Fastify to Expressjs because the correct answer to this question is just one:

__You should prefer the framework that fit best your needs__

Disclaimers:

- I'm a happy Fastify maintainer, so that I could be a bit biased
- I think expressjs is a great project and a pillar for the Node.js community, and the core team is doing a great job to push forward this framework
- Opinions expressed are solely my own and do not express the views or opinions of the Fastify community
- My knowledge is about `expressjs@4.x`

So...

## Why I prefer Fastify to Express

I prefer Fastify to Express for the **productivity**.
That's all 😀

It seems simple, but this word means that Fastify ships with some key features necessary for me to be productive.

### Async

Fastify supports `async/await` out of the box for all the components that must be awaited like:

- route handlers
- application hooks
- server methods like `.listen()`
- await plugins loading (like a mongo connection) before start listening

[Doc Reference](https://www.fastify.io/docs/latest/Plugins/#asyncawait)

### JSON Input

By default, Fastify has a secure JSON body-parser to read the request body. You don't need anything else to accept `application/json` inputs.

[Doc Reference](https://www.fastify.io/docs/latest/Server/#getdefaultjsonparser)

### Tests

Fastify explains in its [official documentation](https://www.fastify.io/docs/latest/Testing/) how to write the test for it!
Moreover, it is designed to run fast on test too, this is possible starting the server without listening to the host's PORT, so you may run in parallel tests to speed up the execution (again: using [`tap`](https://www.npmjs.com/package/tap) the parallel execution is the default behaviour!)

Actual use case: during my job, I migrated a codebase from `expressjs@3` to `fastify@2`, and the test execution time has more than halved!

[Doc Reference](https://www.fastify.io/docs/latest/Testing/)

### Logging

Fastify has a logger included, so I don't have to think about how to log or store the logger instance and boring stuff like this.
Moreover, the default logger (aka [`pino`](https://www.npmjs.com/package/pino)) has so many plugins, so push the logs everywhere that it is impossible to lose them!

[Doc Reference](https://www.fastify.io/docs/latest/Logging/)

### Configuration

The application configuration is always a pain (usually), but with Fastify decorators or using its plugin system, getting the options is so simple:

```js
// index.js
const myAppConfig = { awesome: true }
fastify.register(myAppPlugin, myAppConfig)

// my-plugin.js
module.exports = async function myAppPlugin (instance, opts) {
  console.log(opts) // print: { awesome: true }
}
```

[Doc Reference](https://www.fastify.io/docs/latest/Plugins/)

### JSON Schema

JSON Schema is another tool included in Fastify, so you don't need to struggle to configure it. You can use it.

[Doc Reference](https://www.fastify.io/docs/latest/Validation-and-Serialization/)

### Plugin system

**TLDR:** Fastify runs the minimal amount of functions to process a request.


I need to make a comparison of the framework architecture here.

`expressjs` implements the middleware pattern: so the request is processed sequentially by a list of functions that are executed one by one.

`fastify` implements a tree data structure + the middleware pattern: the request is routed to the right branch to execute, and then it is processed sequentially by only the functions needed.

So, adding a middleware in expressjs will affect all the requests, even if not necessary.
In Fastify, instead, you can add a hook only to a limited set of routes or even on one route.
This kind of architecture will avoid introducing bugs on routes that should not be affected by new middlewares.

[Doc Reference](https://www.fastify.io/docs/latest/Plugins/)

### Others

There are a lot more for me to prefer Fastify:

- Fastify awesome community
- the focus on performance
- the release scheduling

## End

These are the main reasons why I prefer Fastify.
You should try it by yourself now and find your reasons! (if any, of course!)

For more Fastify content, follow me on [Twitter](https://twitter.com/ManuEomm)!

Write comments here below or open an issue on GitHub for any questions or feedback!
Thank you for reading!
