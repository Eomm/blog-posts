'use strict'

const t = require('tap')
const sinon = require('sinon')

const routes = require('./routes')

const verifyGipToken = require('./verifyGipToken')

function buildApp () {
  const fastify = require('fastify')()
  fastify.register(routes)
  return fastify
}

t.test('test case', async t => {
  const sandbox = sinon.createSandbox()

  t.beforeEach(async t => {
    sandbox.stub(verifyGipToken, 'verifyGipToken').callsFake(async req => {
      console.log('verifyGipToken stub called')
      return true
    })
  })

  t.test('test case', async t => {
    const app = buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/v2/test'
    })

    t.equal(res.statusCode, 200)
  })

  t.afterEach(async t => {
    sandbox.restore()
  })
})
