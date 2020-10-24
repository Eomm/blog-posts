
import dotenv from 'dotenv'

export default async function load (path) {
  dotenv.config({ path })

  /**
   * This function is async because we could
   * load some KEYS from external services (like AWS Secrets Manager)
   * in future
   */

  const configuration = {
    ...process.env,
    fastify: {
      logger: process.env.NODE_ENV !== 'production'
    }
  }

  return configuration
}
