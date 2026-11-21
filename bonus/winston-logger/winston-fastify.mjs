import winston from 'winston'
import { LogController } from 'fastify'

const LEVEL = Symbol.for('level')

// Fastify requires the fatal and trace levels, winston does not have them by default
export const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5
}

export function createWinstonLogger (opts = {}) {
  return winston.createLogger({
    levels,
    level: opts.level ?? 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: opts.transports ?? [new winston.transports.Console()]
  })
}

// The same fields that the Fastify built-in serializers log
const serializeReq = (request) => ({
  method: request.method,
  url: request.url,
  host: request.host,
  remoteAddress: request.ip
})
const serializeRes = (reply) => ({ statusCode: reply.statusCode })
const serializeErr = (error) => ({
  type: error?.constructor.name,
  message: error?.message,
  stack: error?.stack
})

// Rewrites the log lines Fastify writes for you with the winston signature
export class WinstonLogController extends LogController {
  incomingRequest (request, reply) {
    if (this.isLogDisabled(request)) { return }

    request.log.info('incoming request', { req: serializeReq(request) })
  }

  requestCompleted (error, request, reply) {
    if (this.isLogDisabled(request)) { return }

    const meta = { res: serializeRes(reply), responseTime: reply.elapsedTime }
    if (error) {
      reply.log.error('request errored', { ...meta, err: serializeErr(error) })
    } else {
      reply.log.info('request completed', meta)
    }
  }

  defaultErrorLog (error, request, reply) {
    if (this.isLogDisabled(request)) { return }

    if (reply.statusCode >= 500) {
      reply.log.error(error?.message, {
        req: serializeReq(request),
        res: serializeRes(reply),
        err: serializeErr(error)
      })
    } else {
      reply.log.info(error?.message, { res: serializeRes(reply), err: serializeErr(error) })
    }
  }

  streamError (error, request, reply) {
    if (this.isLogDisabled(request)) { return }

    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
      reply.log.info('stream closed prematurely', { res: serializeRes(reply) })
    } else {
      reply.log.warn('response terminated with an error with headers already sent', { err: serializeErr(error) })
    }
  }

  writeHeadError (error, request, reply) {
    if (this.isLogDisabled(request)) { return }

    reply.log.warn(error?.message, {
      req: serializeReq(request),
      res: serializeRes(reply),
      err: serializeErr(error)
    })
  }

  serializerError (error, request, reply, metadata) {
    if (this.isLogDisabled(request)) { return }

    reply.log.error('The serializer for the given status code failed', {
      err: serializeErr(error),
      statusCode: metadata.statusCode
    })
  }

  serviceUnavailable (logger) {
    logger.info('request aborted - refusing to accept new requests as server is closing', {
      res: { statusCode: 503 }
    })
  }
}

// Fastify calls this function to create the `request.log` child logger
export function childLoggerFactory (logger, bindings, opts) {
  const child = logger.child(bindings)
  if (!opts.level) {
    return child
  }

  // Apply the route `logLevel` option, winston's child() ignores it
  const maxLevel = levels[opts.level]
  return Object.create(child, {
    write: {
      value (info) {
        if (levels[info[LEVEL]] <= maxLevel) {
          child.write(info)
        }
      }
    }
  })
}
