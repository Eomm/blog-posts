# How we are securing the Fastify organization

_This is the story of a year of boring work behind the packages you install every day._

Some time ago I was asked a very simple question about Fastify: who can publish it?

I knew the shape of the answer, a handful of people I trust. What I did not have was the
list with the actual set of accounts that could push a new version of `fastify` and its plugins
to npm tonight.

That is an uncomfortable gap to find. When you run `npm install`, you are accepting a
deal: you trust that the maintainers of the hundreds of packages in your tree are not
going to ship you something nasty, on purpose or by accident. Fastify is downloaded by
millions of developers and companies every month, which puts me on the other side of that
deal, and being on that side means the question above needs a real answer.

Over the past year, thanks to
[our involvement in GitHub's OSS Fund](https://github.com/open-source/github-secure-open-source-fund),
the Fastify team went through the whole organization and started closing the doors that
an attacker could use to ship a malicious release with our name on it.

We did a lot of small things and in this article I want to focus on the three items I find
most interesting, because they are the ones you can copy into your own organization today.

## 1. Who can publish? Answering that question with code

I must start with a disclaimer: at the time of writing, the Fastify organization releases
more than 50 packages manually. That is not laziness, it is a conscious choice, and it
goes against the advice you read everywhere else:

- We don't want automated releases, because a human should always be the one to hit the "publish" button.
- We don't want tokens in CI jobs, because a compromised workflow could push a malicious release without anyone noticing.
- We don't want a single token able to release all the packages, and configuring more than 50 scoped tokens by hand is not realistic either.

Let me be honest about the price we pay for it: a patch ships when a human with
publishing rights is awake and available, so our releases are slower than they would be
with a release automation. We think some of the delay is a fair exchange for
never having a credential that can publish `fastify` sitting in a workflow environment.

That choice moves the whole problem onto the humans, which is where the real work starts.
An organization with dozens of maintainers has a natural entropy problem: people join,
people move on, and nobody remembers to remove npm access for a contributor who
stopped writing code two years ago. Every one of those forgotten accounts is a valid
publishing credential sitting in a browser somewhere.

So we wrote [`fastify/org-admin`](https://github.com/fastify/org-admin): a set of Node.js
scripts that manage the membership lifecycle of the organization. It can:

- Onboard a new member into the right GitHub teams.
- Offboard a member, removing them from active teams, adding them to the `emeritus`
  team and cleaning up their npm team access.
- List inactive members by looking at their contribution history over a configurable
  period, so we can ask them if they are still around and their account is still safe and sound.
- Sync npm organization teams with the GitHub repository topics, classifying packages
  as core, libraries, plugins or deprecated.

Two details matter more than the features:

1. **Every command supports `--dryRun`.** Access management scripts are exactly the kind
   of code where a typo removes fifty people from a team. You want to read the plan
   before executing it.
   The `sync-npm-org` command goes one step further: instead of touching the registry, it
   writes an `npm-org-sync.sh` file with the `npm access` commands it would run, so a
   second pair of eyes can review it before anything is applied.
2. **It runs locally only, in a secure environment.** There is no CI job, no
   long-lived GitHub App, no automation server holding an admin token. The tooling needs
   privileged credentials to manage teams and npm access, and the smallest possible
   attack surface for that kind of token is a laptop that belongs to an org admin,
   running the script on demand. A scheduled workflow with org-admin permissions would
   be a much nicer target than the temporary token in my `.env` file.

The result is that "who can publish `fastify`?" is now a question with a reproducible
answer.

But good news: now that the ecosystem has grown a bit, npm has added a feature that makes this even easier
for us and enables manual releases with the [npm trusted publisher feature](https://github.com/fastify/fastify/issues/2748#issuecomment-5379074223),
so you will be able to verify where a tarball came from, with the human still in the loop.
_Coming soon_

## 2. Your CI is the shortest path to a malicious release

If I wanted to publish a compromised version of a popular package, I wouldn't try to
find a bug in the library. I would look at its GitHub Actions workflows.

We removed the workflows that used `pull_request_target` from the main repositories. That
trigger runs with the permissions of the base repository, secrets included, and the usual
mistake is to combine it with a checkout of the contributor's branch:

```yaml
on: pull_request_target # runs with the base repo's token and secrets

jobs:
  build:
    steps:
      - uses: actions/checkout@v6
        with:
          # the pull request author's code
          ref: ${{ github.event.pull_request.head.sha }}
      - run: npm install && npm test # ...and now it is running
```

Anybody opening a pull request can edit a test file, or add a `postinstall` script, and
that code executes with a token that can write to your repository. That is code injection
with extra steps.

Then we went through the remaining workflows and applied two rules.

Read-only tokens by default, so a compromised step cannot write back to the repository:

```yaml
permissions:
  contents: read
```

Note that this block must sit at the top level of the workflow file, or be repeated in
every single job. A `permissions` key inside one job does not restrict the others, and
this is the detail people get wrong most often: one forgotten job keeps its write token.

And third-party actions pinned to a full commit SHA, because a tag is a mutable pointer
that the action's owner (or whoever compromises them) can move under your feet:

```yaml
# ❌ v4 is a tag: it can be moved to any commit at any time
- uses: some-org/some-action@v4

# ✅ a commit SHA cannot be rewritten
- uses: some-org/some-action@a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 # v4.1.0
```

We did not stop at third-party actions: we pinned GitHub's own first-party actions and
our [`fastify/workflows`](https://github.com/fastify/workflows) reusable workflows too,
[like in this pull request](https://github.com/fastify/fastify/pull/6853). It may look
paranoid, but it protects us even if one of GitHub's own actions, or our own shared
workflows repository, gets compromised.

Pinning by hand once is easy, keeping the pins current is the part people give up on.
Dependabot understands SHA pins and will open the bump pull requests for you, updating
both the SHA and the version comment.

None of this is exciting work. It is the kind of change that shows up as "chore: pin
actions" in the git log, and it removes an entire class of attacks.

## 3. `ignore-scripts`, or how to survive a compromised dependency

In September 2025 the Shai-Hulud campaign spread through npm using lifecycle scripts:
you install a package, npm runs its `postinstall`, and the malware is already executing
on your machine with your credentials in reach.

The first mitigation is one line, added to the `.npmrc` of our repositories:

```ini
ignore-scripts=true
```

An `npm install` in a Fastify repository, on a maintainer's machine or in a CI
job, no longer executes the lifecycle scripts of the dependency tree. Our test
suites never needed those hooks, so the cost is zero and a compromised transitive
dependency does not get a free shell out of it.

The second line addresses the other half of the problem. These campaigns are usually
spotted and unpublished within hours, so most of the danger is in being among the first
to install a brand new version:

```ini
min-release-age=2
```

This tells npm to build the tree using only versions that have been on the registry for
more than 2 days, which is generally enough time for a malicious release to be found and
taken down before it ever reaches us.

If you want to do the same in your projects:

```bash
npm config set ignore-scripts true
npm config set min-release-age 2
```

_Be aware of the trade-off: some packages legitimately need their install scripts to
build native bindings. When you hit one, allow it explicitly instead of turning the
protection off globally: install with the scripts disabled, then run `npm rebuild sharp`
for that single package. You end up with a short, reviewable list of dependencies you
have decided to trust with code execution, which is exactly the point._

## What is still on the list

Security is not a project with a completion date, so here is what we are working on:

- **npm provenance** for every published package, so you can verify that the tarball on
  the registry was built by our workflow, from our source code.
- **GitHub immutable releases**, so a published release cannot be silently rewritten.
- **Inactive member cleanup on npm**, the registry-side counterpart of what `org-admin`
  already does on GitHub.
- **An incident response plan** in our `SECURITY.md`, because the interesting question
  is not "will something happen?" but "what do we do in the first hour?".

## Summary

When you choose Fastify, you are not only choosing a fast HTTP server: you are trusting
an organization that has write access to your `node_modules`. We are trying to be worthy
of that.

The three changes worth stealing:

1. Manage org and registry access with scripts you can dry-run, and keep the admin
   credentials out of any automation.
2. Treat your CI as production: read-only tokens, actions pinned to SHAs, and no
   `pull_request_target` with untrusted code.
3. Disable dependency lifecycle scripts, and allow them one by one when you really
   need them.

If you only do one of them this week, do the third: `ignore-scripts` takes five minutes
and it is the one that would have stopped Shai-Hulud on your machine.

If you maintain a popular package, the rest is an afternoon of boring work. Do it
before you need it. 🙏

If you enjoyed this article, you might like [_"Accelerating Server-Side Development with Fastify"_](https://backend.cafe/the-fastify-book-is-out).
Comment, share and follow me on [X/Twitter](https://twitter.com/ManuEomm)!
