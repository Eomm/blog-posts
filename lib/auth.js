'use strict'

const oauth2 = require('fastify-oauth2')
const got = require('got')

module.exports = function bot (fastify, opts, next) {
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
    const userData = await got.get('https://discord.com/api/users/@me', {
      responseType: 'json',
      headers: {
        authorization: `${token.token_type} ${token.access_token}`
      }
    })

    reply.view('/pages/who-am-i.hbs', userData.body)
  })

  next()
}
