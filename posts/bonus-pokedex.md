# How to build a pokedex with Platformatic

Recently, Matteo Collina one of the Fastify's creators, launched a new Backend As A Service service: [Platformatic](https://platformatic.dev/).
Since it is built on top of Fastify and it clamins to be life changer I want to try it and write down my thoungs!

So, what are we going to build? A Pokedex! Of course I don't want to write a boring article, let's make it a bit more fun! Here is the requirements:

- The Pokemon's database already exists. It will be our "legacy" system.
- I want to build a React frontend. It will test the Platformatic's "extensibility". Note that Platformatic is a "Backend" framework, but I know that fastify can handle frontend too.
- A user must be logged in to use the app. I want to test the "authentication" feature.

Now that we have the requirements, let's start!

Features list https://oss.platformatic.dev/docs/reference/db/introduction#features

## The database

The first step is to create the database. I'm going to extract the data from [Poke API](https://pokeapi.co/docs/v2#pokemon). I used the following GraphQl query to extract the data:

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

Then I 

## Creating the Platformatic project

After creating the database, I created the Platformatic project.
The first step is to follow the [Plafromatic documentation]()


```bash
npm create platformatic@latest
```

I followed the easy step-by-step guide. Here my complete output:

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

Then I created a react ui interface + setup cors for platformatic

Then I turned back to platformatic to serve the web app
"dashboard": false,
edit the workflow

all done!

