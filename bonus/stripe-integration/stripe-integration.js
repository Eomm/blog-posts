'use strict'

const stripe = require('stripe')

module.exports = async function plugin (app, opts) {
  const stripeClient = stripe(app.config.STRIPE_PRIVATE_KEY)

  app.register(require('@fastify/formbody'))

  app.post('/create-checkout-session', async (request, reply) => {
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          // Provide the exact Price ID
          price: 'price_1LRC97CHE57DZYK7ay4z2eGw',
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${app.config.BASE_URL}/success?id=${Math.random()}`,
      cancel_url: `${app.config.BASE_URL}/cancel?id=${Math.random()}`
    })

    return reply.redirect(303, session.url)
  })

  app.get('/success', async (request, reply) => {
    request.log.info('success callback from id %s', request.query.id)
    return reply.sendFile('success.html')
  })

  app.get('/cancel', async (request, reply) => {
    request.log.info('cancel callback from id %s', request.query.id)
    return reply.sendFile('cancel.html')
  })
}
