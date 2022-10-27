'use strict'

const http = require('http')

class MyError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
  }
}

module.exports = {
  aSimpleArray: [1, 2, 3],
  isInstanceOfArray: (param) => {
    return param instanceof Array
  },
  aSimpleError: new Error('This is an error'),
  isInstanceOfError: (param) => {
    return param instanceof Error
  },
  MyError,
  aSimpleHttpRequest: () => {
    return new Promise((resolve, reject) => {
      const request = http.request('http://does-not-exist/', res => {
        // console.log(`STATUS: ${res.statusCode}`)
        // res.on('end', () => {
        //   done(new Error('Ended before failure'))
        // })
      })

      request.once('error', err => {
        resolve(err)
        // expect(err).toBeInstanceOf(Error)
        // done()
      })
    })
  }
}
