
import configurationLoader from './utils/configuration-loader.mjs'
import appFactory from './app.mjs'

;(async function () {
  const config = await configurationLoader()
  const server = appFactory(config)
  server.listen(config.PORT || 3000, '0.0.0.0', (err) => {
    if (err) {
      server.log.error(err)
      process.exit(1)
    }
  })
})()
