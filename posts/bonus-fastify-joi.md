# Validate the Fastify input with Joi

If you are an `hapi` developer, you may know the [`joi`](https://www.npmjs.com/package/joi) library.
It is a powerful validation library that allows you to define programmatic schemas for your data and validate them with ease.

One of the most hard things when you migrate from `hapi` to `fastify` is the complexity to keep using `joi` for the route's input validation.

But now, thanks to the [`joi-compiler`](https://www.npmjs.com/package/joi-compiler) library, you can use `joi` with `fastify` without any problem!

> **Note**
> If you have afraid to use it because it has very few downloads, don't worry, it is a new library and I'm the author.
> And, if you don't know me, I'm a Fastify core maintainer and I'm the co-author of the [Fastify book](https://backend.cafe/fastify-v4-book) too!

The `joi-compiler` module replaces the default `ajv` schema compiler with a `joi`-based one and allows you to use `joi` schemas to validate your data.
Let's see how to use it!

## Integrate `joi` with `fastify`

After you have installed the latest `fastify@4` and `joi-compiler` module:

```bash
mkdir fastify-joi
cd fastify-joi
npm init -y
npm install --save fastify@4 joi-compiler
```

We can create a simple `index.js` file with the following content:

```js
const fastify = require('fastify')
const JoiCompiler = require('joi-compiler')

// Instantiate the compiler
const joiCompilerInstance = JoiCompiler()

// Install it to Fastify
const app = fastify({
  schemaController: {
    bucket: joiCompilerInstance.bucket,
    compilersFactory: {
      buildValidator: joiCompilerInstance.buildValidator
    }
  }
})

// Use it!
const joiSchema = joiCompilerInstance.joi.object({
  foo: joiCompilerInstance.joi.string().required()
})

app.get('/', {
  handler: () => 'Hello World!',
  schema: {
    headers: joiSchema
  }
})

app.listen({ port: 3000})
```

If you run this code, you will be able to test the `joi` validation with the following command:

```bash
curl -X GET http://localhost:3000/
# {"statusCode":400,"error":"Bad Request","message":"\"foo\" is required"}

curl -X GET http://localhost:3000/ -H "foo: bar"
# Hello World!
```

As you can see, the `joi` schema is working as expected!
In few lines of code, we have integrated `joi` with `fastify` and we are able to use it to validate the input of your application routes.

## How it works

The `joi-compiler` module is a Fastify schema compiler, it is used by Fastify to build the components during the startup
to guarantee the [encapsulated feature](https://backend.cafe/the-complete-guide-to-the-fastify-plugin-system).

For this reason, the `joi-compiler` can be configured in the `schemaController` option during the Fastify application creation.

> **Note**  
> How the [Fastify Schema Controller](https://www.fastify.io/docs/latest/Reference/Server/#schemacontroller) works is out of the scope of this article.
> But if you want to know more about it, you can read the [Fastify book](https://backend.cafe/fastify-v4-book)!

## How configure the `joi-compiler`

The `JoiCompiler` accepts an optional configuration object to customize the `joi` instance.

The default configuration is:

```js
const joiCompilerInstance = JoiCompiler({
  // optionally: provide all the JOI options you need
  // Here is all the possible options: https://joi.dev/api/?v=17.9.1#anyvalidatevalue-options
  prefs: {
    stripUnknown: true
  },

  // optionally: an array with custom JOI extensions such as `@joi/date`
  extensions: [
  ],

  // optionally: if you want to use the async validation. Default: false
  asyncValidation: false
})
```

When you instantiate the `joiCompilerInstance`, the returned object has the following properties:

- `buildValidator`: the function to pass to the `schemaController` option of Fastify
- `bucket`: the `joi` bucket that contains the schemas when you call the `app.addSchema(joiSchema)` method. You can omit this option if you don't use `app.addSchema`
- `joi`: a customized `joi` instance that contains the installed `extensions` if any. It is a good practice to use this instance to build your schemas

## How to use `ajv` and `joi` together!

The power of Fastify is that you can use different schema compilers at the same time!
Here is an example of how you can learn from the [Fastify book](https://backend.cafe/fastify-v4-book):

```js
const joiCompilerInstance = JoiCompiler()
const app = fastify()

app.post('/ajv', {
  handler: (request) => request.body,
  schema: {
    body: {
      type: 'object',
      properties: {
        toX: { const: 42 },
        toY: { const: 50 }
      }
    }
  }
})

app.register(async function pluginJoi (app, opts) {
  // Install the joi compiler into this encapsulated context!
  app.setSchemaController({
    bucket: joiCompilerInstance.bucket,
    compilersFactory: {
      buildValidator: joiCompilerInstance.buildValidator
    }
  })

  // Let's try to use the external schemas!
  app.addSchema({ $id: 'x', $value: 42 })
  app.addSchema({ $id: 'y', $value: 50 })

  app.post('/joi', {
    handler: (request) => request.body,
    schema: {
      body: Joi.object({
        toX: Joi.ref('$x'),
        toY: Joi.ref('$y')
      })
    }
  })
})

app.listen({ port: 3000 })
```

If you run this code, you will be able to use the `ajv` and `joi` validation in the same application!
The `ajv` validation will be used for the `/ajv` route and the `joi` validation will be used for the `/joi` route.

Pretty cool, right?

## Summary

The [`joi-compiler`](https://www.npmjs.com/package/joi-compiler) is a powerful tool that allows you to build and manage `joi` instances for Fastify out of the box in few lines of code.
If you're a `joi` user, `joi-compiler` is definitely worth checking out!

If you enjoyed this article comment, share and follow [@ManuEomm](https://twitter.com/ManuEomm) on twitter!
