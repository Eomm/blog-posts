# How to build an authenticated session with Fastify

## And how to close every security hole along the way

A login form looks like the simplest feature of a web application: two inputs, one button, done.
Then you start asking questions. Where do I store the fact that the user is logged in? How does the server recognize them at the next request? What happens if someone steals the cookie?

HTTP is stateless, so the server forgets you after every response. A **session** is the trick that makes it remember: the server keeps the user data, and the browser keeps a small cookie that points to it.

Writing a session login that works takes a few lines of code with [`@fastify/session`](https://github.com/fastify/session).
Writing one that is safe takes a few more, and the difference between the two is where the attackers live 😱

So, would you like to build an authenticated session the right way? In this article we will:

- see how a session works in Fastify
- write a naive login that works, and find all of its security holes
- rewrite it step by step, closing each hole with the right plugin or option
- prove every fix with `node:test`

That sounds like a lot of security jargon, but don't worry: each step is a few lines of code, and most of them are a plugin option.

## How does a session work?

Before writing any code, let's see the moving parts:

1. The user submits the login form
2. The server checks the credentials and creates a session: an object, saved in a **session store**, under a random id
3. The server sends the session id to the browser in a cookie, signed with a secret so nobody can forge it
4. At every following request, the browser sends the cookie back, the server verifies the signature, loads the session from the store and knows who the user is
5. At logout, the server deletes the session from the store

The user data never leaves the server: the browser only holds an opaque id.
In Fastify, [`@fastify/cookie`](https://github.com/fastify/fastify-cookie) parses and signs the cookies, while `@fastify/session` does everything else and exposes the session as `request.session`.

## A first, naive login

Let's write the smallest login that works:

```js
import fastifySession from '@fastify/session'
import fastifyCookie from '@fastify/cookie'
import fastifyFormbody from '@fastify/formbody'

export default async function naiveApp (app) {
  app.register(fastifyFormbody)
  app.register(fastifyCookie)
  app.register(fastifySession, {
    cookieName: 'sessionId',
    secret: 'a secret with minimum length of 32 characters',
    cookie: { maxAge: 1800000, secure: false }
  })

  app.get('/login', (request, reply) => {
    reply.type('text/html')
    reply.send(loginPage())
  })

  app.post('/login', (request, reply) => {
    const { password } = request.body

    if (password === 'abcdef') {
      request.session.authenticated = true
      reply.type('text/html')
      reply.send(defaultPage(true))
    } else {
      reply.redirect('/login', 401)
    }
  })

  app.get('/', (request, reply) => {
    reply.type('text/html')
    reply.send(defaultPage(request.session.authenticated))
  })

  app.get('/logout', (request, reply) => {
    if (request.session.authenticated) {
      request.session.destroy((err) => {
        if (err) {
          reply.status(500)
          reply.send('Internal Server Error')
        } else {
          reply.redirect('/')
        }
      })
    } else {
      reply.redirect('/')
    }
  })
}
```

The `loginPage()` and `defaultPage()` functions build the HTML by concatenating strings: a form that posts to `http://localhost:3000/login`, and a page that says "logged in" with a logout link or "please login".

The flow follows the steps we just saw:

1. `@fastify/formbody` parses the HTML form body
2. `POST /login` checks the password and writes `authenticated = true` into `request.session`
3. `GET /` reads `request.session.authenticated` to know who is calling
4. `GET /logout` destroys the session

Try it in the browser and it works! Sounds great, right? But let's put on the attacker's hat and read it again.

## The holes in the naive login

### 1. Session fixation

This is the most dangerous one, so let's start with it.

`@fastify/session` creates a session for every visitor, even anonymous ones, because the `saveUninitialized` option defaults to `true`.
When the user logs in, we set `authenticated = true` in **the same session**, so the session id does not change.

That enables a [session fixation](https://owasp.org/www-community/attacks/Session_fixation) attack:

1. the attacker visits your site and gets a valid, signed session id
2. the attacker plants that cookie in the victim's browser, for example from a compromised subdomain or a network they control
3. the victim logs in
4. the attacker's cookie is now an authenticated cookie

Don't trust me, trust the test:

```js
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
```

This test passes. The rule to remember: **when the privileges change, the session id must change too**.

### 2. The secret is in the source code

The cookie signing secret is a string literal committed to the repository.
Anyone who reads the code can sign cookies that your server accepts, and you cannot change the secret without a deploy.

### 3. The cookie is not locked down

`secure: false` means that the browser sends the session cookie over plain HTTP too, so anyone on the same network can read it.
On top of that, the form `action` points to `http://localhost:3000/login`, so the password travels in clear text as well.

The cookie also has no `SameSite` attribute. Chrome treats a missing attribute as `Lax`, but you should not rely on every browser doing the same.

### 4. The password check

```js
if (password === 'abcdef') {
```

This line hides three problems:

- the password is stored in plain text, in the source code
- the `===` comparison exits at the first different character, so in theory the response time leaks information about the password
- the email is ignored! Any email works, as long as the password is `abcdef`

### 5. No CSRF protection

The login form has no [CSRF](https://owasp.org/www-community/attacks/csrf) token, so another website can submit it.
This is called "login CSRF": the attacker logs the victim into the attacker's account, and everything the victim types afterwards ends up in the attacker's hands.

The logout is even easier to abuse, because it is a `GET` request. An `<img src="https://your.app/logout">` on any web page is enough to log your users out.

### 6. Unlimited login attempts

Nothing stops an attacker from trying thousands of passwords per minute.
With a six letters password like `abcdef`, it would not take long.

### 7. No security headers

The responses have no `Content-Security-Policy`, no `Strict-Transport-Security` and no `X-Frame-Options`.
So the login page can be loaded inside an invisible `<iframe>` on another site ([clickjacking](https://owasp.org/www-community/attacks/Clickjacking)), and the browser is never told to stick with HTTPS.

The authenticated pages also have no `Cache-Control` header, so a shared computer or a proxy could keep a copy of them.

### 8. The in-memory session store

The default store is a `Map` in the server memory. The `@fastify/session` docs are clear about it: it leaks memory and it should not be used in production.

Combined with `saveUninitialized: true`, every request without a cookie creates a new session. A simple script that never sends cookies can fill your server memory.
It also breaks as soon as you run two instances of your application, because each instance has its own `Map`.

### 9. Only an idle timeout

The cookie `maxAge` is 30 minutes, and the `rolling` option (enabled by default) renews it on every response.
That is an idle timeout, which is good, but there is no absolute timeout: a session that makes one request every 29 minutes lives forever.

### 10. HTML built by string concatenation

Today there is no user input in the pages, so this is not exploitable yet.
The day you add `Hello ${email}` to the home page, you get a [Cross-Site Scripting](https://owasp.org/www-community/attacks/xss/) hole.

### 11. A broken error response

When the password is wrong, `reply.redirect('/login', 401)` sends a `401` status code with a `Location` header and an empty body.
Browsers don't follow a `Location` header on a `401`, so the user sees a blank page. This is a bug rather than a security hole, but we will fix it anyway.

Wow, that's a lot of holes for a few lines of code!
Let's write the authenticated session again, the secure way.

## Writing the authenticated session, step by step

We need some more plugins from the Fastify ecosystem:

```bash
npm install fastify @fastify/cookie @fastify/session @fastify/formbody \
  @fastify/csrf-protection @fastify/helmet @fastify/rate-limit
```

The companion project is split into a few files:

- `server.mjs`: reads the configuration and starts the server
- `app.mjs`: the authentication plugin
- `users.mjs`: password hashing and a tiny user repository
- `html.mjs`: the HTML templates

### Step 1: the session secret

The secrets come from an environment variable, and the server refuses to start without them:

```js
// Generate a secret with: node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
// Put the new secret first and keep the old ones until their sessions expire
const sessionSecrets = (process.env.SESSION_SECRETS ?? '').split(',').filter(Boolean)
if (sessionSecrets.length === 0 || sessionSecrets.some((secret) => secret.length < 32)) {
  throw new Error('SESSION_SECRETS must contain one or more comma separated secrets of 32+ characters')
}
```

`@fastify/session` accepts an array of secrets: it signs new cookies with the first one and verifies incoming cookies with all of them.
So you can rotate the secret without logging out all your users: add the new secret in the first position, wait until the old sessions expire, and then remove the old secret.

### Step 2: the session configuration

Here is the session setup in `app.mjs`:

```js
// The __Host- prefix forces the browser to accept the cookie only if
// it is Secure, has Path=/ and has no Domain attribute
export const SESSION_COOKIE = '__Host-sid'
const SESSION_COOKIE_OPTIONS = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' }

const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 minutes
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000 // 8 hours

export default async function authApp (app, opts) {
  const { users, sessionSecrets, sessionStore } = opts

  // ...other plugins

  await app.register(fastifySession, {
    secret: sessionSecrets, // an array, so you can rotate the secrets
    cookieName: SESSION_COOKIE,
    cookie: { ...SESSION_COOKIE_OPTIONS, maxAge: IDLE_TIMEOUT },
    saveUninitialized: false,
    rolling: true,
    store: sessionStore // the default in-memory store leaks memory
  })
```

Let's break it down:

- `secure: true` tells the browser to send the cookie only over HTTPS. It is the `@fastify/session` default, so our naive version had to turn it off explicitly
- `httpOnly: true` hides the cookie from JavaScript, so an XSS bug cannot read it
- `sameSite: 'lax'` stops the browser from sending the cookie on cross-site `POST` requests, our first CSRF defense
- the [`__Host-` prefix](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes) is a browser feature: the cookie is rejected unless it is `Secure`, has `Path=/` and has no `Domain`. So a compromised subdomain cannot overwrite it, which makes the fixation attack much harder in the first place
- `saveUninitialized: false` creates a session only when we write something into it, so anonymous visitors cost nothing
- `maxAge` with `rolling: true` is the idle timeout: 15 minutes without requests and the session expires, both in the browser and on the server

A Secure cookie needs HTTPS, and here is a detail that bites many people: `@fastify/session` does not save the session at all when `secure` is `true` and `request.protocol` is not `https`.
In production your app usually runs behind a reverse proxy that terminates TLS, so Fastify sees plain HTTP. You must set the [`trustProxy`](https://fastify.dev/docs/latest/Reference/Server/#trustproxy) option to read the `X-Forwarded-Proto` header:

```js
const app = Fastify({
  logger: true,
  // Trust only your reverse proxy, for example: TRUST_PROXY=10.0.0.1
  trustProxy: process.env.TRUST_PROXY ?? false,
  // Local HTTPS, for example with: mkcert localhost
  https: process.env.TLS_KEY
    ? { key: readFileSync(process.env.TLS_KEY), cert: readFileSync(process.env.TLS_CERT) }
    : null
})
```

Avoid `trustProxy: true`: it trusts the `X-Forwarded-*` headers from **anyone**, so an attacker can send a fake `X-Forwarded-For` header and change `request.ip` at every request. Keep it in mind, because the rate limiter we will add uses `request.ip`.
For local development, the `TLS_KEY` and `TLS_CERT` variables start the server with HTTPS, using a certificate generated by a tool like [mkcert](https://github.com/FiloSottile/mkcert).

### Step 3: the session store

The `store` option is passed by the caller, so you can plug a persistent store, such as Redis, without touching the plugin.

Pay attention when you choose one: since v11.2.0, `@fastify/session` requires the store to implement a `compareAndSet(sessionStoreId, expectedGeneration, session, callback)` method, besides `get`, `set` and `destroy`.
It prevents an in-flight request from resurrecting a session that another request has just destroyed or regenerated. Stores written for `express-session` don't have it, so they need a small adapter. Check the [store section](https://github.com/fastify/session#store) of the docs before picking one.

The companion project keeps the default in-memory store to stay runnable without extra services, and that is the only production gap I left on purpose.

### Step 4: storing the passwords

Before we can log anyone in, we need users, and users have passwords.
The user repository stores a hash of the password, never the password itself.
Node.js ships [`crypto.scrypt()`](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback), a password hashing function designed to be slow and memory hungry, so we don't need any dependency:

```js
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// OWASP minimum for scrypt: N=2^17, r=8, p=1
const SCRYPT_OPTIONS = { N: 2 ** 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }
const KEY_LENGTH = 64

export async function hashPassword (password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return `${salt.toString('base64')}:${key.toString('base64')}`
}

export async function verifyPassword (password, storedHash) {
  const [salt, key] = storedHash.split(':').map((part) => Buffer.from(part, 'base64'))
  const candidate = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return timingSafeEqual(candidate, key)
}
```

The code above does the following:

1. Every password gets a random salt, so two users with the same password get different hashes
2. The parameters follow the [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt) minimum. `N: 2 ** 17` needs 128 MiB of memory, more than the 32 MiB default `maxmem`, so we raise it
3. `timingSafeEqual()` compares the two buffers in constant time, so the comparison doesn't leak anything

OWASP's first choice is Argon2id. Recent Node.js versions ship `crypto.argon2()` as well, so check its stability status in the docs of your Node.js version before using it.

Then, the repository verifies the credentials:

```js
// Used when the email does not exist, so every login attempt costs the same
const dummyHash = await hashPassword(randomBytes(16).toString('hex'))

async verifyCredentials (email, password) {
  const user = users.get(email.toLowerCase())
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash)
  return valid && user ? user : null
}
```

Why the dummy hash? If we returned early when the email is unknown, a failed login for a non-existent user would take a few microseconds, while a failed login for a real user would run scrypt.
An attacker could measure the response time and find out which emails are registered. With the dummy hash, both paths run scrypt.

### Step 5: the login form

The `GET /login` route renders the form with a CSRF token in a hidden field:

```js
app.get('/login', async (request, reply) => {
  if (await loadUser(request)) {
    return reply.redirect('/', 303)
  }
  return reply.type('text/html').send(loginPage({ csrfToken: reply.generateCsrf() }))
})
```

The token comes from [`@fastify/csrf-protection`](https://github.com/fastify/csrf-protection), registered with `sessionPlugin: '@fastify/session'`, so it keeps its secret in the session.
`reply.generateCsrf()` writes that secret into the session, so this is the moment when an anonymous visitor gets a session cookie. A visitor of the home page doesn't get one.

We will see `loadUser()` in a moment. For now, it returns the logged user or `null`.

### Step 6: creating the authenticated session

This is the heart of the article, where most of the fixes meet:

```js
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
```

Let's go through it from top to bottom:

1. **Rate limit**: [`@fastify/rate-limit`](https://github.com/fastify/fastify-rate-limit) is registered with `global: false`, so only the routes with a `rateLimit` config are limited. Here we allow 5 attempts per minute per IP, and the sixth gets a `429`. Scrypt is expensive on purpose and runs on the libuv thread pool, so the rate limit also protects your CPU, not only your users
2. **CSRF**: we run the check in the `preValidation` hook because the `_csrf` field is in the body, and the body is not parsed yet in the `onRequest` hook
3. **Validation**: the JSON schema rejects a malformed email or a huge password before we spend CPU on hashing
4. **Generic error**: the same `Invalid email or password` message for a wrong password and for an unknown email. We log the failure, but never the password
5. **`regenerate()`**: this is the fix for session fixation. The session gets a new id and the old cookie becomes useless. It also drops the CSRF secret, so a new one is created for the authenticated session
6. **Session data**: we store only the user id and the login time, not the whole user object. The session must not become a second, stale copy of your database
7. **303 redirect**: after a successful `POST`, we redirect with `303 See Other`, so a page refresh does not resubmit the form

### Step 7: reading the session in protected routes

Now that the session holds a `userId`, every request can find out who is calling.
Instead of checking the session in every handler, a `preHandler` hook guards the private routes:

```js
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

app.get('/profile', { preHandler: requireUser }, async (request, reply) => {
  return reply.type('text/html').send(profilePage({ user: request.user }))
})
```

`loadUser()` adds the missing absolute timeout: 8 hours after the login, the session is destroyed even if the user is active.
It also reads the user from the repository at every request, so a deleted user loses access immediately, even with a valid session.

If you have many private routes, you can register `requireUser` as an `onRequest` hook inside an [encapsulated plugin](https://backend.cafe/the-complete-guide-to-the-fastify-plugin-system) and put all the private routes there.

### Step 8: destroying the session

The logout is a `POST` now, protected by CSRF:

```js
app.post('/logout', { preValidation: app.csrfProtection }, async (request, reply) => {
  await request.session.destroy()
  // A __Host- cookie can be deleted only with the same attributes it was set with
  reply.clearCookie(SESSION_COOKIE, SESSION_COOKIE_OPTIONS)
  return reply.redirect('/login', 303)
})
```

`session.destroy()` removes the session from the store, so the old cookie is useless even if someone copied it.
Then we delete the cookie from the browser too. Because of the `__Host-` prefix, the browser ignores a `Set-Cookie` header without the `Secure` attribute, so we must pass the same options we used to create it.

The home page shows a small form with a hidden `_csrf` field and a "Logout" button, instead of a link.

### Step 9: security headers and a modern CSRF check

[`@fastify/helmet`](https://github.com/fastify/fastify-helmet) adds a sensible set of security headers with one line:

```js
await app.register(fastifyHelmet)
```

Among others, it sets these headers:

```text
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: SAMEORIGIN
```

`frame-ancestors 'self'` and `X-Frame-Options` stop clickjacking, `form-action 'self'` stops an injected form from posting your users' passwords to another domain, and `Strict-Transport-Security` tells the browser to use only HTTPS for a year.
Our pages don't use inline scripts, so the default policy works as is.

Then, two small hooks:

```js
const SAFE_FETCH_SITES = new Set(['same-origin', 'none'])

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
```

Modern browsers send the [`Sec-Fetch-Site`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site) header with every request, and the attacker's page cannot change it.
If a `POST` comes from another site, we reject it before doing any work. Old clients that don't send the header still go through the CSRF token check, so this hook adds a layer without replacing the token.

The `Cache-Control: no-store` header tells browsers and proxies not to keep a copy of the pages.

### Step 10: escaping the HTML

The templates use template literals, and every dynamic value goes through `escapeHtml()`:

```js
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

export function profilePage ({ user }) {
  return layout('Profile', `<h1>Profile</h1><p>Email: ${escapeHtml(user.email)}</p>`)
}
```

If your app grows beyond a few pages, use a template engine that escapes by default, with [`@fastify/view`](https://github.com/fastify/point-of-view).
The form `action` is a relative `/login` now, so it follows the page protocol and domain.

## Verifying it

A security fix without a test is a wish, so the companion project has a `node:test` suite that uses `app.inject()` with a tiny cookie jar to simulate a browser.

The tests run the app as if it was behind a TLS terminating proxy, with `trustProxy: '127.0.0.1'` and an `x-forwarded-proto: https` header, which is the same setup you would have in production.

Here is the fixation test again, against the new app:

```js
test('the login regenerates the session id', async (t) => {
  const app = await buildApp(t)
  const client = browser(app)

  await client.request({ method: 'GET', url: '/login' })
  const plantedCookie = client.jar.get(SESSION_COOKIE)

  await login(client)
  t.assert.notEqual(client.jar.get(SESSION_COOKIE), plantedCookie)

  const profile = await client.request({ method: 'GET', url: '/profile' })
  t.assert.equal(profile.statusCode, 200)

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
```

The other tests check that:

- the cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, with `Path=/` and no `Domain`
- the security headers and `Cache-Control: no-store` are set
- anonymous visitors don't get a session
- the login and the logout reject requests without a CSRF token, and `GET /logout` does not exist
- a wrong password and an unknown email get the same response
- the sixth login attempt in a minute gets a `429`
- a cross-site `POST` is blocked by the `Sec-Fetch-Site` check
- the session expires after 15 minutes of inactivity, and after 8 hours even with one request every 10 minutes. The tests use `t.mock.timers` to move `Date` forward, so you don't have to wait 8 hours 😄

The `test/naive.test.mjs` file proves the holes of the naive version, so you can run both suites and compare them:

```bash
cd bonus/session-authentication
npm install
npm test
```

## What is still on you

The companion project closes the holes of the naive login, but a real authentication system has more moving parts. Before going to production, think about:

- **A persistent session store**, with `compareAndSet` support, and a shared store for `@fastify/rate-limit` if you run more than one instance
- **Account level throttling**: the rate limit is per IP, so an attacker with many IPs can still try one password on many accounts (credential stuffing). Track the failures per account too, and notify the user
- **Multi-factor authentication**, which makes a stolen password much less useful
- **Password rules and breached passwords**: check new passwords against a list of known leaked ones
- **Password reset and email verification flows**, which are a common source of holes on their own
- **Re-authentication** before sensitive actions, like changing the email or the password, and destroying the other sessions of the user when the password changes
- **Monitoring**: alert on spikes of failed logins and `429` responses

## Summary

A session login that works is easy to write, a safe one needs some care. Here is the checklist we went through:

- call `request.session.regenerate()` after the login, or you are open to session fixation
- store only the user id and the login time in the session, and load the user at every request
- read the secrets from the environment and pass an array to rotate them
- lock down the cookie: `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Lax`, and `saveUninitialized: false`
- set `trustProxy` to your proxy address, never to `true`, or the Secure cookie and the rate limit break
- hash the passwords with scrypt or Argon2id, compare them with `timingSafeEqual()`, and hash a dummy value for unknown emails
- protect every state changing route with a CSRF token, never change state with a `GET`, and check `Sec-Fetch-Site` as an extra layer
- rate limit the login route
- add security headers with `@fastify/helmet` and `Cache-Control: no-store`
- enforce both an idle and an absolute session timeout
- escape every dynamic value in your HTML
- use a persistent session store in production

All the code lives in the [`bonus/session-authentication`](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/session-authentication) directory of this repository, together with the tests that prove each fix.

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
