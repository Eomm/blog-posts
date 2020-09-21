# To Production

This tutorial is the 3rd of a series. Read the [previous ones](https://github.com/Eomm/fastify-discord-bot-demo/#fastify-discord-app-demo)
to get the codebase.

## A Database

Things are getting serious, so it is time to connect the application to MongoDB because all applications
need a datasource and on the web there are old tutorials!

The first step is to get a database:

- in the local environment a docker instance of mongodb will be used
- in the CI we will use another docker instance
- in production/Heroku we will connect to an [Atlas MongoDB](https://www.mongodb.com/cloud/atlas). It has a free plan that fit perfectly for our needs!

**DISCLAIMER:** We will write test too off course, but we will not write a line of `mock` because:
- containers are cheap
- you can't test a query with mocks
- I think that DB state is not a cons (this sentence could be a dedicated talk 😀)

### Local database

This step is quite simple after installing [Docker](https://www.docker.com/) on your
PC.

I like to add the command in the `package.json`:

```json
  "local:mongo": "docker run -d -p 27017:27017 --rm --name mongoLocal mongo:4.2",
  "local:mongo:stop": "docker container stop mongoLocal"
```

### CI database

Thanks to Actions this step is simple too:

```yml
  - name: Start MongoDB
    uses: supercharge/mongodb-github-action@1.3.0
    with:
      mongodb-version: 4.2
```

### Production database

It is [Atlas MongoDB](https://www.mongodb.com/cloud/atlas) business how they give us a free mongodb cluster on AWS! Awesome!

## Project structure

Before digging into the code it is mandatory to focus a bit on the project structure to build and
maintaine efficently the application because now, things are getting serious.

### Application vs Loader

Fastify is great in encapsulation and I found that following some rules let developers build
applications with lesser discomforts.  
_The following example is a TL;DR version of the [Testing](https://www.fastify.io/docs/latest/Testing/)
and [Plugins-Guide](https://www.fastify.io/docs/latest/Plugins-Guide/) pages._

The rules are:

- An `application.js` file that expose `module.exports = function buildApp (opts) {..`.
This is **THE APPLICATION** factory, it loads all the plugins and the routes it needs and **doesn't load the configuration**.
The configuration is read by `opts` parameter.

- An `start.js` file that has 2 responsibilities:

  1. loading the configuration
  2. loading the application

This could be breaf into this code example:

```js
const config = await configurationLoader(process.argv[2] || process.env.NODE_ENV)
const app = require('./application.js')(config)
await app.listen(config.fastify.port, config.fastify.host)
```

This simple structure will permit to load the application in a serverless environment, in a local PC
or in the CI servers without effort.

### Testable

Loading the application configuration in a centralized point, and then propagate it throug all the application
components is very easy thanks to the [`.register`](https://www.fastify.io/docs/latest/Plugins-Guide/#register) parameters!

```js
module.exports = function buildApp (opts) {
  const server = Fastify(opts.fastify)
  server.register(require('./routes'), opts) // the 2nd parameter of `register` is the configuration of the plugin!
  return server
}
```

This is fundamental to avoid issues during tests implementation.

The key part is to write a loader (like the main `start.js`) for the application:

```js
test('a test', async () => {
  const fakeConfig = await configurationLoader('test')
  const app = require('./application.js')(fakeConfig)
  const response = await app.inject({ ... })
})
```

### Encapsulation

Fastify helps you to apply the separation of concerns design principle thanks to its encapsulation system.  
This lead to applications more secure and better structured.

> Is your database connection available where it is not necessary?

Thanks to encapsulation this could be avoided at all!

[![encapsulation](https://i.stack.imgur.com/2QRnf.png)](https://stackoverflow.com/a/61054534/3309466)

If the database is needed only in the right branch of the image, you can establish the database connection
only in the purple context:

- the purple context and all its children can access the database connection
- the left branch and the root itself will be **NOT** able access the DB

Keeping in mind the application tree structure it is possible to design a highly modulable software:

- every branch of the tree can be moved to another fastify instance: this can be useful when a piece of your application
became too big and deserve to be indipendent from the rest of your application
- you can see patterns on your applications and build useful plugins to avoid repetitive work


## Store the auth token

TODO

## Connect to mongodb with Fastify

Fastify has a plugin for everything!  This time it is the turn of [fastify-mongodb](https://github.com/fastify/fastify-mongodb)!

To load it, it is necessary that the configuration is valid.
To do so we are using `fastify-env` already, but the Fastify plugin loading is totally async.
So, we must use [`after()`](https://www.fastify.io/docs/latest/Server/#after) accomplish this task:

```js
import env from 'fastify-env'
// ...
fastify.register(env, { ... })
  .after((err) => {
    if (err) throw err // if the config file has some issue, we must bubble up it
    fastify.register(fastifyMongo, { url: fastify.config.DB_URI })
  })
```

**WARNING:** right now we will not focus to find the better place where loading the mongodb connection 
as said in the _Encapsulation_ paragraph.  We will do this process in future in order to focus on security
steps and to learn how to refactor a Fastify application.

Now the `fastify.mongo` decorator has been added to the instance and it will be accessible to
the instance itself and the children contexts.  
At this stage, all the routes can access `fastify.mongo`!

So the new awesome feature will be to add a page that list all the people that tried our application!
But this time the page will not be a Server Side Rendering, but the list loading will be via REST API consumption.

> Since in EU there is the GDPR regulamentation, we will not store the real people username, but a
> fake-one in order to skip annoying messages and policies, because those are not tasks of this tutorial!

To isolate the APIs from the other application's components we create a brand new directory where all
the APIs will be implemented.

It is necessary to expose the fastify plugin interface as usual:

```js
export default function api (fastify, opts, next) {
  // API context
  next()
}
```

Then we can:

- add a PUT endpoint to create/update the visitor
- add a GET endpoint to read the visitor's book with pagination
- define the input and the output JSON schemas to secure:
  - the input from malicous users
  - the output from unnecessary data

```js
// it keep the code strict as possible all the JSON schemas are in a dedicated file
import schema from './schema.mjs'

export default function api (fastify, opts, next) {

  // this context must return always JSON errors
  fastify.setErrorHandler(function (error, request, reply) {
    reply.send(error)
  })

  // the endpoint creates users
  fastify.put('/users/:userId', {
    handler: createUser,
    schema: schema.createUser
  })

  // the endpoint searches for users
  fastify.get('/users', {
    handler: searchUsers,
    schema: schema.searchUsers
  })

  next()
}

// write `function` to user the fastify instance as `this`
// the great thing is that you may organize these functions wherever you want in the project
// without struggling with tons of `factory-pattern` or clojures!
async function createUser (request, reply) {
  const { userId } = request.params

  await this.mongo.client.db()
    .collection('Users')
    .updateOne(
      { id: userId },
      {
        $set: request.body,
        $push: { visits: new Date() },
        $setOnInsert: { created: new Date() }
      },
      { upsert: true })

  request.log.debug('Track user %s', userId) // fastify has a logger included!
  reply.code(201)
  return { userId }
}

async function searchUsers (request, reply) {
  const { offset, limit } = request.query

  // just a simple pagination
  const query = await this.mongo.client.db().collection('Users')
    .find({}, { projection: { _id: 0, visits: { $slice: -1 } } })
    .sort({ username: 1 })
    .skip(offset)
    .limit(limit)

  const total = await query.count() // it doesn't apply the skip&limit 😉
  const rows = await query.toArray()

  return { rows, total }
}
```

## End

TODO
