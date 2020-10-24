
import dotenv from 'dotenv'

export default async function load (path) {
  const result = dotenv.config({ path })

  if (result.error) {
    throw result.error
  }

  /**
   * This function is async because we could
   * load some KEYS from external services (like AWS Secrets Manager)
   * in future
   */

  const configuration = {
    ...process.env,
    fastify: {
      logger: result.parsed.NODE_ENV !== 'production'
    }
  }

  return configuration
}
