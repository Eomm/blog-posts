// A naive session login: it works, but it is full of security holes.
// DO NOT USE IT IN PRODUCTION: app.mjs is the secure version.
import fastifySession from '@fastify/session'
import fastifyCookie from '@fastify/cookie'
import fastifyFormbody from '@fastify/formbody'

function loginPage () {
  return '<html>' +
    '<head><title>Login</title></head>' +
    '<body>' +
    '<h1>Login</h1>' +
    '<form action="http://localhost:3000/login" method="post">' +
    '<h2>Email</h2>' +
    '<input type="email" name="email">' +
    '<h2>Password</h2>' +
    '<input type="password" name="password">' +
    '<br><br><button type="submit">Login</button>' +
    '</form>' +
    '</body>' +
    '</html>'
}

function defaultPage (isAuthenticated) {
  if (isAuthenticated) {
    return 'logged in<br><br><a href="/logout">Logout</a>'
  } else {
    return 'please login<br><br><a href="/login">Login</a>'
  }
}

export default async function naiveApp (app) {
  app.register(fastifyFormbody)
  app.register(fastifyCookie)
  app.register(fastifySession, {
    cookieName: 'sessionId',
    secret: 'a secret with minimum length of 32 characters',
    cookie: { maxAge: 1800000, secure: false }
  })

  app.get('/login', (request, reply) => {
    reply.type('text/html')
    reply.send(loginPage())
  })

  app.post('/login', (request, reply) => {
    const { password } = request.body

    if (password === 'abcdef') {
      request.session.authenticated = true
      reply.type('text/html')
      reply.send(defaultPage(true))
    } else {
      reply.redirect('/login', 401)
    }
  })

  app.get('/', (request, reply) => {
    reply.type('text/html')
    reply.send(defaultPage(request.session.authenticated))
  })

  app.get('/logout', (request, reply) => {
    if (request.session.authenticated) {
      request.session.destroy((err) => {
        if (err) {
          reply.status(500)
          reply.send('Internal Server Error')
        } else {
          reply.redirect('/')
        }
      })
    } else {
      reply.redirect('/')
    }
  })
}
