# How to test a Fastify application
by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

In this article, I will show you how to test a Fastify and MongoDB application!

Note that this post is the follow up of the ["How to use Fastify and MongoDb"](https://backend.cafe/how-to-use-fastify-and-mongodb)
article where you learnt how to create a CRUD application.

## What kind of tests?

We must say that it exists a lot of tests in the world:

- Unit tests: tests that are written to test a single unit of code.
- Integration tests: tests that are written to test the whole application.
- End to end tests: tests that are written to test the whole application from the client-side to the server-side.
- UI tests: tests that are written to test the user interface of the application.
- Performance tests: tests that are written to test the performance of the application.
- Security tests: tests that are written to test the security of the application.
- Smoke tests: tests that are written to test the application in a simple way.
- Stress tests: tests that are written to test the application in a stressful way.

I think I could continue to list all the kinds of tests for hours.

> If you would like to go deeper, you can read the [Martin Fowler's](https://martinfowler.com/testing/) site.
> It contains a lot of articles about testing.

Now, we will focus on the **integration tests**.

I choose to write the integration tests because I think:

- You can focus on the business logic of the application.
- In a dockerized environment, spinning up a container is cheap and easy.
- The testing code is lesser: you don't need to mock and fix your mocks too.
- It is helpful to crystallize some bugs you had in production.

For sure, adding unit tests is a good approach, but I usually do it for specific components.
We will see an example at the end of this article.


## Choosing the right testing framework

Fastify has a the [`.inject()` method](https://www.fastify.io/docs/latest/Testing/#benefits-of-using-fastifyinject)
that allows you to inject a request into the application without starting the HTTP server.

This feature within the [`node-tap`](https://www.npmjs.com/package/tap) testing framework gives you the power to test your application, faster.

The combo here is that `node-tap` runs the tests in parallel (one process for each test, file).
So, the more files you will create and faster your tests will be.
The Fastify's `inject` feature will avoid the boring `Address already in use` error.

Let's go with a brief `tap` example after installing it with `npm install tap -D`.

```js
// test/index.test.js
const t = require('tap')

t.test('my first test', async t => {
  t.ok(true, 'my first assertion')
})
```

As you can see, this framework is very easy and clear to use: you define some `.test()` within a function that must run the assertions.
`node-tap` is a feature-complete testing framework you will love its capabilities.

Now you can run the file simply with:

```sh
node test/index.test.js
```

Or adding a script into the `package.json`:

```json
{
  "scripts": {
    "test": "tap test/**.test.js"
  }
}
```

## Creating a testable application

In our [previous article](https://backend.cafe/how-to-use-fastify-and-mongodb), we created a CRUD application.
We are going to optimize it and make it **more** testable.

To make it testable, we need to improve the `app.js` file and decouple the configuration loading.
Right now, the `fastify-env` loads the configuration from the `.env` file by default.

When we run tests, we want to load the configuration from the `.env.test` or inject it directly.

```js
module.exports = fp(async function application (app, opts) {
  await app.register(require('fastify-env'), {
    data: opts.envData,
    schema: {
    // ... old code
```

We have added the `data` parameter. Now the `fastify-env` will apply the `schema` check to the `data` object.
When the `data` is falsy, the `process.env` object will be used.
In this way, we can test the configuration we want by injecting it directly.

The `fastify-env` plugin will also load the `.env` file if it exists, but it won't overwrite the `data` object.

That's all!
Now we can write our test cases!

## Writing the tests

The test cases our application needs are the following:

- create a TODO
- read a TODO
- update a TODO
- read the updated TODO
- delete a TODO
- update a TODO that doesn't exist
- delete a TODO that doesn't exist

Let's create the first test case into the `test/legacy.test.js` file:

```js
const t = require('tap')
const fastify = require('fastify')
const appModule = require('../app')

t.test('create', async t => {
  const app = fastify()
  app.register(appModule, {
    envData: {
      NODE_ENV: 'testing',
      MONGO_URL: 'mongodb://localhost:27017/my-todo-app'
    }
  })
  t.teardown(() => app.close()) // let's close the server after the test

  const response = await app.inject({
    method: 'POST',
    url: '/todos',
    payload: {
      text: 'test todo'
    }
  })

  t.equal(response.statusCode, 201)

  const todo = response.json()
  t.ok(todo.id, 'the id has been returned')
})
```

Now running `node test/legacy.test.js` will show this output:

```
TAP version 13
# Subtest: create
    ok 1 - should be equal
    ok 2 - the id has been returned
    1..2
ok 1 - create # time=206.184ms

1..1
```

Great 🎉! We have created a test case that creates a TODO and returns the id.

> Memo: remember to run `npm run mongo:start` before running the tests to spin up the database.

As you saw, the `inject` method accepts an input object to set:

- `method`: the HTTP method
- `url`: the URL
- `payload`: the payload to send
- `headers`: the headers to send
- `query`: the query string

And [much more](https://github.com/fastify/light-my-request#api)!

Let's continue with the other test cases:

```js
  // ...previous code..
  const todo = response.json()
  t.ok(todo.id, 'the id has been returned')

  t.test('read', async t => {
    const response = await app.inject({
      method: 'GET',
      url: '/todos'
    })

    t.equal(response.statusCode, 200)
    t.equal(response.json().length, 1)
    t.notOk(response.json()[0].done)
  })
})
```

Now we are creating a subtest: `read` into the `create` test case.
As you can see, we are checking the status code and the length of the response: we have inserted a TODO,
then we are reading the TODO list and checking that there is only one element.

If we run it again, we will get an error!

```
...
 diff: |
  --- expected
  +++ actual
  @@ -1,1 +1,1 @@
  -1
  +2
...
```

This is due to the fact that we are using the same database and the previous test case has inserted a TODO and
in the second run, we have added another one.

This is a common problem when implementing integration tests.
Creating integration tests require one phase before starting:

- spin up: when we prepare the database to run the tests.

As said before, this is useful to replicate issues found in production.
In a spin-up phase, we can create the data we need to replicate the bug and then verify that the bug
is fixed after our implementation.

This is useful because after the tests run, you can check the data on the database too!
So you will be immediately ready to fix the bug and play locally with the application.

Let's update our test file:

```js
const mongoClean = require('mongo-clean')
const { MongoClient } = require('mongodb')

t.test('spin up phase - prepare data', async t => {
  const c = await MongoClient.connect('mongodb://localhost:27017/my-todo-app')
  await mongoClean(c.db())
  c.close()
})

t.test('create', async t => {
  // ...
```

Now, running our test will be successful:

```
# Subtest: create
    ok 1 - should be equal
    ok 2 - the id has been returned
    # Subtest: read
        ok 1 - should be equal
        ok 2 - should be equal
        ok 3 - expect falsey value
        1..3
    ok 3 - read # time=5.999ms
    
    1..3
ok 1 - create # time=211.436ms

1..1
# time=216.488ms
```

Well done! We have now working integration tests!

Now you have all the pieces to build a testable application and complete the missing test cases we
listed before.

If you want to see them all, give it a check to the [`fastify-in-practice`](https://github.com/Eomm/fastify-in-practice/#fastify-in-practice) repository.

> Insights: if you create multiple files to test your application, remember to use different database names.
> You need to customize the `envData.MONGO_URL` parameter only.
> This will avoid conflicts between tests.

## Summary

We have seen a lot of things in this tutorial.

- how to use `node-tap` for our tests.
- how to do a testable application using `fastify-env` plugin.
- the `fastify.inject` method to call the application's endpoints.
- how to deal with integration tests.

Now you need to practice and build your own application within Fastify!

Comment and share if you enjoyed this article!
