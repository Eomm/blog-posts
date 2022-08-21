
# How to unlock the fastest Fastify server startup?

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

If you are using Fastify, you already know that [it is the fastest Node.js web framework](https://github.com/fastify/benchmarks) in town.

But we know that a benchmark is something different from a real world application.
The benchmark has the fastest startup time possible because it does nothing before the server is listening.

In fact, you should take care about two time measurements:

- The time it takes to start the server and accept the first request.
- The time it takes to process the request.

Fastify helps us to reduce the time it takes process the request, but it needs a little bit of time to start the server.
So, there is something that can help Fastify to speed up the startup?
Let's see how to do it in this article by using a special Fastify configuration!


## Why should you care about startup time?

I will try to list some reasons why you should care about startup time:

- Development environment: having a faster startup improves the developer experience and the developer productivity.
- Cloud deployment: having a faster startup reduces the infrastructure cost when you [deploy Fastify to a Lambda](https://github.com/fastify/aws-lambda-fastify/).
- Reduced deploy time: if you rollout a new version of your application that fixes a BIG bug, you will ship it faster.

So did you find a reason to care about startup time?
I hope you did!

## How to speed up the startup?

A real world application has many things to do when it starts. Usually the operations are:

- Connect to a database
- Preload application data (cache, configuration, ...)
- Start the Fastify server

All these operations are time wasting and unavoidable because it is necessary to implement our business logic.
If we analyze the list of operations, we can see that there are two groups of operations:

- Architecture operations: these are the operations that are related to the application architecture.
- Framework operations: these are the operations that are related to the application framework, aka Fastify.

Let's see them in detail.

### Architecture operations

Architecture operations are the operations that are time wasting and unavoidable because they provides
all the stuff that the application needs to run:

- Connect to a database
- Preloaded data (cache, configuration, ...)

If you need to optimize these operations, you need to optimize the application architecture.
Talking about application architecture is out of the scope of this article, but you can find a lot of information about it
in the [Fastify book](https://www.packtpub.com/product/accelerating-server-side-development-with-fastify/9781800563582) **cooming soom**.

### Framework operations

The framework operations are time wasting but **you can reduce them** by using a special configuration!
By knowing the internal architecture of Fastify, you must know that the _heaviest operation during the startup is JSON Schema compilation._
That being said, I'm not going to suggest to remove the JSON Schema as optimization 😆

> If you are not using JSON Schema, you should start because it provides some benefits:
> 
> - Improve security by validating the input data
> - Improve performance by serializing the response data
> - Ability to use the tooling such as [Swagger](https://swagger.io/) and [OpenAPI](https://swagger.io/)

Before you start to optimize the framework operations, you should know why the JSON Schema compilation is the heaviest operation.

### JSON Schema compilation workflow

To improve the startup time, you need to be aware of the following workflow:

- Fastify compiles the JSON Schema into a JavaScript function during the startup
- The function is stored into each route context
- Whenever a request is received, the compiled function is executed when needed

Fastify implements this workflow for each JSON Schema you may configure.
For example, the following code will compile the JSON Schemas into 3 JavaScript functions:

- One validation function for the `body`
- One validation function for the `headers`
- One serialize function for the `response` when the status code is 200

```js
app.post('/', {
  handler (req) { return  { hello: req.body.name } },
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    headers: {
      type: 'object',
      properties: {
        'x-header-app': { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          hello: { type: 'string' }
        }
      }
    }
  }
})
```

As you can understand, the compilation process time increases progressively the startup time while you
adds more and more routes to your application.

## How to optimize the compile process?

To optimize the compile process we discussed in the previous section, we are going to skip it!
The idea is to split the compilation process into two steps:

1. Build phase: start the application and store the compiled functions into a JavaScript file. Then turn off the application.
2. Read phase: start the application and load the functions from the JavaScript file, without processing the JSON Schemas.

In practice, we are introducing a build phase thet lets us skip the compilation process.
This optimization has the same pitfall that every build step has:

- You must be aware when you want to rebuild the application.
- Editing the JSON Schema source code does not update the compiled functions.

As counter side, the build process has these pros:

- The Framework operation are constant time and predictable.
- The application startup time is reduced.
- The application is not affected by [performance issues](https://github.com/fastify/fast-json-stringify/issues/506) introduced with new releases.

It is time to code the build phase!

### Implementing the build phase

The build phase is the first phase of the build process.
Its scope is to compile the JSON Schemas into a JavaScript file.

We will use the [`schemaController`](https://www.fastify.io/docs/latest/Reference/Server/#schemacontroller) feature of Fastify to implement this phase.

```js
const fastify = require('fastify')
const fs = require('fs')

// These modules are used internally by Fastify
const standaloneAjv = require('@fastify/ajv-compiler/standalone')
const standaloneFjs = require('@fastify/fast-json-stringify-compiler/standalone')

// This module is used to generate a valid filename for the compiled functions
const sanitize = require('sanitize-filename')

const app = fastify(
  {
    jsonShorthand: false,
    schemaController: {
      compilersFactory: {
        buildValidator: standaloneAjv({
          readMode: false,
          storeFunction(routeOpts, schemaValidationCode) {
            const fileName = generateFileName(routeOpts)
            fs.writeFileSync(fileName, schemaValidationCode)
          }
        }),
        buildSerializer: standaloneFjs({
          readMode: false,
          storeFunction (routeOpts, schemaSerializationCode) {
            const fileName = generateFileName(routeOpts)
            fs.writeFileSync(fileName, schemaSerializationCode)
          }
        }),
      }
    }
  }
)

// use your app as you normally would
// ... app.register()
// ... app.get()
app.post('/hello', {
  handler (req) { return  { hello: req.body.name } },
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    headers: {
      type: 'object',
      properties: {
        'x-header-app': { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          hello: { type: 'string' }
        }
      }
    }
  }
})

app.ready().then(() => {
  console.log('Compilation completed!')
})

function generateFileName(routeOpts) {
  // routeOpts is: { schema, method, url, httpPart } when the schema is for validation
  // or: { schema, method, url, httpStatus } when the schema is for serialization
  return `./generated-${routeOpts.method}-${routeOpts.httpPart || routeOpts.httpStatus}-${sanitize(routeOpts.url)}.js`
}
```

Running the previous code with the `node app.js` command will generate the following files:

- `./generated-POST-200-hello.js`
- `./generated-POST-body-hello.js`
- `./generated-POST-headers-hello.js`

> Note that, the application will work as usual when the `readMode` is set to `false`.
> The generated functions will persisted at every startup.

Great! The compilation process is completed. Let's see how to consume the generated files.

### Implementing the read phase

The read phase is the second phase of our optimization process.
We need to load the generated files and use them to compile the JSON Schemas.

To do so we must edit the Fastify `schemaController` option to use the generated files:

```js
function restoreFunction (routeOpts) {
  const fileName = generateFileName(routeOpts)
  return require(path.join(__dirname, fileName))
}

const app = fastify(
  {
    jsonShorthand: false,
    schemaController: {
      compilersFactory: {
        buildValidator: standaloneAjv({
          readMode: true,
          restoreFunction
        }),
        buildSerializer: standaloneFjs({
          readMode: true,
          restoreFunction
        }),
      }
    }
  }
)
```

As you can see we have just modified the `schemaController` option to use the generated files.
Both the `buildValidator` and the `buildSerializer` compilers are using the `restoreFunction` to load the generated files.

Note that the `restoreFunction` must be able to generate the file name from the `routeOption`.
This is why we are using the same `generateFileName` function to generate the file name during the compilation
and the read access.

> You can implement your own `generateFileName` to identify a compiled function.
> A good option is to use the JSON Schema `$id` property if you set it on the schemas.

Now, running the `node app.js` command will start the application and the generated files will be loaded.

If you change the `POST /hello` schemas, you will have to recompile the application to update the generated files.

It is a good practice to compile the JSON Schemas when the schemas are consolidated.
During the early stages of the application development, it may be unuseful to compile the schemas every time.

## Conclusion

Testing this approach revealed that an application with 100 schemas loads in ~100 milliseconds!
This blog post has been inspired by [this performance issue](https://github.com/fastify/fast-json-stringify/issues/506).

You have learned how to optimize the JSON Schema compilation process.
Now you may create your own tooling to run the application in `readMode: false` when you need to compile
the schemas and with the `readMode: true` to load them from the file system.

Comment and share if you enjoyed this article!
