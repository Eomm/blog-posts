# How we release Fastify packages without npm tokens

_A manual release, a second pair of eyes, and zero secrets in CI._

Automated releases from GitHub Actions have been around for years. You merge, a bot bumps
the version, a token stored in the repository secrets publishes to npm, and you go grab a
coffee. So when I tell you that the Fastify organization has just started releasing its
packages from GitHub Actions, you may think we are a bit late to the party 😄

We are, and it was on purpose.

In the [previous article](./bonus-fastify-org-security.md) I explained why Fastify has always
released its packages by hand, from a maintainer's laptop, with npm asking for the OTP code
every single time. I also closed a paragraph with a "_coming soon_" about npm Trusted
Publishers. Well, it is here!

In this article I will show you:

- why we refused every release automation until now;
- what changed in the ecosystem to make us move;
- the new release flow, step by step;
- how we configured it on about 100 repositories without clicking 100 times.

## Why not before?

There were three things we wanted from a release process, and we were not willing to trade
any of them:

1. **A human decides when to release.** A maintainer looks at the commits, picks the SemVer
   bump and starts the release. No bot is going to publish on every merge.
2. **A second pair of eyes.** One person starts the release, another person approves it.
3. **No token that skips the OTP.** The classic automation recipe needs an npm token that can
   publish without two-factor authentication, because a CI job cannot type a code from your
   phone. We have never created one.

The third point is the one I want to stress. A publish token stored in a repository secret
is a credential that bypasses all the checks we put on humans. If a workflow gets compromised,
or a malicious pull request finds a way to read that secret, the attacker can publish a new
version of a Fastify package, and millions of `npm install` will happily download it. We
can't put the community and our projects at that risk to save a few minutes per release.

Manual releases satisfied the first and the third point, but they had their own price:

- The second pair of eyes was a matter of discipline, not something the process enforced.
- The npm publishing rights lived on npm, the maintainers and the repositories lived on
  GitHub, and keeping the two lists aligned was a never ending job. Every time somebody
  joined or left the team, we had to remember to update both sides.

## What changed?

npm [Trusted Publishers](https://docs.npmjs.com/trusted-publishers) let a package declare:
_"I can be published only by this GitHub workflow, in this repository, in this environment"_.

When the workflow runs, GitHub issues a short-lived OIDC token that proves where the job is
running, and npm exchanges it for the permission to publish that one package. There is no
long-lived secret to steal, nothing to rotate, nothing stored in the repository settings.

That solves the token problem, but it was not enough for us, because we have about 100 active
repositories in the organization. Configuring a trusted publisher by hand, through the npm
website, 100 times? No thanks. And until recently there was no API to do it.

Now there is: the `npm trust` command configures a trusted publisher from the terminal, and
since npm `11.15.0` it supports the `--allow-publish` flag we need. Combined with the GitHub REST API
for environments, the whole setup becomes a script.

That's what made me change my mind: the ecosystem now has the maturity to make an automated
publish actually secure, and the tooling to apply it to a whole organization. Time to join
the party! 🎉

## The new release flow

Here is what a maintainer does to release a Fastify plugin today:

1. Decide the SemVer bump by reading the commits since the last release.
2. Open the release workflow of the repository, for example the
   [`fastify-cli` one](https://github.com/fastify/fastify-cli/actions/workflows/release.yml).
3. Trigger it manually and select `patch`, `minor` or `major`.
4. The workflow starts and **stops**, waiting for the approval of a member of the
   `fastify/release` GitHub team.
5. Once approved, the workflow:
   - creates and pushes a commit with the new version;
   - publishes the package to npm with provenance;
   - creates the GitHub Release with the generated release notes.

All three requirements are still there. A human starts the release, another human approves
it, and there is no npm token anywhere.

### The workflow

The workflow file in each repository is tiny:

```yaml
name: Release the package

on:
  workflow_dispatch:
    inputs:
      semver:
        description: "Release bump type"
        required: true
        type: choice
        options:
          - patch
          - minor
          - major

permissions: {}

jobs:
  release:
    permissions:
      id-token: write # required for npm provenance via OIDC
      contents: write # required to push the release commit and the tag
    uses: fastify/workflows/.github/workflows/reusable-release.yml@6d2e20befa0c8fef6f7c7c1b5e8b79fbbf8d3d9a
    with:
      semver: ${{ inputs.semver }}
```

Let's break it down:

- `workflow_dispatch` means nobody can trigger it with a push or a pull request: it runs only
  when somebody presses the button.
- `permissions: {}` drops all the permissions at the top level, and the job gets back only
  the two it needs. `id-token: write` is the one that lets GitHub issue the OIDC token for npm.
- The real logic lives in a reusable workflow in
  [`fastify/workflows`](https://github.com/fastify/workflows), pinned to a commit SHA, as we
  do for every action we use. Fixing a bug in the release process means updating one file,
  not 100.

The reusable workflow is a plain sequence of steps. These are the lines that matter for the
security model:

```yaml
jobs:
  release:
    environment: ${{ inputs.environment }} # defaults to "release"
    steps:
      # ...checkout, setup-node, version bump
      - name: Install dependencies
        run: npm install --ignore-scripts --no-audit --no-fund
      # ...
      - name: Publish to npm
        run: npm publish --provenance --access public
```

Notice what is missing: there is no `NODE_AUTH_TOKEN` and no `secrets.NPM_TOKEN`. The
`npm publish` command authenticates with the OIDC token, and `--provenance` attaches a signed
statement to the package that says which repository and which workflow built it.

The `environment: release` line is where the approval happens, so let's see how it is
configured.

### The GitHub environment

Each repository has an environment named `release` with two protection rules:

1. **Required reviewers**: the `fastify/release` team. The job does not start until one of
   its members approves it.
2. **Deployment branches**: only `main` can use the `release` environment. Somebody pushing
   a modified `release.yml` to another branch can't reach the publishing step.

On the npm side, each package has a GitHub Actions trusted publisher bound to that exact
setup:

| Setting           | Value         |
| ----------------- | ------------- |
| Organization      | `fastify`     |
| Repository        | `<repo name>` |
| Workflow filename | `release.yml` |
| Environment name  | `release`     |
| Allow publish     | Enabled       |

The three pieces lock each other: npm accepts a publish only from `release.yml` running in the
`release` environment, GitHub lets that environment run only on `main`, and only after a
member of `fastify/release` approves it.

As a bonus, the list of people who can publish now lives in one place: the `fastify/release`
GitHub team. That's the alignment problem between npm and GitHub gone.

## Configuring 100 repositories

Doing all of the above by hand for each repository was not an option, so I wrote
[two Bash scripts](https://gist.github.com/Eomm/bb3c5979160ba8384881d5544a82fcc0).
The first one uses the `gh` CLI to create the `release` environment with its two protection
rules. The second one reads a CSV with the repositories and their npm packages, runs the
first script for each row, and then calls `npm trust github` to configure the trusted
publisher.

The only manual step left is the npm 2FA prompt: the first call opens the browser, and you
can tick _"skip two-factor authentication for the next 5 minutes"_ to let the next calls run
unattended.

Like the `org-admin` scripts from the previous article, these run locally, from an admin's
machine, on demand. No automation holds the admin credentials.

## Does it work?

Yes! We tested the whole flow live during NodeConf EU, releasing
[`fastify-cli@8.0.3`](https://www.npmjs.com/package/fastify-cli/v/8.0.3). If you open that
page on npm, you will find the provenance badge linking the tarball to the workflow run that
built it.

## Migration and next steps

For each Fastify package, the migration is:

1. Create the `release` environment with its two protection rules.
2. Add the `release.yml` workflow.
3. Configure the npm trusted publisher.
4. Remove the npm publishing access for non-admins, since it is not needed anymore.
5. Add the people currently in the npm release team to the `fastify/release` GitHub team.

Step 4 is my favourite one: fewer accounts with publishing rights on npm means fewer
credentials that can be phished.

The main [`fastify`](https://github.com/fastify/fastify) repository is not part of this first
round. It has its own release needs and it will require an ad-hoc workflow. We want to roll
the system out to the plugins first, see how it behaves for a while, and then move the core.

## Summary

Automated releases are not new, but releasing without a long-lived npm token, with a human
approval enforced by the platform, is something the ecosystem could not offer until recently.

- A maintainer still decides **when** and **what** to release.
- A second maintainer must approve it, through a GitHub environment that only runs on `main`.
- npm Trusted Publishers replace the OTP-skipping token with a short-lived OIDC token, and
  `--provenance` tells you where each tarball comes from.
- `npm trust` and the GitHub REST API made it possible to apply all of this to about 100
  repositories with a script, instead of an afternoon of clicking.
- Publishing rights now live in a single GitHub team, instead of two lists to keep in sync.

If you maintain packages and avoided release automation for the same reasons we did, now is a
good time to have another look.

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
