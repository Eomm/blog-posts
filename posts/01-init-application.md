# A Discord app with Fastify!

This simple demo application will show you in just a few minutes how to manage:

- login with Discord using OAUTH2 code flow
- secure the web application
- serve web pages
- test the web application
- deploy the web application to Heroku

all this using [Fastify v3](https://fastify.io/)!


## Plugins

Fastify has great plugins that let you do more, with less.

We will use:

- [fastify](https://github.com/fastify/fastify): we need a great web framework!
- [fastify-cli](https://github.com/fastify/fastify-cli): to manage the startup of the server, to avoid annoing boilerplate code
- [fastify-env](https://github.com/fastify/fastify-env): to load the configuration
- [fastify-helmet](https://github.com/fastify/fastify-helmet): to protect our users from malicious ones
- [fastify-oauth2](https://github.com/fastify/fastify-oauth2): to manage the OAUTH2 flow
- [fastify-static](https://github.com/fastify/fastify-static): to serve some static HTML file (just one, but this is a demo, right?)
- [point-of-view](https://github.com/fastify/point-of-view): to serve some server-side-render (SSR) pages

a loooot of things that will let you get a wide overview of the power of fastify!

## The Application

The target is quite simple: to show to a user its Discord profile. The required pages are:

- a root page to perform login
- a page to show the profile
- an error page (because it happens 😔)

The source code of this project is at your disposal on [GitHub](https://github.com/Eomm/fastify-discord-bot-demo).

### Project setup

Thanks to the awesome [Fastify plugin system](https://www.fastify.io/docs/latest/Getting-Started/#your-first-plugin)
all you need to do is create a simple file like this:

```js
// app.js
module.exports = function app (fastify, opts, next) {
  fastify.get('/', function handler (request, reply) {
    reply.send('hello world')
  })
  next()
}
```

then run it with the [`fastify-cli`](https://github.com/fastify/fastify-cli): `fastify start app.js`
and you're DONE! The server is online!

### Homepage

Now, let's assume a great designer creates a stunning `homepage.html` for us:

```js
// app.js
module.exports = function app (fastify, opts, next) {
  ...
  // every plugin must be registered
  fastify.register(require('fastify-static'), {
    root: path.join(__dirname, '../pages'), // the pages are stored in a directory
    serve: false // we don't want to expose only the static file because we do it ourself!
  })

  // everytime the user loads the site root, the homepage will be sent
  fastify.get('/', function serveHtml (request, reply) {
    reply.sendFile('homepage.html')
  })

  // and if the user types a wrong URL, the homepage will be loaded as a fallback
  fastify.setNotFoundHandler(function letsGoToHomepage (request, reply) {
    reply.redirect('/')
  })
  ...
}
```

Now the homepage is online!

### Login

In the homepage there is the "Login with Discord" button, but how can we manage the authentication?

First of all it is necessary to create a [Discord Application](https://discord.com/developers/applications)
to get the credentials: `CLIENT_ID` and `CLIENT_SECRET`.
You will need to register the valid callback URI like `http://localhost:3000/auth/discord/callback`,
otherwise Discord will refuse to call back your application during the user login.

To load the configuration it is necessary to:

```js
// app.js
module.exports = function app (fastify, opts, next) {
  ...
  // this schema is useful to get clear error on startup. 
  // So when you don't have a valid Env configured you will know WHY!
  const schema = {
    type: 'object',
    required: ['PORT', 'DISCORD_CLIENT_ID', 'DISCORD_SECRET'],
    properties: {
      BASE_URL: { type: 'string' },
      PORT: { type: 'integer', default: 3000 },
      DISCORD_CLIENT_ID: { type: 'string' },
      DISCORD_SECRET: { type: 'string' },
      DISCORD_PERMISSION: { type: 'string' }
    }
  }

  // register the plugin that will load the data
  fastify.register(require('fastify-env'), { schema, dotenv: true })
  ...
```

In local env a `.env` file must be created as following:

```
BASE_URL=http://localhost:3000
DISCORD_CLIENT_ID=1234567890
DISCORD_SECRET=ABC123ABC
```

> Note: the `BASE_URL` parameter will be useful to deploy to Heroku

Now, to keep all our logic in order, we can create a new file to manage this flow.. 
and always export the same interface of the plugin system.

```js
// auth.js
const oauth2 = require('fastify-oauth2')

module.exports = function auth (fastify, opts, next) {
  // fastify.config has been added by fastify-env - thanks to decorators!

  // register the OAUTH2 plugin.. and it is done!
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
    callbackUri: 'http://localhost:3000/discord/callback' // this URL must be exposed
  })

  // the callbackUri implementation
  fastify.get('/discord/callback', async function (request, reply) {
    // the response will have the `code`
    const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

    // in async handler it is possible to just return the payload!
    return token
  })

  next()
}
```

It is possible to try out the login and since I'm lazy I can run `fastify start -w app.js`
That `-w` flag will reload the project whenever I save a file in the project itself!

Everything should work and the output of the login is an ugly JSON response!

### SSR

Now let's proceed by adding a bit of server side rendering using the `handlerbars` engine.

We need to configure it first:

```js
// app.js
module.exports = function bot (fastify, opts, next) {
  ...
  fastify.register(require('point-of-view'), {
    engine: {
      handlebars: require('handlebars')
    }
  })

  // now we can manage all unexpected errors in a nicer way!
  fastify.setErrorHandler(function (error, request, reply) {
    reply.view('/pages/error.hbs', error)
  })
  ...
```

Too easy!

Now, the designer draws another page to show the user profile:

```js
// auth.js
module.exports = function auth (fastify, opts, next) {
  ...
  fastify.get('/discord/callback', async function (request, reply) {
    const token = await this.discordOAuth2.getAccessTokenFromAuthorizationCodeFlow(request)

    // the token can be used to get the user data
    const userData = await got.get('https://discord.com/api/users/@me', {
      responseType: 'json',
      headers: {
        authorization: `${token.token_type} ${token.access_token}`
      }
    })

    // show the nice user profile
    reply.view('/pages/who-am-i.hbs', userData.body)
  })
  ...
```

### Security

Right now this application doesn't have many security concerns, since there is no information or cookie being stored: the token is read, used and deleted.

But how could we add security to the web pages?

```js
// app.js
module.exports = function app (fastify, opts, next) {
  ...
  fastify.register(require('fastify-helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'via.placeholder.com', 'cdn.discordapp.com'], // list all the good source
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'kit.fontawesome.com'], // list all the good source
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"]
      }
    }
  })
  ...
```

### Test

Thanks to Fastify, tests are easy to implement!

Here's an example with [`tap`](https://github.com/tapjs/node-tap)

```js
const t = require('tap')
const nock = require('nock')
const Fastify = require('fastify')

const app = require('../app.js')

t.test('the application starts', async t => {
  const server = Fastify()
  server.register(app) // it is necessary to register the app entrypoint

  // then with .inject it is possible to execute HTTP requests to the server without starting it!
  const res = await server.inject('/')
  t.equal(res.payload, fs.readFileSync('./pages/homepage.html', 'utf8'))
})
```

### Deploy

The application is done. The last step is to deploy it to Heroku!

To do it, we have to add a `start` script like this in the `package.json`:

```
"start": "fastify start -a 0.0.0.0 app.js",
```

in order to start correctly the server on the heroku platform.

Now you need to create the app in the [heroku dashboard](https://dashboard.heroku.com/apps).
Following the instruction to connect this instance to your repository will be very easy!

```bash
heroku login
# add a new remote to my repository
heroku git:remote -a fastify-discord-app-demo
# check the remote addition
git remote -v
# push your master
git push heroku master
# in case your branch is not master:
git push heroku local-branch:master
```

Remember to configure the ENV vars in the settings tab.

Now it is necessary to add the new callback URI `https://fastify-discord-app-demo.herokuapp.com/auth/discord/callback`
to the Discord OAUTH2 settings.


Congrats, the application is online [fastify-discord-app-demo.herokuapp.com](https://fastify-discord-app-demo.herokuapp.com/)!!

## End

In the next posts we will:

+ store the token in cookies
+ add a CI/CD pipeline
+ more tests - they are never enough
+ add other features to this demo discord application with Fastify!

Write comments below or open an issue on GitHub for any questions or feedback!
Thank you!

## Acknowledgements

Thank you very much to [@ezamagni](https://github.com/ezamagni) for the great feedback!
