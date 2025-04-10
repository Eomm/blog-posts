import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.decorateRequest('logicStepValue', null)
app.decorateRequest('logicStep', {
  getter () {
    this.logicStepValue ??= [];
    return this.logicStepValue;;
  },
})

app.get('/', async function longHandler (req, reply) {
  const debugBusiness = req.logicStep;

  // do some business logic
  debugBusiness.push('called external service 1');

  // do some business logic
  debugBusiness.push('processed external service 2');

  // call another handler but..
  throw new Error('Something went wrong 😱');
});

app.setErrorHandler(function (err, request, reply) {
  const debugBusiness = request.logicStep;

  this.log.error({ err, debugBusiness }, 'An error occurred');
  reply.status(500).send('Internal Server Error');
})

// app.inject('/')
app.listen({ port: 3000 });