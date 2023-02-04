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

### How to implement the pagination

### How to get custom data

### How to implement the search form

### How to expose read-only endpoints


## Summary
