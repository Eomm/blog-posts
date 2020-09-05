# Improve the project

This tutorial is the following of the "[A Discord app with Fastify!](https://dev.to/eomm/a-discord-app-with-fastify-3h8c)".

## Road to ES Import

Node.js used CommonJS module system (CJS) since the beginning and recently it has added support to ECMAScript Modules (ESM)
([without the `--experimental-modules` flag](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V12.md#ecmascript-modules-----experimental-modules-flag-removal)).

So to update this project to ESM module there are many possibilities, described in [this article](https://medium.com/@nodejs/announcing-core-node-js-support-for-ecmascript-modules-c5d6dc29b663) by Node.js Module Team.

I will follow the one that makes sense to me to a project written in CJS as first implementation.

- add `"type": "module"` in the `package.json`: this will force Node.js to load every `.js` file as `.mjs`
- fix the `__dirname` usage since it is not supported in ESM
- remove all the `require` in favour of `import`

Note that it is mandatory add the file extension to local files:

```js
import authRoutes from './auth.js'
```

- remove `'use strict'` since it is the default behaviour with ESM
- update the `module.exports` to `export default function app (fastify, opts, next) {..`
- fix the start script since `fastify-cli` doesn't support the ESM loading right now

## CI/CD

Adding CI/CD to the project is quite simple thanks to [GitHub Actions](https://github.com/features/actions).

### Continuous Integration

We want to run the tests automatically whenever there is a Pull Request, so the actions to take are:

```yml
#...
    steps:
      # checkout the project
      - uses: actions/checkout@v2

      # install nodejs on the Virtual Machine
      - name: Use Node.js
        uses: actions/setup-node@v1
        with:
          node-version: ${{ matrix.node-version }}

      # install the project
      - name: Install
        run: npm install --ignore-scripts

      # run the test on the project itself
      - name: Run tests
        run: npm test
```

### Continuous Delivery

TODO
