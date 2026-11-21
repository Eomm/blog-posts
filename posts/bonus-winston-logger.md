# How to use winston as the Fastify logger

## And why it is not a drop-in replacement for pino

Fastify ships with [`pino`](https://github.com/pinojs/pino) as its logger, and most of the time you never think about it: set `logger: true` and you get JSON lines with a request id, the URL, the status code and the response time.

But what if your company already standardized on [`winston`](https://github.com/winstonjs/winston)?
Maybe you have custom transports, a shared logging library, or a dashboard that expects winston's output shape. Throwing all of that away just to adopt a new framework is a hard sell.

The good news is that Fastify accepts any logger you give it.
The less good news is that "accepts" and "works like pino" are two very different things 😅

So, would you like to see what really happens when you swap pino for winston? Let's find out together, and let's fix every issue along the way, without touching your existing winston code.

## The minimal setup

Fastify v5 has two options for the logger:

- `logger`: a pino configuration object, or `true`
- `loggerInstance`: an already built logger instance, like a winston one

If you pass a winston instance to `logger`, Fastify throws an error at startup, so `loggerInstance` is the one we need.

Before passing it, there is one requirement to satisfy. Fastify [checks that the instance](https://fastify.dev/docs/latest/Reference/Logging/#using-custom-loggers) has these methods: `info`, `error`, `debug`, `fatal`, `warn`, `trace` and `child`.
Winston's default levels are the npm ones (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`), so `fatal` and `trace` are missing and Fastify refuses to start with a `FST_ERR_LOG_INVALID_LOGGER` error.

We must define the levels ourselves:

```js
import Fastify from "fastify";
import winston from "winston";

const loggerInstance = winston.createLogger({
  // Fastify requires the fatal and trace levels, winston does not have them by default
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    trace: 5,
  },
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

const app = Fastify({ loggerInstance });

app.get("/hello", (request, reply) => {
  request.log.info("Sending hello", { user: "manuel" });
  return { greet: "hello" };
});

app.get("/boom", () => {
  throw new Error("kaboom");
});

await app.listen({ port: 3000 });
```

Pay attention to the numbers: in winston, a **lower** number means **more severe**. Pino does the opposite, `trace` is `10` and `fatal` is `60`.
So `trace` must get the highest number, otherwise setting `level: 'debug'` would hide all your debug lines and print the trace ones.

Note that `request.log` is a winston child logger now, so in our handler we call it the winston way: message first, metadata second.

The server starts, and the logs are in JSON. Done? Not really. Let's run a single request and look at the output.

## What goes wrong

Here is what pino prints for one `curl http://localhost:3000/hello` (lines shortened for readability, and with the pino style call `request.log.info({ user: "manuel" }, "Sending hello")` in the handler):

```json
{"level":30,"reqId":"req-1","req":{"method":"GET","url":"/hello","host":"localhost:3000","remoteAddress":"::1","remotePort":53122},"msg":"incoming request"}
{"level":30,"reqId":"req-1","user":"manuel","msg":"Sending hello"}
{"level":30,"reqId":"req-1","res":{"statusCode":200},"responseTime":12.57,"msg":"request completed"}
```

And here is the winston setup above, for the same request (the first and last lines are truncated, keep reading to know why):

```json
{"level":"info","message":{"req":{"id":"req-1","log":{},"params":{},"query":{},"raw":{"_consuming":false,"_dumped":false,"_events":{},"_readableState":{...
{"level":"info","message":"Sending hello","reqId":"req-1","user":"manuel"}
{"level":"info","message":{"res":{"log":{},"raw":{"_closed":false,"_contentLength":17,"_defaultKeepAlive":true,...
```

Our own line is perfect, but the two lines that Fastify writes for us are a mess.
Wow, what happened here? There are four different problems hidden in these lines.

### 1. The arguments order is reversed

This is the key difference between the two loggers.
Pino's signature is `log.info(mergingObject, message)`, while winston's signature is `log.info(message, meta)`.

Fastify is built around pino, so every log line it writes for you uses the pino order.
These lines live in the `LogController` class, the layer that writes the automatic request logs, and its default implementation looks like this:

```js
request.log.info({ req: request }, "incoming request");
reply.log.info(
  { res: reply, responseTime: reply.elapsedTime },
  "request completed",
);
```

You can extend this class and override each method to change the level, the payload or even drop a line. I wrote all about it in [_"Your health check is writing a million log lines a month"_](https://backend.cafe/million-log-lines-a-month), so keep it in mind, we will need it later.

Winston receives an object as the message and a string as extra metadata, so it stores the object in the `message` field and drops the string.
The result is that the `incoming request` and `request completed` messages are **gone**.

### 2. The serializers are not applied

Have you noticed how small pino's `req` field is? That is because Fastify registers pino [serializers](https://fastify.dev/docs/latest/Reference/Logging/#log-serializers) for the `req`, `res` and `err` keys, which pick just a few useful fields.

Fastify adds them by calling `logger.child({}, { serializers })`. Winston's `child()` accepts only the first argument, the default metadata, so the serializers are silently ignored.
Winston then serializes the **whole** Fastify `Request` and `Reply` objects, including the raw Node.js socket.

I measured it on my machine (macOS, Node.js v24, Fastify v5, winston v3.19.0), with one `curl` request and the server startup lines excluded:

| Setup                 | Lines | Bytes  |
| --------------------- | ----- | ------ |
| pino (`logger: true`) | 3     | 529    |
| winston, naive setup  | 3     | 14.985 |

That is about **28 times more bytes** for the same request. If your log management platform bills you by volume, you will notice it at the end of the month 💸

### 3. The errors are empty

When the `/boom` route throws, Fastify logs `{ req, res, err }`. Without the `err` serializer, winston's JSON format turns the `Error` instance into `{}`, because the `message` and `stack` properties of an error are not enumerable.

So the error line contains thousands of characters about the socket and nothing about the error itself. Not great when you are debugging a production issue at 3 AM 😱

### 4. The route `logLevel` option is ignored

Fastify lets you set a log level per route or per plugin:

```js
app.get("/quiet", { logLevel: "warn" }, handler);
```

Under the hood, it calls `logger.child(bindings, { level: 'warn' })` to create the `request.log` instance. Again, winston ignores the second argument, so the route logs at the root level.

The only thing that works out of the box is the `reqId` binding, because it is passed as the first argument of `child()`. Lucky us!

## Making Fastify speak winston

That sounds like a lot of issues, but don't worry, we can fix all of them with two small pieces of code:

1. a custom `LogController` that writes Fastify's log lines with the winston signature and with small `req`, `res` and `err` objects
2. a Fastify `childLoggerFactory` that applies the route log level

We could go the other way around and teach winston to understand pino calls, but think about who is reading this article: you already have winston code, formats and dashboards. The fix should adapt Fastify to your logger, not your logger to Fastify.

> **Note**
> The `logController` option is available since **Fastify v5.10.0**.

### A winston LogController

The `LogController` has one method for each kind of line Fastify writes, so we extend it and rewrite the lines in winston's language:

```js
import { LogController } from "fastify";

// The same fields that the Fastify built-in serializers log
const serializeReq = (request) => ({
  method: request.method,
  url: request.url,
  host: request.host,
  remoteAddress: request.ip,
});
const serializeRes = (reply) => ({ statusCode: reply.statusCode });
const serializeErr = (error) => ({
  type: error?.constructor.name,
  message: error?.message,
  stack: error?.stack,
});

export class WinstonLogController extends LogController {
  incomingRequest(request, reply) {
    if (this.isLogDisabled(request)) {
      return;
    }

    request.log.info("incoming request", { req: serializeReq(request) });
  }

  requestCompleted(error, request, reply) {
    if (this.isLogDisabled(request)) {
      return;
    }

    const meta = { res: serializeRes(reply), responseTime: reply.elapsedTime };
    if (error) {
      reply.log.error("request errored", { ...meta, err: serializeErr(error) });
    } else {
      reply.log.info("request completed", meta);
    }
  }

  defaultErrorLog(error, request, reply) {
    if (this.isLogDisabled(request)) {
      return;
    }

    if (reply.statusCode >= 500) {
      reply.log.error(error?.message, {
        req: serializeReq(request),
        res: serializeRes(reply),
        err: serializeErr(error),
      });
    } else {
      reply.log.info(error?.message, {
        res: serializeRes(reply),
        err: serializeErr(error),
      });
    }
  }
}
```

Let's break down what's happening:

1. Every method calls `this.isLogDisabled(request)` first. When you override a method you replace the default gate too, so we keep it to respect the `disableRequestLogging` option
2. The message is the first argument and the metadata is the second one, so winston stores them where they belong
3. We serialize `req`, `res` and `err` ourselves, picking the same fields that Fastify's pino serializers log. No more sockets in your logs, and the error finally has its `message` and `stack`

The method names and the default lines are the same as Fastify's, so the output keeps the same meaning: `incoming request`, `request completed` and the error message.

The controller has a few more methods for rarer lines, such as stream errors or a failing response serializer. They follow the same pattern, and you can find all of them in the companion project.

Your own code doesn't change at all: it keeps calling `request.log.info("Sending hello", { user: "manuel" })`, and your formats and transports keep working as before.

### A child logger factory

Fastify has a [`childLoggerFactory`](https://fastify.dev/docs/latest/Reference/Server/#childloggerfactory) option: a function that Fastify calls every time it needs to create the `request.log` instance.
It receives the parent logger, the bindings (`{ reqId }`) and the child options, which contain the `level` when a route defines a `logLevel`.

```js
const LEVEL = Symbol.for("level");

export function childLoggerFactory(logger, bindings, opts) {
  const child = logger.child(bindings);
  if (!opts.level) {
    return child;
  }

  // Apply the route `logLevel` option, winston's child() ignores it
  const maxLevel = levels[opts.level];
  return Object.create(child, {
    write: {
      value(info) {
        if (levels[info[LEVEL]] <= maxLevel) {
          child.write(info);
        }
      },
    },
  });
}
```

Winston's `child()` itself works by creating a new object on top of the parent with a custom `write` method, so we use the same trick: we wrap the child and drop every line that is less severe than the route level. The `levels` object is the same one we passed to `winston.createLogger()`, and `Symbol.for("level")` is the key where winston stores the level name of each line.

Note that the root `level` still applies, because winston's transports filter the lines too. So with this implementation a route can only be **quieter** than the root logger, not more verbose. For example, a `debug` route under an `info` root logger still prints only `info` and above.

### Putting it all together

Now the application looks like this:

```js
import Fastify from "fastify";
import winston from "winston";
import {
  createWinstonLogger,
  WinstonLogController,
  childLoggerFactory,
} from "./winston-fastify.mjs";

const loggerInstance = createWinstonLogger({
  level: "info",
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

const app = Fastify({
  loggerInstance,
  logController: new WinstonLogController(),
  childLoggerFactory,
});

app.get("/hello", (request, reply) => {
  request.log.info("Sending hello", { user: "manuel" });
  return { greet: "hello" };
});

app.get("/quiet", { logLevel: "warn" }, (request, reply) => {
  request.log.info("You will not see this line");
  return { greet: "shhh" };
});

app.get("/boom", () => {
  throw new Error("kaboom");
});

await app.listen({ port: 3000 });
```

The `createWinstonLogger()` function is a plain `winston.createLogger()` call with our `levels` and the `timestamp()` and `json()` formats, nothing Fastify specific.
Here we are also using one of winston's best features: transports. Every line goes to the console, and the `error` lines go to the `error.log` file as well.

Let's call `/hello` again:

```json
{"level":"info","message":"incoming request","req":{"host":"localhost:3000","method":"GET","remoteAddress":"::1","url":"/hello"},"reqId":"req-1","timestamp":"2026-11-21T09:30:17.000Z"}
{"level":"info","message":"Sending hello","reqId":"req-1","timestamp":"2026-11-21T09:30:17.001Z","user":"manuel"}
{"level":"info","message":"request completed","reqId":"req-1","res":{"statusCode":200},"responseTime":2.64,"timestamp":"2026-11-21T09:30:17.003Z"}
```

Cool! The messages are back, the `req` and `res` fields are small, and the same request now writes 459 bytes. Calling `/quiet` prints nothing at all, because even Fastify's own `info` lines respect the route level.

And the `/boom` error is finally useful (stack trace shortened):

```json
{
  "err": {
    "message": "kaboom",
    "stack": "Error: kaboom\n    at Object.<anonymous> (file:///.../02-winston.mjs:30:9)...",
    "type": "Error"
  },
  "level": "error",
  "message": "kaboom",
  "req": {
    "host": "localhost:3000",
    "method": "GET",
    "remoteAddress": "::1",
    "url": "/boom"
  },
  "reqId": "req-2",
  "res": { "statusCode": 500 },
  "timestamp": "2026-11-21T09:30:17.542Z"
}
```

The companion project includes a few `node:test` tests that check all of these behaviours with `app.inject()`, so you can change the controller and see what breaks.

## Pino vs winston in Fastify

Let's recap the key differences you have to keep in mind:

|                                         | pino                                | winston                                   |
| --------------------------------------- | ----------------------------------- | ----------------------------------------- |
| Fastify option                          | `logger`                            | `loggerInstance`                          |
| Call signature                          | `log.info(obj, 'msg')`              | `log.info('msg', meta)`                   |
| Fastify's automatic log lines           | work out of the box                 | need a custom `LogController`             |
| Level numbers                           | higher is more severe (`fatal: 60`) | lower is more severe (`fatal: 0`)         |
| `fatal` and `trace` levels              | built in                            | must be defined                           |
| Fastify `req`, `res`, `err` serializers | applied                             | ignored, serialize in the `LogController` |
| Route `logLevel`                        | works                               | ignored, needs a `childLoggerFactory`     |
| Message key                             | `msg`                               | `message`                                 |
| Level format                            | number (`30`)                       | string (`"info"`)                         |

The last two rows matter if you have dashboards or alerts built on top of your current logs: the output shape changes, so check your queries before switching.

One more thing: even with `loggerInstance`, Fastify still loads pino internally. Winston replaces the logger you call, not the dependency.

So, should you use winston with Fastify? It depends 😄
If you are starting a new project, stick with pino: it is the default, Fastify's logging features are designed around it, and you get all of them for free.
If you have a good reason to keep winston, such as an existing transport or a company wide logging library, it works fine once you add the controller and the factory we built.

## Summary

Plugging winston into Fastify takes one line, but making it behave correctly takes a bit more care:

- use the `loggerInstance` option and define the `fatal` and `trace` levels, with `trace` as the highest number
- remember that Fastify writes its own log lines with the pino signature, `(obj, msg)`, while winston expects `(msg, meta)`
- extend the `LogController` to rewrite those lines the winston way, with small `req`, `res` and `err` objects, otherwise your logs explode in size and your errors are empty
- use `childLoggerFactory` if you rely on the route `logLevel` option

Your winston code, formats and transports stay exactly as they are.

All the runnable examples live in the [`bonus/winston-logger`](https://github.com/Eomm/blog-posts/tree/HEAD/bonus/winston-logger) directory of this repository.

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
