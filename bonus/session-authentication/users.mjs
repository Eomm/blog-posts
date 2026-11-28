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

// A tiny in-memory user repository, replace it with your database
export async function createUserRepository (seed = []) {
  const users = new Map()
  for (const { id, email, password } of seed) {
    users.set(email.toLowerCase(), { id, email, passwordHash: await hashPassword(password) })
  }

  // Used when the email does not exist, so every login attempt costs the same
  const dummyHash = await hashPassword(randomBytes(16).toString('hex'))

  return {
    findById (id) {
      for (const user of users.values()) {
        if (user.id === id) return user
      }
      return null
    },

    async verifyCredentials (email, password) {
      const user = users.get(email.toLowerCase())
      const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash)
      return valid && user ? user : null
    }
  }
}
