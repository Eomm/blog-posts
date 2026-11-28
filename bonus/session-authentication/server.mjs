import { readFileSync } from 'node:fs'
import Fastify from 'fastify'

import authApp from './app.mjs'
import { createUserRepository } from './users.mjs'

// Generate a secret with: node -e "console.log(crypto.randomBytes(32).toString('base64url'))"
// Put the new secret first and keep the old ones until their sessions expire
const sessionSecrets = (process.env.SESSION_SECRETS ?? '').split(',').filter(Boolean)
if (sessionSecrets.length === 0 || sessionSecrets.some((secret) => secret.length < 32)) {
  throw new Error('SESSION_SECRETS must contain one or more comma separated secrets of 32+ characters')
}

const app = Fastify({
  logger: true,
  // Trust only your reverse proxy, for example: TRUST_PROXY=10.0.0.1
  trustProxy: process.env.TRUST_PROXY ?? false,
  // Local HTTPS, for example with: mkcert localhost
  https: process.env.TLS_KEY
    ? { key: readFileSync(process.env.TLS_KEY), cert: readFileSync(process.env.TLS_CERT) }
    : null
})

const users = await createUserRepository([
  { id: '1', email: 'manuel@example.com', password: 'correct horse battery staple' }
])

app.register(authApp, { users, sessionSecrets })

await app.listen({ port: 3000 })
