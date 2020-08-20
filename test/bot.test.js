'use strict'

const fs = require('fs')
const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')
const oauth2 = require('fastify-oauth2')

const app = require('../lib/app')

const fakeToken = {
  token: {
    access_token: '111111111111111111111111111111',
    expires_in: 604800,
    refresh_token: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    scope: 'identify',
    token_type: 'Bearer'
  }
}

t.beforeEach(function (done, childTest) {
  const server = Fastify()
  server.register(app)
  childTest.context.server = server
  childTest.teardown(() => { server.close() })
  done()
})

t.test('the application starts', async t => {
  await t.context.server.ready()
})

t.test('the application load the homepage', async t => {
  const res = await t.context.server.inject('/')
  t.equal(res.payload, fs.readFileSync('./pages/homepage.html', 'utf8'))
})

t.test('the application redirect when 404', async t => {
  const res = await t.context.server.inject(`/${Math.random()}/${Math.random()}`)
  t.equal(res.statusCode, 302)
})

t.test('click on login', async t => {
  const res = await t.context.server.inject('/auth/discord')
  t.equal(res.statusCode, 302)
  t.like(res.headers.location, 'discord.com')
})

// TODO
t.test('receive a callback', { todo: true }, async t => {
  nock(oauth2.DISCORD_CONFIGURATION.tokenHost)
    .post(oauth2.DISCORD_CONFIGURATION.tokenPath)
    .reply(200, () => fakeToken)

  const res = await t.context.server.inject('/auth/discord/callback?code=ABC123')
  t.equal(res.statusCode, 200)
})

t.test('receive a callback error', async t => {
  const res = await t.context.server.inject('/auth/discord/callback?code=ABC123')
  t.equal(res.statusCode, 500)
  t.like(res.payload, '<title>Error</title>', 'the error page is returned')
})

// {
//   id: "111111111111111111",
//   username: "Eomm",
//   avatar: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
//   discriminator: "5262",
//   public_flags: 0,
//   flags: 0,
//   email: "awesome@hello.com",
//   verified: true,
//   locale: "it",
//   mfa_enabled: false
// }