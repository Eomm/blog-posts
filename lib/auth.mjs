
import oauth2 from 'fastify-oauth2'
import cookie from 'fastify-cookie'
import caching from 'fastify-caching'
import serverSession from 'fastify-server-session'
import got from 'got'

export default function auth (fastify, opts, next) {
  const baseUrl = new URL(fastify.config.BASE_URL)

  fastify
    .register(cookie)
    .register(caching)
    .register(serverSession, {
      secretKey: 'some-secret-password-at-least-32-characters-long',
      sessionMaxAge: 604800,
      cookie: {
        domain: baseUrl.hostname,
        httpOnly: true,
        secure: fastify.config.NODE_ENV !== 'development',
        maxAge: 60
      }
    })

  fastify.addHook('onRequest', function userAlreadyLogged (req, reply, done) {
    if (req.session.token) {
      viewUserProfile(req.session.token, reply)
        .catch(done) // don't forget to manage errors!
      return // do not call `done` to stop the flow
    }
    done()
  })

  fastify.register(oauth2, {
    name: 'discordOAuth2',
    credentials: {
      client: {
        id: fastify.config.DISCORD_CLIENT_ID,
        secret: fastify.config.DISCORD_SECRET
      },
      auth: oauth2.DISCORD_CONFIGURATION
    },
    scope: ['identify'],
    startRedirectPath: '/discord',
    callbackUri: `${fastify.config.BASE_URL}${opts.prefix || ''}/discord/callback`
  })

  fastify.get('/discord/callback', async function (request, reply) {
    const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
    // server stored: the token object must not be sent to the client
    request.session.token = token
    return viewUserProfile(token, reply)
  })

  next()
}

async function viewUserProfile (token, reply) {
  const userData = await got.get('https://discord.com/api/users/@me', {
    responseType: 'json',
    headers: {
      authorization: `${token.token_type} ${token.access_token}`
    }
  })

  return reply.view('/pages/profile.hbs', userData.body)
}
