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

Before digging into the code it is mandatory to focus a bit on the project structure to build and maintaine efficently the application because now, things are getting serious.

### Application vs Loader

TODO + lambda example

### Testable

TODO input `opts`

### Encapsulation and Isolation

Security

## Connect to mongodb with Fastify

Fastify has a plugin for everything! This time it is the turn of [fastify-mongodb](https://github.com/fastify/fastify-mongodb)!

```js
```