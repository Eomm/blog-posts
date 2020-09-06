# Project Automation

This tutorial is the following of the "[A Discord app with Fastify!](https://dev.to/eomm/a-discord-app-with-fastify-3h8c)".

## Road to ES Import

Node.js used the CommonJS module system (CJS) since the beginning and recently it has added support to ECMAScript Modules (ESM)
([without the `--experimental-modules` flag](https://github.com/nodejs/node/blob/master/doc/changelogs/CHANGELOG_V12.md#ecmascript-modules-----experimental-modules-flag-removal)).

So to update this project to the ESM module there are many possibilities, described in [this article](https://medium.com/@nodejs/announcing-core-node-js-support-for-ecmascript-modules-c5d6dc29b663) by Node.js Module Team.

I will follow the one that makes sense to me to a project written in CJS as first the implementation:

- add `"type": "module"` in the `package.json`
- rename the `js` files to the `mjs` extension
- fix the `__dirname` usage since it is not supported in ESM
- remove all the `require` in favour of `import`

Note that it is mandatory adding the file extension to local files import:

```js
import authRoutes from './auth.js'
```

- remove `'use strict'` since it is the default behaviour with ESM
- update the `module.exports` to `export default function app (fastify, opts, next) {..`
- fix the start script since `fastify-cli` doesn't support the ESM loading right now


## CI/CD

Adding CI/CD to the project is quite simple thanks to [GitHub Actions](https://github.com/features/actions)
and the great community around them!

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

The delivery of our application needs just to push new commits to the Heroku remote git server.
Moreover, it would be useful for our customers to see what version of the application is running and an
updated CHANGELOG file.

To automate these steps, it is necessary to define a good workflow in the first place.

For examples, the process should answer questions like:
- When releasing the application?
- What semver is the new version?
- What changes should be written in the changelog?
- Must any scripts be executed? - like a database update
- Should notification be sent? 
- a lot of other headaches!!

This application will adopt a process like this:
- at every merge in the `release` branch
- using a commit messages format like [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- bump a new semver version based on the commit messages
- tag the version
- generate a changelog description, grouping the commit messages
- freeze the release on GitHub with the changelog text
- deploy to Heroku

This list can be easily transformed into a GitHub Action where every step will accomplish one of these tasks and the result will be like this (omitting parameters):

```yml
      - uses: actions/checkout@v2

      - name: Version Bump
        uses: phips28/gh-action-bump-version@master
        ...

      - name: Build Changelog message
        uses: scottbrenner/generate-changelog-action@master
        ...

      - name: Create Github Release
        uses: actions/create-release@latest
        ...
        
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.4.6
        ...
```

Check out [the source code](https://github.com/Eomm/fastify-discord-bot-demo/tree/master/.github/workflows/cd.yml) to see the complete file.

## End

In the next post we will:

+ add new features to the application:
  + store the token in cookies
  + add some `/api` endpoints


## Side effects

To write this article:
- I created an [issue](https://github.com/fastify/fastify-cli/issues/267) to `fastify-cli` to support ESM
- I added to the `gh-action-bump-version` GitHub Action:
  - support new pattern matching strings [#36](https://github.com/phips28/gh-action-bump-version/pull/36) 
  - skip the tagging phase [#37](https://github.com/phips28/gh-action-bump-version/pull/37)
- I fixed a VSCode icon pack extension [#178](https://github.com/EmmanuelBeziat/vscode-great-icons/pull/178)
