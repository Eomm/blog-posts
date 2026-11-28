import { test } from 'node:test'
import Fastify from 'fastify'

import naiveApp from '../00-naive.mjs'

function sessionCookie (response) {
  return response.cookies.find((cookie) => cookie.name === 'sessionId')
}

test('the naive version is vulnerable to session fixation', async (t) => {
  const app = Fastify()
  app.register(naiveApp)
  t.after(() => app.close())

  // 1. The attacker gets a valid session id, without logging in
  const attacker = await app.inject({ method: 'GET', url: '/' })
  const planted = sessionCookie(attacker)
  t.assert.ok(planted, 'every anonymous visitor gets a session cookie')

  // 2. The victim logs in with the cookie planted by the attacker
  const victim = await app.inject({
    method: 'POST',
    url: '/login',
    cookies: { sessionId: planted.value },
    payload: { email: 'victim@example.com', password: 'abcdef' }
  })
  t.assert.equal(victim.statusCode, 200)

  // 3. The attacker's cookie is now authenticated 😱
  const hijacked = await app.inject({ method: 'GET', url: '/', cookies: { sessionId: planted.value } })
  t.assert.match(hijacked.body, /logged in/)
})

test('the naive session cookie is not Secure and has no SameSite', async (t) => {
  const app = Fastify()
  app.register(naiveApp)
  t.after(() => app.close())

  const response = await app.inject({ method: 'GET', url: '/' })
  const cookie = sessionCookie(response)
  t.assert.equal(cookie.secure, undefined)
  t.assert.equal(cookie.sameSite, undefined)
  t.assert.equal(cookie.httpOnly, true)
})

test('the naive logout is a GET request', async (t) => {
  const app = Fastify()
  app.register(naiveApp)
  t.after(() => app.close())

  const login = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: 'victim@example.com', password: 'abcdef' }
  })
  const cookies = { sessionId: sessionCookie(login).value }

  // An <img src="https://your.app/logout"> on any website is enough
  await app.inject({ method: 'GET', url: '/logout', cookies })
  const home = await app.inject({ method: 'GET', url: '/', cookies })
  t.assert.match(home.body, /please login/)
})

test('the naive wrong password response is a 401 with a Location header', async (t) => {
  const app = Fastify()
  app.register(naiveApp)
  t.after(() => app.close())

  const response = await app.inject({
    method: 'POST',
    url: '/login',
    payload: { email: 'victim@example.com', password: 'wrong' }
  })
  t.assert.equal(response.statusCode, 401)
  t.assert.equal(response.headers.location, '/login')
  t.assert.equal(response.body, '')
})
