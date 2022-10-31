# Should you use jest as a testing library?

`jest`, the popular testing framework created by Facebook with over 50 million downloads per month 
causes a lot of problems for backend developers.

In this article, I try to recap the `jest`'s cross and delight and why I don't use this module to test Node.js modules and applications designed to run on the Node.js runtime (_and not in browsers_).

## What is wrong with jest?

`jest` is a JavaScript Testing Framework with many features, including `isolated` written on its website.
The isolation feature's target performance:

> Tests are parallelized by running them in their own processes to maximize performance.

The `jest`'s isolation comes from [its architecture](https://jestjs.io/docs/architecture) that uses the [`node:vm`](https://nodejs.org/api/vm.html) core module under the hood.

The `vm` module lets `jest` run every test file into a sandbox with its own temporary context.
The context includes all the `global` classes such `Array`, `Error`, `Date` and many others.
([_Here the jest source code that does the trick_](https://github.com/facebook/jest/blob/e865fbd66e3dc4adf9d35a35ce91de1bee48bc93/packages/jest-environment-jsdom/src/index.ts))

Since `jest` overwrites some of those components to provide you fancy features like mocks and fake clocks,
it must set all the `vm`'s `global` data to set up the context where the test's source code will be executed.

Unfortunately, when the Node.js core modules create a new instance of a `global` class,
**they will not use** the `vm`'s context, but they fall back to the native implementation.

This results in the `instanceof` operator [will not work](https://github.com/facebook/jest/issues/2549)
as expected, and it will generate false negatives!  
You can get a quick example of this problem in the following snippet:

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

By running the above test with the command `jest --verbose test.js` it will fail with the stange error:

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

From my analysis: you can't. There is an open issue on [the Node.js repository](https://github.com/nodejs/node/issues/31852)
to let the `node:vm` module to use the `vm`'s context, but it is still open.
It seems that the Node.js core team is interested in fixing this problem by implementing the new [ShadowRealm](https://github.com/tc39/proposal-shadowrealm) spec, and I think we will make some progress during 2023.

So, till that moment, the solutions are:

- Avoid using `jest` as a testing framework for Node.js modules/backend applications. I personally prefer [`node-tap`](https://www.npmjs.com/package/tap).
- Open an issue to the repository of the module that you are using and ask to remove the `instanceof` operator

## Summary

`jest` is a great testing framework, and it works well for frontend applications,
but you could face some issues if your dependencies rely on `instanceof`.

It feels like a bet.  
Moreover, I don't like the concept of using a different `global` context in my test and production environment.

The `jest` architecture makes total sense for frontend applications that run in the browser and has
a different `global` context, but it is not the case for Node.js applications.

Now jump into the source code on GitHub and start to play with the GraphQL implemented in Fastify.

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
