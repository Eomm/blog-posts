'use strict'

const oauth2 = require('fastify-oauth2')

module.exports = function bot (fastify, opts, next) {
  fastify.register(oauth2, {
    name: 'discordOAuth2',
    credentials: {
      client: {
        id: fastify.config.DISCORD_CLIENT_ID,
        secret: fastify.config.DISCORD_SECRET
      },
      auth: {
        authorizeHost: 'https://discord.com',
        authorizePath: '/api/oauth2/authorize',
        tokenHost: 'https://discord.com',
        tokenPath: '/api/oauth2/token'
      }
    },
    // callbackUriParams: { permissions: fastify.config.DISCORD_PERMISSION }, // only for scope=bot
    scope: ['email', 'identify', 'gdm.join', 'connections'],
    // register a fastify url to start the redirect flow
    startRedirectPath: '/discord',
    // facebook redirect here after the user login
    callbackUri: `${fastify.config.BASE_URL}${opts.prefix || ''}/discord/callback`
  })

  fastify.get('/discord/callback', async function (request, reply) {
    const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)
    reply.send(token)
  })

  next()
}
