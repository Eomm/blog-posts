'use strict'

// node low-level-client.js --headerRate 1000 \
//   --payloadRate 1000

const net = require('node:net')
const { parseArgs } = require('node:util')
const setTimeout = require('node:timers/promises').setTimeout

const SERVER_HOST = 'localhost' // Change to the server address
const SERVER_PORT = 8080 // Change to the server port

const { values } = parseArgs({
  options: {
    headerRate: { type: 'string', default: '100' },
    payloadRate: { type: 'string', default: '100' },
    keepAlive: { type: 'boolean', default: false }
  }
})

const timing = {
  oneHeaderEvery: parseInt(values.headerRate, 10),
  onePayloadByteEvery: parseInt(values.payloadRate, 10)
}

const payload = JSON.stringify({
  message: 'Hello, this is a slow request!',
  timestamp: new Date().toISOString()
})

const headers = [
  'Host: localhost',
  'User-Agent: Slow-Client',
  'Accept: application/json',
  'Content-Type: application/json',
  `Content-Length: ${Buffer.byteLength(payload)}`,
  'Connection: keep-alive'
]

let start
const socket = net.createConnection(SERVER_PORT, SERVER_HOST, async () => {
  start = Date.now()
  console.log('Connected to server')

  // Send the first request line as the protocol requires
  socket.write('POST / HTTP/1.1\r\n')

  // Function to send headers one by one with delay
  for (const header of headers) {
    socket.write(header + '\r\n')
    console.log(`Sent Header: ${header}`)
    await setTimeout(timing.oneHeaderEvery)
  }

  // End headers with an empty line to indicate request completion
  socket.write('\r\n')
  console.log('Finished sending headers. Now sending body...')

  for (let i = 0; i < payload.length; i++) {
    socket.write(payload[i])
    process.stdout.write(payload[i])

    if (i === payload.length - 1) {
      console.log('\n')
    }
    await setTimeout(timing.onePayloadByteEvery)
  }
  console.log('Finished sending request body.')
})

socket.on('data', (data) => {
  console.log('Received response:', data.toString())
  if (!values.keepAlive) {
    socket.end()
  } else {
    console.log('Keeping connection alive...')
  }
})

socket.on('end', () => {
  console.log('Disconnected from server after', Date.now() - start, 'ms')
  process.exit(0)
})

socket.on('error', (err) => {
  console.error('Socket error:', err.message)
})
