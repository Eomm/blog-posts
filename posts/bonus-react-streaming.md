# React Server-Side Streaming with Fastify

## How to stream React components to the browser using Fastify and reply.hijack()

React 18 introduced `renderToPipeableStream`, a powerful API for streaming server-rendered HTML to the browser.
Instead of waiting for the entire page to render before sending it to the client, you can start sending HTML as soon as it's ready.

In this article, we'll build a minimal Fastify server that streams a React component to the browser using Node.js streams.
No build tools, no TypeScript — just a simple setup you can run in seconds.

## Setting up the project

We'll use Node.js 20+ and Fastify v5 for this tutorial. Since we're using `React.createElement` directly, we don't need JSX or any build step.

```bash
mkdir fastify-react-streaming
cd fastify-react-streaming

npm init es6 --yes

npm install fastify@5 react@19 react-dom@19
```

## How does reply.hijack() work?

By default, Fastify manages the response lifecycle for you: it serializes your return value, sets headers, and sends the response.
But sometimes you need full control over the raw Node.js `http.ServerResponse`, for example when you want to pipe a stream directly to the client.

That's what [`reply.hijack()`](https://fastify.dev/docs/latest/Reference/Reply/#hijack) does.
When you call it, Fastify steps aside and hands you the raw response object via `reply.raw`.

From that point on, **you** are responsible for writing headers, sending data, and ending the response.

This is exactly what we need for React streaming: `renderToPipeableStream` expects a writable Node.js stream to pipe into, and `reply.raw` is just that.

## Streaming a React component

Create a file named `app.js`:

```js
import Fastify from 'fastify'
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'

const app = Fastify({ logger: true })

app.get('/', async (req, reply) => {
  reply.hijack()

  const stream = renderToPipeableStream(
    React.createElement('div', null, 'Hello from React streaming!'),
    {
      onShellReady () {
        reply.raw.setHeader('Content-Type', 'text/html; charset=utf-8')
        stream.pipe(reply.raw)
      },
      onError (err) {
        reply.raw.statusCode = 500
        console.error(err)
      }
    }
  )
})

await app.listen({ port: 3000 })
```

Let's break down what's happening:

1. **`reply.hijack()`** tells Fastify we'll manage the response ourselves. Without this, Fastify would try to send its own response and conflict with our stream.

2. **`renderToPipeableStream`** takes a React element and returns a stream object. We use `React.createElement` directly instead of JSX, so no build step is needed.

3. **`onShellReady`** fires when the initial HTML shell is ready to be sent. At this point, we set the `Content-Type` header and pipe the stream into `reply.raw` — the underlying Node.js response.

4. **`onError`** handles any rendering errors by setting a 500 status code.

Start the server:

```bash
node app.js
```

Open `http://localhost:3000` in your browser and you'll see the streamed HTML response.

## Why streaming matters

For this simple example, the difference between streaming and a regular `renderToString` call is negligible.
But streaming becomes important when your React tree includes:

- **`<Suspense>` boundaries** with async data fetching: the shell is sent immediately while suspended parts stream in later.
- **Large component trees**: the browser can start parsing and displaying HTML before the server finishes rendering everything.

The `onShellReady` callback is the key: it fires as soon as the content above any `<Suspense>` boundary is ready, letting the browser start rendering right away.

## Summary

With just a few lines of code, we've set up React server-side streaming in Fastify using `reply.hijack()` and `renderToPipeableStream`.
No bundlers, no JSX compilation! Just Node.js, React, and Fastify working together.

The source code for this project is available on [GitHub](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/react-streaming/).

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
