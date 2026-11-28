import { before, test } from 'node:test'
import Fastify from 'fastify'

import authApp, { SESSION_COOKIE } from '../app.mjs'
import { createUserRepository } from '../users.mjs'

const EMAIL = 'manuel@example.com'
const PASSWORD = 'correct horse battery staple'

let users
before(async () => {
  users = await createUserRepository([{ id: '1', email: EMAIL, password: PASSWORD }])
})

async function buildApp (t) {
  // The tests act as a TLS terminating proxy on 127.0.0.1
  const app = Fastify({ trustProxy: '127.0.0.1' })
  app.register(authApp, { users, sessionSecrets: ['a'.repeat(32)] })
  t.after(() => app.close())
  await app.ready()
  return app
}

// A tiny browser: it keeps the cookies between the requests
function browser (app) {
  const jar = new Map()
  return {
    jar,
    async request (opts) {
      const response = await app.inject({
        ...opts,
        headers: { 'x-forwarded-proto': 'https', ...opts.headers },
        cookies: Object.fromEntries(jar)
      })
      for (const cookie of response.cookies) {
        if (cookie.maxAge === 0 || (cookie.expires && cookie.expires <= new Date())) {
          jar.delete(cookie.name)
        } else {
          jar.set(cookie.name, cookie.value)
        }
      }
      return response
    }
  }
}

function csrfToken (response) {
  return response.body.match(/name="_csrf" value="([^"]+)"/)[1]
}

async function login (client, { email = EMAIL, password = PASSWORD } = {}) {
  const page = await client.request({ method: 'GET', url: '/login' })
  return client.request({
    method: 'POST',
    url: '/login',
    payload: { _csrf: csrfToken(page), email, password }
  })
}

test('the session cookie is locked down', async (t) => {
  const app = await buildApp(t)
  const response = await browser(app).request({ method: 'GET', url: '/login' })

  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE)
  t.assert.equal(cookie.secure, true)
  t.assert.equal(cookie.httpOnly, true)
  t.assert.equal(cookie.sameSite, 'Lax')
  t.assert.equal(cookie.path, '/')
  t.assert.equal(cookie.domain, undefined)
})

test('the responses have the security headers', async (t) => {
  const app = await buildApp(t)
  const response = await browser(app).request({ method: 'GET', url: '/login' })

  t.assert.match(response.headers['content-security-policy'], /frame-ancestors 'self'/)
  t.assert.match(response.headers['strict-transport-security'], /max-age=\d+/)
  t.assert.equal(response.headers['x-content-type-options'], 'nosniff')
  t.assert.equal(response.headers['cache-control'], 'no-store')
})

test('anonymous visitors do not get a session', async (t) => {
  const app = await buildApp(t)
  const response = await browser(app).request({ method: 'GET', url: '/' })
  t.assert.equal(response.cookies.length, 0)
})

test('the login requires a CSRF token', async (t) => {
  const app = await buildApp(t)
  const client = browser(app)
  await client.request({ method: 'GET', url: '/login' })

  const response = await client.request({
    method: 'POST',
    url: '/login',
    payload: { email: EMAIL, password: PASSWORD }
  })
  t.assert.equal(response.statusCode, 403)
})

test('wrong credentials get the same generic error', async (t) => {
  const app = await buildApp(t)

  const wrongPassword = await login(browser(app), { password: 'nope' })
  const unknownEmail = await login(browser(app), { email: 'nobody@example.com' })

  t.assert.equal(wrongPassword.statusCode, 401)
  t.assert.equal(unknownEmail.statusCode, 401)
  t.assert.match(wrongPassword.body, /Invalid email or password/)
  t.assert.match(unknownEmail.body, /Invalid email or password/)
})

test('the login regenerates the session id', async (t) => {
  const app = await buildApp(t)
  const client = browser(app)

  await client.request({ method: 'GET', url: '/login' })
  const plantedCookie = client.jar.get(SESSION_COOKIE)

  await login(client)
  t.assert.notEqual(client.jar.get(SESSION_COOKIE), plantedCookie)

  const profile = await client.request({ method: 'GET', url: '/profile' })
  t.assert.equal(profile.statusCode, 200)
  t.assert.match(profile.body, /manuel@example\.com/)

  // The attacker's cookie is still anonymous
  const attacker = await app.inject({
    method: 'GET',
    url: '/profile',
    headers: { 'x-forwarded-proto': 'https' },
    cookies: { [SESSION_COOKIE]: plantedCookie }
  })
  t.assert.equal(attacker.statusCode, 303)
  t.assert.equal(attacker.headers.location, '/login')
})

test('the profile page requires a user', async (t) => {
  const app = await buildApp(t)
  const response = await browser(app).request({ method: 'GET', url: '/profile' })
  t.assert.equal(response.statusCode, 303)
  t.assert.equal(response.headers.location, '/login')
})

test('the logout is a POST protected by CSRF', async (t) => {
  const app = await buildApp(t)
  const client = browser(app)
  await login(client)

  const viaGet = await client.request({ method: 'GET', url: '/logout' })
  t.assert.equal(viaGet.statusCode, 404)

  const withoutToken = await client.request({ method: 'POST', url: '/logout', payload: {} })
  t.assert.equal(withoutToken.statusCode, 403)

  const loggedSessionCookie = client.jar.get(SESSION_COOKIE)
  const home = await client.request({ method: 'GET', url: '/' })
  const logout = await client.request({
    method: 'POST',
    url: '/logout',
    payload: { _csrf: csrfToken(home) }
  })
  t.assert.equal(logout.statusCode, 303)
  t.assert.equal(client.jar.has(SESSION_COOKIE), false)

  // The old cookie is useless, the session is gone from the store
  const replay = await app.inject({
    method: 'GET',
    url: '/profile',
    headers: { 'x-forwarded-proto': 'https' },
    cookies: { [SESSION_COOKIE]: loggedSessionCookie }
  })
  t.assert.equal(replay.statusCode, 303)
})

test('the login is rate limited', async (t) => {
  const app = await buildApp(t)
  const client = browser(app)

  const statusCodes = []
  for (let i = 0; i < 6; i++) {
    const response = await login(client, { password: `guess-${i}` })
    statusCodes.push(response.statusCode)
  }
  t.assert.deepEqual(statusCodes, [401, 401, 401, 401, 401, 429])
})

test('cross-site form submissions are blocked', async (t) => {
  const app = await buildApp(t)
  const response = await browser(app).request({
    method: 'POST',
    url: '/login',
    headers: { 'sec-fetch-site': 'cross-site' },
    payload: { email: EMAIL, password: PASSWORD }
  })
  t.assert.equal(response.statusCode, 403)
})

test('the session expires after 15 minutes of inactivity', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const app = await buildApp(t)
  const client = browser(app)
  await login(client)

  t.mock.timers.tick(16 * 60 * 1000)
  const response = await client.request({ method: 'GET', url: '/profile' })
  t.assert.equal(response.statusCode, 303)
})

test('the session expires after 8 hours even if the user is active', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() })
  const app = await buildApp(t)
  const client = browser(app)
  await login(client)

  // One request every 10 minutes keeps the session alive...
  for (let minutes = 10; minutes < 8 * 60; minutes += 10) {
    t.mock.timers.tick(10 * 60 * 1000)
    const response = await client.request({ method: 'GET', url: '/profile' })
    t.assert.equal(response.statusCode, 200)
  }

  // ...until the absolute timeout
  t.mock.timers.tick(10 * 60 * 1000)
  const response = await client.request({ method: 'GET', url: '/profile' })
  t.assert.equal(response.statusCode, 303)
})
