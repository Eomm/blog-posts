'use strict'

class AuthorizationError extends Error { }

async function verifyGipToken (req) {
  throw new AuthorizationError('verifyGipToken is not implemented')
}

module.exports = { verifyGipToken }
