import fastifyCookie from '@fastify/cookie'
import fastifyCsrf from '@fastify/csrf-protection'
import fastifyFormbody from '@fastify/formbody'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import fastifySession from '@fastify/session'

import { homePage, loginPage, profilePage } from './html.mjs'

// The __Host- prefix forces the browser to accept the cookie only if
// it is Secure, has Path=/ and has no Domain attribute
export const SESSION_COOKIE = '__Host-sid'
const SESSION_COOKIE_OPTIONS = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' }

const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 minutes
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours
const SAFE_FETCH_SITES = new Set(['same-origin', 'none'])

export default async function authApp (app, opts) {
  const { users, sessionSecrets, sessionStore } = opts

  await app.register(fastifyHelmet)
  await app.register(fastifyRateLimit, { global: false })
  await app.register(fastifyFormbody)
  await app.register(fastifyCookie)
  await app.register(fastifySession, {
    secret: sessionSecrets, // an array, so you can rotate the secrets
    cookieName: SESSION_COOKIE,
    cookie: { ...SESSION_COOKIE_OPTIONS, maxAge: IDLE_TIMEOUT },
    saveUninitialized: false,
    rolling: true,
    store: sessionStore // the default in-memory store leaks memory
  })
  await app.register(fastifyCsrf, { sessionPlugin: '@fastify/session' })

  // Defense in depth: browsers tell us where a request comes from
  app.addHook('onRequest', async (request, reply) => {
    const site = request.headers['sec-fetch-site']
    if (request.method !== 'GET' && request.method !== 'HEAD' && site && !SAFE_FETCH_SITES.has(site)) {
      return reply.code(403).send({ message: 'Cross-site request blocked' })
    }
  })

  // Pages that depend on the session must never be cached
  app.addHook('onSend', async (request, reply) => {
    reply.header('cache-control', 'no-store')
  })

  async function loadUser (request) {
    const userId = request.session.get('userId')
    if (!userId) return null

    if (Date.now() - request.session.get('authenticatedAt') >= ABSOLUTE_TIMEOUT) {
      await request.session.destroy()
      return null
    }

    return users.findById(userId)
  }

  async function requireUser (request, reply) {
    request.user = await loadUser(request)
    if (!request.user) {
      return reply.redirect('/login', 303)
    }
  }

  app.get('/login', async (request, reply) => {
    if (await loadUser(request)) {
      return reply.redirect('/', 303)
    }
    return reply.type('text/html').send(loginPage({ csrfToken: reply.generateCsrf() }))
  })

  app.post('/login', {
    config: {
      rateLimit: { max: 5, timeWindow: '1 minute' }
    },
    preValidation: app.csrfProtection,
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          _csrf: { type: 'string' },
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 256 }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body
    const user = await users.verifyCredentials(email, password)

    if (!user) {
      request.log.warn('failed login attempt')
      return reply.code(401).type('text/html').send(loginPage({
        csrfToken: reply.generateCsrf(),
        error: 'Invalid email or password'
      }))
    }

    // New privileges, new session id: this stops session fixation
    await request.session.regenerate()
    request.session.set('userId', user.id)
    request.session.set('authenticatedAt', Date.now())

    return reply.redirect('/', 303)
  })

  app.get('/', async (request, reply) => {
    const user = await loadUser(request)
    const csrfToken = user ? reply.generateCsrf() : undefined
    return reply.type('text/html').send(homePage({ user, csrfToken }))
  })

  app.get('/profile', { preHandler: requireUser }, async (request, reply) => {
    return reply.type('text/html').send(profilePage({ user: request.user }))
  })

  app.post('/logout', { preValidation: app.csrfProtection }, async (request, reply) => {
    await request.session.destroy()
    // A __Host- cookie can be deleted only with the same attributes it was set with
    reply.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS)
    return reply.redirect('/login', 303)
  })
}
