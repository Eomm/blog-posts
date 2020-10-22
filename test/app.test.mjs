
import fs from 'fs'
import t from 'tap'
import nock from 'nock'
import oauth2 from 'fastify-oauth2'

import appFactory from '../lib/app.mjs'

const fakeTokenResponse = {
  token: {
    access_token: '111111111111111111111111111111',
    expires_in: 604800,
    refresh_token: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    scope: 'identify',
    token_type: 'Bearer'
  }
}

const fakeUserProfile = {
  id: '424242424242424242',
  username: 'Foo Bar',
  avatar: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  discriminator: '5262',
  public_flags: 0,
  flags: 0,
  email: 'mail@mail.com',
  verified: true,
  locale: 'it',
  mfa_enabled: false
}

t.beforeEach(function (done, childTest) {
  // TODO move this config
  const config = {
    NODE_ENV: 'test',
    BASE_URL: 'http://localhost:3000',
    DISCORD_CLIENT_ID: '12345678',
    DISCORD_SECRET: 'XXXXXXXXXXXXXXXXX',
    DB_URI: 'mongodb://localhost:27017/'
  }

  const server = appFactory(config)
  childTest.context.server = server
  childTest.teardown(() => { server.close() })
  done()
})

t.test('the application starts', async t => {
  await t.context.server.ready()
})

t.test('the application load the homepage', async t => {
  const res = await t.context.server.inject('/')
  t.equal(res.payload.substr(0, 500), fs.readFileSync('./pages/homepage.hbs', 'utf8').substr(0, 500))
})

t.test('the application has an health check', async t => {
  const res = await t.context.server.inject('/health')
  t.equal(res.statusCode, 200)
})

t.test('the application redirect when 404', async t => {
  const res = await t.context.server.inject(`/${Math.random()}/${Math.random()}`)
  t.equal(res.statusCode, 302)
})

t.test('OAUTH2 Code Flow', async t => {
  await t.test('click on login', async t => {
    const res = await t.context.server.inject('/auth/discord')
    t.equal(res.statusCode, 302)
    t.like(res.headers.location, 'discord.com')

    const redirect = new URL(res.headers.location)
    const oauthState = redirect.searchParams.get('state')

    await t.test('succesfull login', async t => {
      const codeQueryParams = `code=ABC123&state=${oauthState}`
      nock(oauth2.DISCORD_CONFIGURATION.tokenHost)
        .post(oauth2.DISCORD_CONFIGURATION.tokenPath)
        .reply(200, fakeTokenResponse)
        .get('/api/users/@me')
        .times(2)
        .reply(200, fakeUserProfile)

      const res = await t.context.server.inject(`/auth/discord/callback?${codeQueryParams}`)

      t.equal(res.statusCode, 200)
      t.like(res.payload, '<h5 class="card-title">Hi Foo Bar!</h5>', 'the page is loaded')
      t.equals(res.cookies.length, 1, 'one session cookie must be returned')
      t.equals(res.cookies[0].name, 'sessionid', 'the session id cookie')

      const resCached = await t.context.server.inject({
        method: 'GET',
        url: '/auth/discord',
        cookies: {
          [res.cookies[0].name]: res.cookies[0].value
        }
      })

      t.equal(resCached.statusCode, 200)
      t.like(resCached.payload, '<h5 class="card-title">Hi Foo Bar!</h5>', 'the page is loaded')
    })
  })
})

t.test('receive a callback error', async t => {
  const res = await t.context.server.inject('/auth/discord/callback?code=ABC123')
  t.equal(res.statusCode, 500)
  t.like(res.payload, '<title>Error</title>', 'the error page is returned')
})
