# The Complete Guide to the Fastify Plugin System

The most important feature of Fastify is the Plugin System and the encapsulation concept.
These two features are synonymous as we are talking about the same thing.

The Plugin System is a powerful tool that allows you to build a modular application.
Unfortunately, it is also the most misunderstood feature of Fastify.
In this article, we will see how it works and how to avoid common mistakes.
We are going to view the encapsulation with awesome images to make it easier to understand.


## What is the encapsulation?

The encapsulation is not a new engeneering concept nor a Fastify exclusive feature.
It is the Plugin System base concept and you can't ignore it if you want to take advantage of Fastify.

You can read its formal description in the [Wikipedia page](https://en.wikipedia.org/wiki/Encapsulation_(computer_programming).
Briefly, it is a mechanism that allows you to create an isolated _context_ from the others application's _contexts_.
Here a simple rappresentation of three encapsulated contexts:

[![](https://mermaid.ink/img/pako:eNo9jrEOwjAMRH-lurkLjNmgXZlgIx2sxtAIklSpI4Gq_juGono6vTtZb0afHMPgnmkcqktrY6V3uDYpCr-k2nUrOW5k_yfNRmKHGoFzIO_01fztLWTgwBZGo6P8sLBx0R0VSed37GEkF65RRkfCrSc1CDA3ek5K2XlJ-bS6_RSXDyneN64)](https://mermaid.live/edit#pako:eNo9jrEOwjAMRH-lurkLjNmgXZlgIx2sxtAIklSpI4Gq_juGono6vTtZb0afHMPgnmkcqktrY6V3uDYpCr-k2nUrOW5k_yfNRmKHGoFzIO_01fztLWTgwBZGo6P8sLBx0R0VSed37GEkF65RRkfCrSc1CDA3ek5K2XlJ-bS6_RSXDyneN64)

What does it mean?
It may seem a trivial concept, but it is very powerful:

- Each context can have its own state.
- Each context can't access the state of other contexts.
- It is possible to create a _context_ with the same code, but with different states.

### Encapsulation and Inheritance

The encapsulation concept can be pushed to the extreme adding the [inheritance](https://en.wikipedia.org/wiki/Inheritance_(object-oriented_programming) behaviour.
In this case, the encapsulation is not only a mechanism to isolate the contexts,
but also a mechanism to create a new context from the others.

Here a descriptive image:

[![](https://mermaid.ink/img/pako:eNpFjz0PgkAMhv8K6QyDjjeY8LE66aB4DA1XhejdkbMkGsJ_t4hCp75Pn6HvALU3BApuAbsmOhbaRTLpJfeO6cXRpkqSXbrmUzUb2UK2k5Gt-fw3BJflgssfzhfiKojBUrDYGvlgmO4auCFLGpSsBsNdg3ajeNizP7xdDYpDTzH0nUGmokV53IK64uMplEzLPuznSt9m4weQ2kj-)](https://mermaid.live/edit#pako:eNpFjz0PgkAMhv8K6QyDjjeY8LE66aB4DA1XhejdkbMkGsJ_t4hCp75Pn6HvALU3BApuAbsmOhbaRTLpJfeO6cXRpkqSXbrmUzUb2UK2k5Gt-fw3BJflgssfzhfiKojBUrDYGvlgmO4auCFLGpSsBsNdg3ajeNizP7xdDYpDTzH0nUGmokV53IK64uMplEzLPuznSt9m4weQ2kj-)

This new graph is more complex, but it is very powerful because it defines new behaviours:

- Each context may have children contexts.
- Each context could have at most one parent context.
- Each context can access the state of its parent context.

That's being said, we have mentioned all the concepts we need to understand the Fastify encapsulation.
Let's see how it works in Fastify.


## The Plugin System demistified

In one sentence: the Fastify's Plugin System is an encapsulated context builder. No more, no less.  
It is not over yet, but we are getting closer to the point.

The Plugins System has **one pillar**: there is only one root context and all the plugins are children of it.  
I'm used to call the root context the _root application instance_ and every child context as _plugin instance_.  
Since we have a root context, every Fastify application can be represented as a [tree structure](https://en.wikipedia.org/wiki/Tree_(data_structure) where every node is a context.

Let's see some code to understand better:

```js
const fastify = require('fastify')

start()

async function start() {
  const app = fastify({ logger: true })
  await app.listen(8080)
}
```

In the previous code, the `app` variable is the _root application instance_ or the Fastify's root context.

Now, let's try to create a child context. To do it we need to call the [`register`](https://www.fastify.io/docs/latest/Reference/Plugins/) method:

```js
const app = fastify({ logger: true })

app.register(async function plugin (instance, opts) {
  // context 1
})

app.register(async function plugin (instance, opts) {
  // context 2
})
```

By doing this, we are creating two children contexts from the root context.  
Note that the first argument of the `register` method is a function that represents the _plugin instance_.
Its first argument named `instance` is the _context_ itself and give us access to all the [Fastify's server methods](https://www.fastify.io/docs/latest/Reference/Server/).

We can visualize our code structure as follow:

[![](https://mermaid.ink/img/pako:eNo9jrsOwjAMRX8l8twOMGZASunCwAJsTQcrMTSieSh1JVDVfyc8hKero3uts4CJlkDCLWMaxKXVQZRT3SlGFiql0RlkF4M4hIkxGOrreqdUt4-B6cFi0_8WBTfNH297qMBT9uhs-b68Sxp4IE8aZIkW812DDmvp4czx_AwGJOeZKpiTRabWYZHyIK84ToWSdRzz8av7sV5f6oc-cA)](https://mermaid.live/edit#pako:eNo9jrsOwjAMRX8l8twOMGZASunCwAJsTQcrMTSieSh1JVDVfyc8hKero3uts4CJlkDCLWMaxKXVQZRT3SlGFiql0RlkF4M4hIkxGOrreqdUt4-B6cFi0_8WBTfNH297qMBT9uhs-b68Sxp4IE8aZIkW812DDmvp4czx_AwGJOeZKpiTRabWYZHyIK84ToWSdRzz8av7sV5f6oc-cA)

As you can see, the root context is the parent of the two children contexts.
This representation shows the tree structure of the application.  
But, what is the difference between the two children contexts?

### The encapsulated context state

As we said before, each context has its own state.
In Fastify, the state is rappresented by:

- The context's settings and plugins
- The context's decorators
- The context's hooks

This means that every time you create a new context calling the `register` method,
you can pass a new set of options, settings, etc.  
Moreover, the inheritance implementation inherits the parent context's state.
In practice this means that the children contexts inherit the parent's: hooks, decorators and plugins.

```js
const app = fastify({ logger: true })

app.decorate('rootDecorator', 42)

app.register(async function plugin (instance, opts) {
  // context 1
  // ✅ can access rootDecorator
  // ❌ cannot access ctx2
  instance.decorate('ctx1', 42)
})

app.register(async function plugin (instance, opts) {
  // context 2
  // ✅ can access rootDecorator
  // ❌ cannot access ctx1
  instance.decorate('ctx2', 42)
})
```

This was a simple example, but this is the base of the Plugin System.


### Why the Plugin System is so hard to understand?

We have seen that the Plugin System and how it works, but why it is so hard to understand?  
The answer is simple: the Plugin System is a powerful tool, but it is not easy to use.  

The most common mistake is when you create a plugin-hell like the following:

```js
app.register(async function plugin (instance, opts) {
  instance.register(async function plugin (instance, opts) {
    instance.register(function plugin (instance, opts, next) {
      instance.register(function plugin (instance, opts, next) {
        next()
      })
      next()
    })
    instance.register(function plugin (instance, opts, next) {
      next()
    })
    instance.register(function plugin (instance, opts, next) {
      instance.register(function plugin (instance, opts, next) {
        instance.register(function plugin (instance, opts, next) {
          next()
        })
        next()
      })
      next()
    })
  })
})
```

The plugin-hell is not a bad thing, but it makes the code hard to read and understand.
This means that it is less maintainable and you may be forced to add some `global` to solve some issues.

To solve this problem, you can use the [`fastify-overview`](https://github.com/Eomm/fastify-overview) plugin
to visualize the tree structure.

First, we need to install the plugin and configure it:

```js
async function start() {
  const app = fastify({ logger: true })
  await app.register(require('fastify-overview'))
  // ... plugin-hell ...
  await app.ready()
  const appStructure = app.overview({ hideEmpty: true })
  require('fs').writeFileSync('./appStructure.json', JSON.stringify(appStructure, null, 2))
}
```

The code above starts the Fastify application, and exports the tree structure in a JSON file. 
Now, you should have a file named `appStructure.json` in your project's root directory.

This structure file can be used to visualize the tree structure of your application.  
You can use the [`fastify-overview-ui`](https://github.com/nearform/fastify-overview-ui) plugin or the [https://jsoncrack.com](https://jsoncrack.com) website.

Copy the content of the `appStructure.json` file and paste it in the [https://jsoncrack.com](https://jsoncrack.com) website,
you will see the detailed datastructure of your application and you will be able to understand
where each component is store in your codebase.

<iframe src="https://jsoncrack.com/widget?json=%5B%5B%22id%22%2C%22name%22%2C%22children%22%2C%22decorators%22%2C%22a%7C0%7C1%7C2%7C3%22%2C%22n%7C0.2JM9MCEhR%22%2C%22fastify%20-%3E%20fastify-overview%22%2C%22a%7C0%7C1%7C3%22%2C%22n%7C0.HHM8bNij5%22%2C%22plugin%22%2C%22decorate%22%2C%22a%7CA%22%2C%22a%7C1%22%2C%22ctx1%22%2C%22o%7CC%7CD%22%2C%22a%7CE%22%2C%22o%7CB%7CF%22%2C%22o%7C7%7C8%7C9%7CG%22%2C%22n%7C0.8lUbww5Wj%22%2C%22ctx2%22%2C%22o%7CC%7CJ%22%2C%22a%7CK%22%2C%22o%7CB%7CL%22%2C%22o%7C7%7CI%7C9%7CM%22%2C%22a%7C0%7C1%7C2%22%2C%22n%7C0.MW5QvoaRy%22%2C%22n%7C0.3E9ftYeINU%22%2C%22n%7C0.UOyFYLyvR%22%2C%22a%7C0%7C1%22%2C%22n%7C0.P5x0PRhZi%22%2C%22o%7CS%7CT%7C9%22%2C%22a%7CU%22%2C%22o%7CO%7CR%7C9%7CV%22%2C%22n%7C0.Qyx1wQNZv%22%2C%22o%7CS%7CX%7C9%22%2C%22n%7C0.LTPmSdvEa%22%2C%22n%7C0.%3Agl3qnHkfx%22%2C%22n%7C0.%3A3WFxiQX2xX%22%2C%22o%7CS%7Cb%7C9%22%2C%22a%7Cc%22%2C%22o%7CO%7Ca%7C9%7Cd%22%2C%22a%7Ce%22%2C%22o%7CO%7CZ%7C9%7Cf%22%2C%22a%7CW%7CY%7Cg%22%2C%22o%7CO%7CQ%7C9%7Ch%22%2C%22a%7Ci%22%2C%22o%7CO%7CP%7C9%7Cj%22%2C%22a%7CH%7CN%7Ck%22%2C%22rootDecorator%22%2C%22o%7CC%7Cm%22%2C%22a%7Cn%22%2C%22o%7CB%7Co%22%2C%22o%7C4%7C5%7C6%7Cl%7Cp%22%5D%2C%22q%22%5D" width="512" height="384" style="border: 2px solid #b9bbbe; border-radius: 6px;"></iframe>

Thanks to the plugin, you will be able to see in the runtime application graph:

- 🛣 ALL the Fastify routes
- 🍱 ALL the Fastify plugins
- 🎨 ALL the Fastify decorators
- 🪝 ALL the Fastify hooks

For example, you will see any additional settings that a third-party plugin adds to your Fastify instance
that you may not be aware of.

### Summary

You have read how Fastify implements the encapsulation through the Plugin System and its powerful features.
Morover, you have seen how to use the `fastify-overview` plugin to visualize the tree structure of your application
to be able to debug and explore it in an easier way.

If you want to learn more about the Plugin System, you can pre-order the [Fastify Book](https://www.packtpub.com/product/accelerating-server-side-development-with-fastify/9781800563582) that will deep dive into this topic and a lot more!

If you enjoyed this article comment, share and follow me on [twitter @ManuEomm](https://twitter.com/ManuEomm)!
