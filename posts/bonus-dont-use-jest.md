# Should you use jest as testing library?

`jest`, the popular testing framework created by Facebook with over 50 million downloads per month 
causes a lot of problems to backend developers.

In this article I try to recap the `jest`'s cross and delight and why I don't use this module to test
Node.js modules and application designed to run on the Node.js runtime (_and not in browsers_).

## What is wrong with jest?

`jest` is a JavaScript Testing Framework with many features including `isolated` as written in its website.
The isolation feature's target performance:

> Tests are parallelized by running them in their own processes to maximize performance.

The `jest`'s isolation comes from [its architecture](https://jestjs.io/docs/architecture) that uses the [`node:vm`](https://nodejs.org/api/vm.html) core module under the hood.

The `vm` module lets `jest` to run every test file into a sandbox with its own temporaney context.
The context includes all the `global` classes such `Array`, `Error`, `Date` and many others.

Since `jest` overwrites some of those components to provide you fancy features like: mocks and fake clocks,
it must set all the `vm`'s `global` data to set up the context where the test's source code will be executed.

Unfortunately, when the Node.js core modules create a new instance of a `global` class,
**they will not use** the `vm`'s context, but they fallback to the native implementation.

This results that the `instanceof` operator will not work as expected and it will generate false negative!
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

This may seem a minor problem, just to avoid to test the `instanceof` operator, but it is not.
The bigger problem is that the `instanceof` operator **could be used** by your dependancies tree to perform
some check, and those conditions will fail.

For example, Fastify [removed the `instanceof` operator](https://github.com/fastify/fastify/pull/3200)
from its codebase because it was causing problems to those developers that rely on `jest` as testing framework.

## How to fix it?

there is an [open issue](https://github.com/nodejs/node/issues/31852) on Node.js core to provide to a `vm` instance
the Node.js global's native implementation because it is not possible!



This issue is tracked 
https://github.com/facebook/jest/issues/2549
https://github.com/nodejs/node/issues/31852