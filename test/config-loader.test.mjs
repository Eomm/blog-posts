
import path from 'path'
import t from 'tap'
import { fileURLToPath } from 'url'

import configurationLoader from '../lib/utils/configuration-loader.mjs'

t.test('check config loaded', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const config = await configurationLoader(path.join(__dirname, '../.env.example'))
  t.like(config, {
    NODE_ENV: 'development',
    BASE_URL: 'http://localhost:3000',
    DISCORD_CLIENT_ID: '12345678',
    DISCORD_SECRET: 'XXXXXXXXXXXXXXXXX',
    DB_URI: 'mongodb+srv://<user>:<password>@playground.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority'
  })
})

t.test('check PORT loaded', async t => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  process.env.PORT = '123456789'
  const config = await configurationLoader(path.join(__dirname, '../.env.example'))
  t.like(config, {
    PORT: '123456789',
    NODE_ENV: 'development',
    BASE_URL: 'http://localhost:3000',
    DISCORD_CLIENT_ID: '12345678',
    DISCORD_SECRET: 'XXXXXXXXXXXXXXXXX',
    DB_URI: 'mongodb+srv://<user>:<password>@playground.xxxxx.mongodb.net/<dbname>?retryWrites=true&w=majority'
  })
})
