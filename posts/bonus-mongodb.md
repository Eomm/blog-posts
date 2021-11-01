# Fastify and mongodb

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

In this article I will show you how to use Fastify and MongoDB together!

> This post has been inspired by [`fastify-in-practice`](https://github.com/Eomm/fastify-in-practice/#fastify-in-practice)
> A talk I gave at the Come to Code 2021 conference in Italy!

Let's jump into the code!

## TODO List application

We will create a simple TODO list application using Fastify and MongoDB.
It will be a simple CRUD application within 3 routes:

- **GET /todos**: returns all the todos
- **POST /todos**: creates a new todo
- **PUT /todos/:id**: updates the todo with the given id

Our basic object model will be:

```js
const model = {
  id: 'unique-identifier',
  text: 'todo item text',
  done: false,
  doneAt: null
}
```

### Setup

First of all, we need to create a fastify application.
So let's create a brand new project and install fastify:

```
mkdir my-fastify-app
cd my-fastify-app
npm init --yes
npm install fastify
```

Then we will need some additional plugins to boost our productivity!

```sh
npm install fastify-cli
npm install fastify-env
npm install fastify-mongodb
```

Note that we will use a local mongodb installation, so we need to [install mongodb](https://docs.mongodb.com/manual/installation/) locally
or run a Docker container image.

### Build the application scaffold

We are not repeating the nice [Getting Started documentation](https://www.fastify.io/docs/latest/Getting-Started/) from the Fastify website.
In fact, we are going to use since the beginning the [`fastify-cli`](https://www.npmjs.com/package/fastify-cli) to build our application!

Let's create an `app.js` file:

```js
module.exports = async function application (app, opts) {
  app.get('/', async (request, reply) => {
    return { hello: 'world' }
  })

  // our code..
}
```

Now, let's add to the `package.json` these scripts:

```json
{
  "scripts": {
    "start": "fastify start -l info --options app.js",
    "dev": "fastify start -l info --options app.js --watch --pretty-logs",
  }
}
```

We will be able to run `npm run dev` to start the application in development mode.
This will enable us to watch for changes and **restart the application automatically!**

### Connect to MongoDB

Connecting Fastify to a MongoDB database is very easy!
Let's edit out `app.js` and add the following code:

```js
module.exports = async function application (app, opts) {
  // ...

  app.register(require('fastify-mongodb'), {
   url: 'mongodb://localhost:27017/todo-list'
  })

  // our code..
}
```

Now to start the server we need a mongodb instance running.
So, we can add two new commands to the `scripts` section of the `package.json`:

```json
{
  "scripts": {
    "mongo:start": "docker run --rm -d -p 27017:27017 --name mongo-todo mongo:4",
    "mongo:stop": "docker stop mongo-todo"
  }
}
```

Running `npm run mongo:start` will start a mongodb container and `npm run mongo:stop` will stop it.

### Adding the configuration

Every application needs a configuration file. We have set the mongodb URL into out code, but this is not
a good practice. We should use environment variables instead.

Create a new `.env` file and add the following lines:

```
NODE_ENV="development"
MONGO_URL="mongodb://localhost:27017/todo-list"
```

Now let's update the `app.js` file:

```js
module.exports = async function application (app, opts) {
  // ...
  await app.register(require('fastify-env'), {
    schema: {
      type: 'object',
      properties: {
        PORT: { type: 'integer', default: 3000 },
        NODE_ENV: { type: 'string' },
        MONGO_URL: { type: 'string' }
      }
    }
  })

  app.register(require('fastify-mongodb'), {
   url: app.config.MONGO_URL
  })

  // our code..
}
```

Using the [`fastify-env`](https://github.com/fastify/fastify-env#fastify-env) plugin we can now access the environment variables from the `app.config` object.
Moreover, it will trigger an error if the environment variables are not set correctly.

### How to create the routes

We have a working application, but we need to add some routes.
Create a new file `routes.js` and add the following code:

```js
module.exports = function todoRoutes (app, opts, next) {
  app.post('/todos', async function insertTodo (request, reply) {
    const todosCollection = app.mongo.db.collection('todos')
    const result = await todosCollection.insertOne(request.body)
    reply.code(201)
    return { id: result.insertedId }
  })

  app.get('/todos', async function readTodos (request, reply) {
    const todosCollection = app.mongo.db.collection('todos')
    const docs = await todosCollection.find().toArray()
    return docs.map(d => 
      // remove the _id field and name it as id
      d.id = d._id.toString()
      return d
    })
  })

  app.put('/todos/:id', async function updateTodo (request, reply) {
    const todosCollection = app.mongo.db.collection('todos')
    const result = await todosCollection.updateOne(
      { _id: this.mongo.ObjectId(request.params.id) },
      {
        $set: {
          done: request.body.done,
          doneAt: request.body.done === true ? new Date() : null
        }
      })

    // returns 404 is the todo is not found
    if (result.matchedCount === 0) {
      const error = new Error('Object not found: ' + request.params.id)
      error.status = 404
      throw error
    }
    return { id: request.params.id }
  })

  next()
}
```

The file `routes.js` is a Fastify plugin. Everything in Fastify is a plugin, and even our routes can be a plugin.

The `fastify-mongodb` plugin adds a [decorator](https://www.fastify.io/docs/latest/Decorators/#usage) to our `app` instance called `mongo`.
The `mongo` object will contain a `db` property, which is a mongodb database instance - which we have set through the `.env` file.

Now we can test our routes calling them from an HTTP client as `curl`:

```sh
curl \
  -X POST http://localhost:3000/todos \
  -H 'Content-Type: application/json' \
  -d '{"text":"LEARN FASTIFY"}'

curl http://localhost:3000/todos

curl \
  -X PUT http://localhost:3000/todos/$(id) \
  -H 'Content-Type: application/json' \
  -d '{"done":true}'
```

### Secure the API

At the moment, we have a very simple API. But it lacks security.
To secure our API we need to add the JSON Schema Validation and Serialization to our routes!

#### Validation

The validation protect our routes from bad input data.
We can define a set out schemas, using the [JSON Schema standard](https://json-schema.org/).

In a `schema.js` file we can add the following code:

```js
const todoInputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 80
    },
    done: {
      type: 'boolean',
      default: false
    }
  },
  required: ['text']
}

const todoUpdateSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    done: {
      type: 'boolean',
      default: false
    }
  }
}

const todoIdSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 24,
      maxLength: 24
    }
  }
}

const todosArraySchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      text: { type: 'string' },
      done: { type: 'boolean' },
      doneAt: { type: 'date-time' }
    }
  }
}
```

These schemas will:

- remove all unknown properties from the inputs, so we can be sure that we are only working with the defined properties
- validate the input data against the schema, so we can be sure that the data is correct and we are not inserting a TODO item with a text that is too long
- for the GET route, it returns to the client only the properties that are defined in the schema

To integrate the schemas within our routes, we need to edit the `routes.js` file:

```js
// ...
  app.post('/todos', {
    schema: {
      body: schemas.todoInputSchema
    }
  }, ...)

    app.get('/todos', {
    schema: {
      response: {
        200: schemas.todosArraySchema
      }
    }
  }, ...)

  app.put('/todos/:id', {
    schema: {
      params: schemas.todoIdSchema,
      body: schemas.todoUpdateSchema
    }
  }, ...)
```

And it is done!!
If you try to call your routes with bad data, you will get a `400` error.

## Summary

Congratulations! You have completed the Fastify tutorial!
Now you can use Fastify to build your API and secure it.

You have seen very useful features of Fastify:

- application reloading during development
- how to connect and use the MongoDB database
- how to use the JSON Schema Validation and Serialization

See you soon for the next article about testing and deployment!
