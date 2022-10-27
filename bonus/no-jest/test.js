'use strict'

// https://github.com/kayahr/jest-environment-node-single-context

const aSimpleModule = require('./index.js')

// describe('fetch', () => {
//   it('it should be an array', () => {
//     expect(aSimpleModule.aSimpleArray).toBeInstanceOf(Array)
//     expect(aSimpleModule.aSimpleArray instanceof Array).toBe(true)
//     expect(aSimpleModule.isInstanceOfArray([1])).toBe(true)

//     const err = new aSimpleModule.MyError('This is an error')
//     expect(aSimpleModule.isInstanceOfError(err)).toBe(true)
//     expect(aSimpleModule.aSimpleError).toBeInstanceOf(Error)
//   })
// })

test('http request error being an error', async () => {
  const err = await aSimpleModule.aSimpleHttpRequest()
  expect(err).toBeInstanceOf(Error)
})
