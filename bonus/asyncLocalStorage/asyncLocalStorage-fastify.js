import Fastify from 'fastify';
import fastifyRequestContext from '@fastify/request-context';

const app = Fastify({ logger: true });

app.register(fastifyRequestContext, {
  defaultStoreValues () {
    return {
      logicStep: [],
    }
  }
});

app.get('/', async function longHandler (req, reply) {
  const debugBusiness = req.requestContext.get('logicStep');

  // do some business logic
  debugBusiness.push('called external service 1');

  // do some business logic
  debugBusiness.push('processed external service 2');

  // call another handler but..
  throw new Error('Something went wrong 😱');
});

app.setErrorHandler(function (err, request, reply) {
  const debugBusiness = request.requestContext.get('logicStep');

  this.log.error({ err, debugBusiness }, 'An error occurred');
  reply.status(500).send('Internal Server Error');
})

app.inject('/')
// app.listen({ port: 3000 });


// ┌─────────┬──────┬───────┬───────┬────────┬──────────┬──────────┬────────┐
// │ Stat    │ 2.5% │ 50%   │ 97.5% │ 99%    │ Avg      │ Stdev    │ Max    │
// ├─────────┼──────┼───────┼───────┼────────┼──────────┼──────────┼────────┤
// │ Latency │ 9 ms │ 21 ms │ 85 ms │ 176 ms │ 27.09 ms │ 48.33 ms │ 938 ms │
// └─────────┴──────┴───────┴───────┴────────┴──────────┴──────────┴────────┘
// ┌───────────┬─────┬──────┬────────┬─────────┬─────────┬──────────┬───────┐
// │ Stat      │ 1%  │ 2.5% │ 50%    │ 97.5%   │ Avg     │ Stdev    │ Min   │
// ├───────────┼─────┼──────┼────────┼─────────┼─────────┼──────────┼───────┤
// │ Req/Sec   │ 0   │ 0    │ 11,695 │ 17,167  │ 9,893.8 │ 5,565.41 │ 478   │
// ├───────────┼─────┼──────┼────────┼─────────┼─────────┼──────────┼───────┤
// │ Bytes/Sec │ 0 B │ 0 B  │ 2.4 MB │ 3.52 MB │ 2.03 MB │ 1.14 MB  │ 98 kB │
// └───────────┴─────┴──────┴────────┴─────────┴─────────┴──────────┴───────┘

// Req/Bytes counts sampled once per second.
// # of samples: 80

// 0 2xx responses, 791450 non 2xx responses
// 900k requests in 80.11s, 162 MB read
// 36k errors (0 timeouts)