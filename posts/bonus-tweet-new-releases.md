
# Keep your community up to date with the latest releases

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

One of the most boring things for a developer to do are repetitive tasks.
All these tasks can be automated because it does not require concentration or your skills.
Unfortunately, you don't have time to automate those tasks.

For example, you want to inform your team about a new release, but you don't have time to do it, or you forget about it.

Here you are a simple way to do it, thanks to GitHub Actions!

## Understand the need

You need to stop doing repetitive tasks and start doing something useful for your team.
So ask yourself:

- when do you need to send a tweet?
- which information do you need to send?
- how many tweets do you need to send?

These questions are the ones you need to answer.

The `when` question identifies the git repository event you want to listen to.
The `which` question identifies the information you want to send.
The `how much` question identifies if you should create an application and sell it 🤑

We are going to answer these questions with a simple example:

> I want to send a tweet every time a new release is published on GitHub.
> The release schedule is flexible. I don't release more than a couple of times a day.

We can search for the suitable GitHub event from the [Official Documentation](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows#webhook-events).

## Create a workflow

First, you need to create a new workflow file into the `.github/workflows` directory.

The workflow depends on the event you want to listen to and the corresponding payload.
All the JSON payloads can be found in the [Official Documentation](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads).

```yml
name: tweet-release

# Listen to the `release` event
on:
  release:
    types: [published]

jobs:
  tweet:
    runs-on: ubuntu-latest
    steps:
      - uses: Eomm/why-don-t-you-tweet@v1
        # We don't want to tweet if the repository is not a public one
        if: ${{ !github.event.repository.private }}
        with:
          # GitHub event payload
          # https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#release
          tweet-message: "New ${{ github.event.repository.name }} release ${{ github.event.release.tag_name }}! Try it will it is HOT! ${{ github.event.release.html_url }} #nodejs #release"
        env:
          # Get your tokens from https://developer.twitter.com/apps
          TWITTER_CONSUMER_API_KEY: ${{ secrets.TWITTER_CONSUMER_API_KEY }}
          TWITTER_CONSUMER_API_SECRET: ${{ secrets.TWITTER_CONSUMER_API_SECRET }}
          TWITTER_ACCESS_TOKEN: ${{ secrets.TWITTER_ACCESS_TOKEN }}
          TWITTER_ACCESS_TOKEN_SECRET: ${{ secrets.TWITTER_ACCESS_TOKEN_SECRET }}
```

As you can see, the workflow is straightforward.
It requires:
- the `tweet-message` variable to be set with the message you want to send. Note that if you overflow the 280 characters limit, the action will fail.
- the `env` keys to send the tweet on your behalf.

## Configure the Twitter App

You need to create a Twitter App using the [Twitter Developer Portal](https://developer.twitter.com/en/apps).
The GitHub Action works with [Twitter API v2.0](https://developer.twitter.com/en/docs/basics/authentication/overview/application-only), so the free plan is enough.

After creating the App, you will get the secrets:

- `TWITTER_CONSUMER_API_KEY`
- `TWITTER_CONSUMER_API_SECRET`

Store them in a secure place: you will need them to send the tweet.

Then, from the App details page, you need to change the App Permissions from `read` to `read and write`:

![image](https://user-images.githubusercontent.com/11404065/142761864-edb2bddd-50ff-4436-82c8-6c8694670323.png)

Now you need to do the last step.
From the `Keys and tokens` menu, you need to create two more keys:

- `TWITTER_ACCESS_TOKEN`
- `TWITTER_ACCESS_TOKEN_SECRET`

![image](https://user-images.githubusercontent.com/11404065/142761906-9ed1b2be-2e56-4f05-8e64-57a3c243ee71.png)

These two keys let the application posts a tweet using the authorized Twitter account.

Now you need to store those secret keys into your [GitHub Repository secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets).

## Trigger the event

To test the `tweet-release` workflow, you need the create a new [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).
Creating a release was already one crucial step of your delivery process, and now you have automated the boring notification stuff!

### Bonus point: releasify

This workflow works at its best within [`releasify`](https://github.com/fastify/releasify#releasify)!
This CLI tool creates a new npm version and a GitHub Release altogether, and publishing your module within this tool will trigger the `tweet-release` action!

Well done! You know how to increase your community involvement!
