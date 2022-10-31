'use strict'

// https://github.com/facebook/jest/blob/e865fbd66e3dc4adf9d35a35ce91de1bee48bc93/packages/jest-environment-jsdom/src/index.ts
// https://github.com/kayahr/jest-environment-node-single-context
// https://github.com/facebook/jest/issues/2549

const aSimpleModule = require('./index.js')

const { parseArgs } = require('util')

test('Error is not an Error', async () => {
  const err = await aSimpleModule.aSimpleHttpRequest()
  expect(err).toBeInstanceOf(Error)
})

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
  expect(values.bar).toBeInstanceOf(Array)
})

test('Date is not a Date', async () => {
  const app = await aSimpleModule.fastifyApp()
  const resp = await app.inject('/')
  expect(resp.json()).toEqual({ instanceof: true })
})
