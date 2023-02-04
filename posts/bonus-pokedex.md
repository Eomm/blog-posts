# How to build a pokedex with Platformatic

Recently, [Matteo Collina](https://nodeland.dev/) one of the Fastify's creators and much more, launched a new Backend As A Service service: [Platformatic](https://platformatic.dev/).
Since it is built on top of Fastify and it clamins to be life changer and I want to try it and write down my thoungs!

So, what are we going to build? A Pokedex!  
Of course I don't want to write a boring article, let's make it a bit more fun!  
Here are the requirements:

- The Pokemon database already exists. It will be our "legacy" system
- I want to build a React frontend. It will test the Platformatic's "extensibility". Note that Platformatic is a "Backend" framework, but fastify can handle frontend too!
- The application must be read only. I don't want to expose any write API

Now that we have the requirements, let's start!


## The database

The first step is to create our database schema. Note that this section does not concen Platformatic itself,
but I want to track my working process.

This is the raw Entity-Relation schema for our pokedex:

![Pokedex DB Schema]()

We must write down the code into a `001.do.schema.sql` file. It will be the first migration file.

Then we need to fill the schema, so we will extract the data from [Poke API](https://pokeapi.co/docs/v2#pokemon).
I used the following GraphQL query to collect all the pokemon data:

```gql
query gottaCatchThemAll {
  pokemon: pokemon_v2_pokemon {
    id
    name
    height
    weight
    types: pokemon_v2_pokemontypes {
      type: pokemon_v2_type {
        name
        id
      }
    }
    images: pokemon_v2_pokemonsprites {
      sprites
    }
    specy:pokemon_v2_pokemonspecy {
      generation_id
      is_baby
      is_legendary
      is_mythical
      color:pokemon_v2_pokemoncolor {
        name
        id
      }
      evolutions: pokemon_v2_evolutionchain {
        baby_trigger_item_id
        id
        chain: pokemon_v2_pokemonspecies {
          id
          order
        }
      }
    }
  }
}
```

Then, with a [simple magical Node.js script]() we can save it the the `INSERT` statements into a `002.do.data.sql` file.

At this point we have the database schema and the data. We can now start to create the Platformatic project.

## Creating the Platformatic project

After the database preparation, we can start to create the Platformatic project.
I followed the [Plafromatic documentation](https://oss.platformatic.dev/docs/getting-started/quick-start-guide/#create-a-new-api-project)
that is really well written and helpful.

So, I'm going to recap breafly what I did.

### Installation

The installation requires Node.js >= v18.8.0 and then we can run one single command:

```bash
npm create platformatic@latest
```

Then, the installer will ask you some questions.  
Here my complete output:

```sh
Need to install the following packages:
  create-platformatic@0.12.1
Ok to proceed? (y) y
 Hello, Manuel Spigolon welcome to Platformatic 0.12.1!
 Let's start by creating a new project.
? Which kind of project do you want to create? DB
? Where would you like to create your project? .
? Do you want to create default migrations? yes
? Do you want to create a plugin? yes
? Do you want to use TypeScript? no
[10:25:02] INFO: Configuration file platformatic.db.json successfully created.
[10:25:02] INFO: Environment file .env successfully created.
[10:25:02] INFO: Migrations folder migrations successfully created.
[10:25:02] INFO: Migration file 001.do.sql successfully created.
[10:25:02] INFO: Migration file 001.undo.sql successfully created.
[10:25:02] INFO: Plugin file created at plugin.js
? Do you want to run npm install? yes
✔ ...done!
? Do you want to apply migrations? no
? Do you want to generate types? no
[10:26:36] INFO: Configuration schema successfully created.
? Do you want to create the github action to deploy this application to Platformatic Cloud? yes
[10:26:40] INFO: Github action successfully created, please add PLATFORMATIC_API_KEY as repository secret.
 
All done! Please open the project directory and check the README.
```

After this setup, we have an empty project ready to be adapted to our needs.

### Preparation

During the project generation, the `migrations/` folder has been created.  
Here we are going to remove all the files and copy the `001.do.schema.sql` and `002.do.data.sql` files we created in the
previous [`The database` section](#the-database).

Now we are ready to wire Platformatic to our custom database.  
To do so I created some additional `scripts` in the `package.json`:

```
{
  "scripts": {
    "start": "platformatic db start",
    "db:migrations": "platformatic db migrations apply",
    "db:types": "platformatic db types"
  }
}
```

> I love this setup because it will execute the installed `platformatic` CLI
> and I must not remember complex commands

So, by running the `npm run db:migrations` command:

- it will create an SQLite database with our Pokemons!
- the `types/` folder is generated to help us during the development phase!

We are ready to execute `npm start` to spin up our server!  
If all is correctly working you will be able to open a browser at `http://localhost:3042/pokemon/6`
to see the most powerful Pokemon 🔥!

## Adding a User Interface to Platformatic

This is **backend.cafe** so I'm not going to annoing you explaining how I built the Pokedex UI,
I'm still improving my frontend skill set actually.
It worth to mention that it is a React.js application an the Plafromatic auto reload was
nice and shine during the implementation phase.

Here a preview of what I built so far:

![Pokedex UI preview](./assets/pokedex-ui.png)

This UI has some challanges for the backend too:

- Serve the website pages
- A very long list to show with pagination
- A search form
- A `<select>` input item with a list of database's data

Let's solve the all!

### Serve a static website

To serve static files with Fastify, you need to use [`@fastify/static`](https://github.com/fastify/fastify-static) plugin.  
And I used it with Platformatic too, because all the Fastify's plugins are compatible!

As a Fastify user, doing it has been really simple. I created a `/static-website.js` file
that does exactly what I need:

```js
const path = require('path')
const fastifyStatic = require('@fastify/static')

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.register(fastifyStatic, {
    root: path.join(__dirname, 'pokedex-ui/build'),
    decorateReply: false
  })
}
```

The code is quite straitforward but has one awesome addition.  
The `jsdoc` comment before the `module.exports` statement provides you a cool autocompletion
feature adding your whole database!

![Platformatic autocompletion](./assets/autocompletion.png)

This pattern works for TypeScript users and pure JavaScript developer too!

After implementing our custom code, we must integrate it into Platformatic, so we need to edit the
core of our Platformatic application, the `platformatic.db.json` file.  
This [configuration file controls](https://oss.platformatic.dev/docs/next/reference/db/configuration) everything
on our application such as:

- The HTTP server
- The additional plugins and integrations
- The different environments
- The authorizations
- The application metrics and monitoring
- ..and many other things

In our case we need to add our `static-website.js` to the `plugins` section and turn the `dashboard` offline:

```json5
{
  // ... other Platformatic settings
  "dashboard": false,
  "plugin": [
    {
      "path": "static-website.js"
    }
  ]
}
```

By default, Platformatic serves a cool dashboard as root endpoint `/`.  
It is really insigtful to explore all the endpoints Platformatic generated for us.  
In my case I want to serve the Pokedex UI as root path, so I had to turn it off. (Note there is a feature request [to customize the dashboard endpoint](https://github.com/platformatic/platformatic/issues/657))


### How to implement the pagination and the search form

Well.. I don't have too much to say here because it works out of the box!  
To implement it I need two queries:

- One to search a slice of the whole dataset
- One to count the whole dataset by using the same filters of the search query

Under the hood, Platformatic is using the [`@platformatic/sql-mapper`](https://oss.platformatic.dev/docs/reference/sql-mapper/introduction) plugin to generate a set of APIs from a database schema.
[Here you can find a complete list](https://oss.platformatic.dev/docs/reference/sql-mapper/entities/api) of the generated endpoints. This plugin can generate what you need to implement the pagination and the search form without any extra configuration!

The queries are the following:

```gql
query searchPokemon($limit: LimitInt, $offset: Int, $name: String, $gen: [Int]) {
  pokemon(limit: $limit, offset: $offset, where: {name: {like: $name}, generation: { in: $gen } }) {
    id
    name
    picture { url }
    isLegendary
  }
}

query countSearchPokemon($name: String, $gen: [Int]) {
  countPokemon(where: {name: {like: $name}, generation: { in: $gen }}) {
    total
  }
}
```

As you can see, the only difference is that the first query manages the `limit` and `offset` parameters
that are a standard de facto for every pagination.

Moreover, every generated enpoint has a [complete query system](https://oss.platformatic.dev/docs/reference/sql-mapper/entities/api#where-clause) to filter the data!

I really enjoyed to focus only on my Pokedex UI, without the need to implement or change something in the backend.


### How to get custom data

The `Generation` select item in the search box, should list all the Pokemon's generation.
This query is too much specific and our database schema doesn't facilitate Platformatic to generate
such query. So we need to write a custom endpoint to do so!

Since Platformatic generate REST and GraphQL endpoints by default, we need to choose if we want
to implement the custom endpoint as REST or GQL or both of course: it is up to us.

I will go for the GQL one because my UI relays on GraphQL to communicate with the backend.

The operation consist in two steps:

1. Extend the GQL Schema by declaring the custom Query
2. Implment the new Query resolver

If you don't know GQL and these steps are not clear, I think that reading [these articles]()
will help you to introduce yourself to GraphQL.

```js
/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  // 1. Extend the GQL Schema
  app.graphql.extendSchema(`
    extend type Query {
      generations: [Int]
    }
  `)

  // 2. Implement the resolver
  app.graphql.defineResolvers({
    Query: {
      generations: async function (source, args, context, info) {
        const sql = app.platformatic.sql('SELECT DISTINCT generation FROM Pokemon ORDER BY generation ASC')
        const generations = await app.platformatic.db.query(sql)
        return generations.map(g => g.generation)
      }
    }
  })
}
```

The handler runs a raw SQL query and return the results.

### How to expose read-only endpoints



## Summary



If you enjoyed this article, comment, share, and follow me on [Twitter @ManuEomm](https://twitter.com/ManuEomm)!
