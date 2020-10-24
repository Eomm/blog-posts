
import dotenv from 'dotenv'

export default async function load () {
  const configuration = dotenv.config()

  /**
   * This function is async because we could
   * load some KEYS from external services (like AWS Secrets Manager)
   * in future
   */

  configuration.fastify = {
    logger: configuration.NODE_ENV !== 'production'
  }

  return configuration
}
