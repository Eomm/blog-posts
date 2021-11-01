---
title: Fastify Multipart File Management
series: Fastify Bonus
---

# Fastify Multipart File Management

How to work with files with Fastify?
It is so easy thanks to the [`fastify-multipart`](https://github.com/fastify/fastify-multipart) plugin!

There is one concept to keep in mind: someone must consume the uploaded file.
The consumer could be:

- your implementation
- the plugin itself calling `toBuffer()` method

## Part object

The multipart content type may contain file or simple form-data.
In `fastify-multipart` there are two types of "part" ether.

The file object has these fields:
  - `data.file` // a stream object
  - `data.fieldname`
  - `data.filename`
  - `data.encoding`
  - `data.mimetype`
  - `data.toBuffer()` // a promise that return a Buffer with the stream content


The string type has just:
  - `data.value` // returns the string content
  - `data.toBuffer()` // a promise that return a Buffer with the value content

## Single file

This implementation works for small and HUGE file:

```js
const fs = require('fs')
const pump = require('pump')
const Fastify = require('fastify')
const fastifyMultipart = require('fastify-multipart')

const fastify = Fastify({ logger: true })

fastify.register(fastifyMultipart)

fastify.post('/', async function (req, reply) {
  // return the first file submitted, regardless the field name
  const data = await req.file()

  // we must consume the file
  // we use pump to manage correctly the streams and wait till the end of the pipe
  const storedFile = fs.createWriteStream('./img-uploaded.png')
  await pump(data.file, storedFile)

  return { upload: 'completed' }
})
```

## Multiple files

When your server receives multiple files you need to ask all the files in the request and process them (sequentially in this example):

```js
fastify.post('/multiple', async function (req, reply) {
  // get all the files in the request payload
  // `const files` is an async generator
  const files = await req.files()

  for await (const part of files) { // iterate the async generator
    req.log.info('storing %s', part.filename)
    const storedFile = fs.createWriteStream(`./${part.filename}`)
    await pump(part.file, storedFile)
  }

  return { upload: 'completed' }
})
```

## Small files

An easier way to access the files, if they are small, is to attach them to the body and call `toBuffer()`. This will cause all the files to be loaded in memory, so you must be sure the files will not be HUGE; otherwise, an out-of-memory could happen.

```js
const fastify = Fastify({ logger: true })
fastify.register(fastifyMultipart, { attachFieldsToBody: true })

fastify.post('/body', async function (req, reply) {
  // The `fooFile` and `barFile` are the field name of the uploaded file
 return {
    upload: {
      astring: req.body.aField.value,
      foo: await req.body.fooFile.toBuffer(),
      bar: await req.body.barFile.toBuffer()
    }
  }
})
```


## End

Now, I hope I have been teaching you about multipart with Fastify!
For more Fastify content, follow me on [Twitter](https://twitter.com/ManuEomm)!

Write comments here below or open an issue on GitHub for any questions or feedback!
Thank you for reading!
