'use strict'

const { test } = require('tap')

const buildApp = require('./app')

test('A user without any role should not be able to retrieve any field', { skip: 'https://github.com/mercurius-js/auth/issues/98' }, async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'none', `
    query {
      searchData {
        ... on AdminGrid {
          totalRevenue
        }
      }
    }
  `)

  t.equal(res.errors[0].message, 'Failed auth policy check on totalRevenue')
})

test('A user with the `admin` role should be able to retrieve the `totalRevenue` field without inline fragments', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'admin', `
    query {
      searchData {
        totalRevenue
      }
    }
  `)

  t.same(res.data.searchData, { totalRevenue: 42 })
})

test('A user with the `moderator` role should be able to retrieve the `banHammer` field without inline fragments', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'moderator', `
    query {
      searchData {
        banHammer
      }
    }
  `)

  t.same(res.data.searchData, { banHammer: true })
})

test('A user with the `user` role should be able to retrieve the `basicColumn` field without inline fragments', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'user', `
    query {
      searchData {
        basicColumn
      }
    }
  `)

  t.same(res.data.searchData, { basicColumn: 'basic' })
})

test('A user without the `admin` role should not be able to retrieve the `totalRevenue` field', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'user', `
    query {
      searchData {
        totalRevenue
      }
    }
  `)

  t.equal(res.errors[0].message, 'Cannot query field "totalRevenue" on type "UserGrid".')
})

test('A user without the `moderator` role should not be able to retrieve the `banHammer` field', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'user', `
    query {
      searchData {
        banHammer
      }
    }
  `)

  t.equal(res.errors[0].message, 'Cannot query field "banHammer" on type "UserGrid".')
})

test('A user without the `user` role should not be able to retrieve the `basicColumn` field', async t => {
  const app = await buildApp()
  const res = await doQuery(app, 'admin', `
    query {
      searchData {
        basicColumn
      }
    }
  `)

  t.equal(res.errors[0].message, 'Cannot query field "basicColumn" on type "AdminGrid".')
})

async function doQuery (app, userType, query) {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      'x-user-type': userType
    },
    body: {
      query
    }
  })

  return res.json()
}
