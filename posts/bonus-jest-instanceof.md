# Should you use jest as a testing library?

[`jest`](https://jestjs.io/), the popular testing framework created by Facebook with over 50 million downloads per month, causes [many problems](https://github.com/facebook/jest/issues/2549) for backend developers.

In this article, I try to recap the `jest`'s cross and delight and how to deal with it and what is causing it.

## How does jest work?

`jest` is a JavaScript Testing Framework with many features, including `isolated` written on its website.
The isolation feature's target performance:

> Tests are parallelized by running them in their own processes to maximize performance.

The `jest`'s isolation comes from [its architecture](https://jestjs.io/docs/architecture) that uses the [`node:vm`](https://nodejs.org/api/vm.html) core module under the hood.

The `vm` module lets `jest` run every test file into a sandbox with its own temporary context.
The context includes all the `global` classes such `Array`, `Error`, `Date` and many others - the `describe` and the `it` test function for example.
([_Here the jest source code that does the trick_](https://github.com/facebook/jest/blob/e865fbd66e3dc4adf9d35a35ce91de1bee48bc93/packages/jest-environment-jsdom/src/index.ts))

Since `jest` overwrites some of those components to provide you fancy features like mocks, fake clocks and a fast test execution,
it must set all the `vm`'s `global` data to set up the context where the test's source code will be executed.

Unfortunately, when the Node.js core modules create a new instance of a `global` class,
**they will not use** the `vm`'s context, but they fall back to the **native implementation**.

This means that the `instanceof` operator [will not work](https://github.com/facebook/jest/issues/2549)
as expected, and it will generate false negatives!  
You can get a quick example of this problem in the following `test.js` snippet file:

```js
const { parseArgs } = require('util')

test('Array is not an Array', async () => {
  const { values } = parseArgs({
    args: ['--bar', 'a', '--bar', 'b'],
    options: {
      bar: {
        type: 'string',
        multiple: true
      }
    }
  })
  expect(values.bar).toEqual(['a', 'b'])
  expect(values.bar).toBeInstanceOf(Array) // ❌ it will fail
})
```

By running the above test with the command `jest test.js` _(with the default `jest` configuration)_
it will fail with the stange error:

```bash
  ● Array is not an Array

    expect(received).toBeInstanceOf(expected)

    Expected constructor: Array
    Received constructor: Array

      27 |   })
      28 |   expect(values.bar).toEqual(['a', 'b'])
    > 29 |   expect(values.bar).toBeInstanceOf(Array)
```

This may seem a minor problem, you need just to avoid using the `instanceof` operator, but it is not.
The bigger problem is that the `instanceof` operator **could be used** by your dependencies tree to perform
some checks, and those conditions will fail.

For example, Fastify [removed the `instanceof` operator](https://github.com/fastify/fastify/pull/3200)
from its codebase because it was causing problems for those developers that rely on `jest` as a testing framework.

## How to fix it?

It depends 😄

You [can't](https://github.com/facebook/jest/issues/2549#issuecomment-521177864) out of the box.
There is an open issue on [the Node.js repository](https://github.com/nodejs/node/issues/31852)
to let the `node:vm` module to use the `vm`'s context, but it is still open.
It seems that the Node.js core team is interested in fixing this problem by implementing the new [ShadowRealm](https://github.com/tc39/proposal-shadowrealm) spec, and I think we will make some progress during 2023.

If you can't wait, there is a very quick solution by using the [`jest-environment-node-single-context`](https://www.npmjs.com/package/jest-environment-node-single-context) custom test enviroment.  
If you install this module and you run the previous code with the command:

```bash
jest --testEnvironment jest-environment-node-single-context test.js
```

Now, all will work as expected:

```bash
 PASS  ./test.js
  ✓ Array is not an Array (5 ms)
```

⚠️ Note that now the test is working because the `jest` isolation feature is totally disabled by running all the tests
in the same context.

Another working solution is to use a new `jest` runner: [`jest-light-runner`](https://www.npmjs.com/package/jest-light-runner).
It spin up a Node.js worker thread for each test file giving you the same isolation feature of `jest` but without the `vm`'s context.
Note that not all the `jest` features are supported by this runner, but all the most used features are working!  
So, after installing it, you can verify that the tests are green by running the command:

```bash
jest --runner jest-light-runner test.js
```

## Summary

`jest` is a great testing framework, and it works well for frontend applications,
but you could face some issues if your dependencies rely on `instanceof`.

We discussed about how to fix this problem in different ways:

- Adopt the `jest-environment-node-single-context` custom test environment and its limitations
- Use the `jest-light-runner` runner to get the same isolation feature of `jest` but with a subset of its features
- Open an issue to the repository of the module that you are using and ask to remove the `instanceof` operator, _that is still a good practice_
- Choose another test framework. _I personally prefer [`node-tap`](https://www.npmjs.com/package/tap)_

The `jest` architecture makes sense for frontend applications that run in the browser and has a different `global` context, but it does not suit the case for Node.js applications.  
I don't like the concept of using a different `global` context in my test and production environment.

Now jump into this [article source code](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/jest-instanceof)
to try the code snippets I wrote to verify my findings.

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
