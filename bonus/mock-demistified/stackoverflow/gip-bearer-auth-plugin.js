'use strict'

const fp = require('fastify-plugin')

// const { verifyGipToken } = require('./verifyGipToken')

async function verifyGipTokenPlugin (fastify) {
  fastify.addHook('onRequest', fastify.auth([
    // this loads the verifyGipToken again
    require('./verifyGipToken').verifyGipToken
  ]))
}

module.exports = fp(verifyGipTokenPlugin)
