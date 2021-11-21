
# Keep your community up to date with the latest releases

by *[Manuel Spigolon](https://twitter.com/ManuEomm)*

One of the most boring things for a developer to do are repetitive tasks.
All these tasks can be automated, but usually you don't have time to do it.

For example: you want to inform your team about a new release, but you don't have time to do it or you simply forget about it.

Here you are a simple way to do it thanks to GitHub Actions!

## Understand the need

You need to stop doing repetitive tasks and start doing something useful for your team.
So ask yourself:

- when do you need to send a tweet?
- which information do you need to send?
- how much tweets do you need to send?

These questions are the ones you need to answer.

The `when` question identifies the git repository event you want to listen to.
The `which` question identifies the information you want to send.
The `how much` question identifies if you should create an application and sell it 🤑

We are going to answet these questions with a simple example:

> I want to send a tweet every time a new release is published on GitHub.
> The release schedule is flexible. I don't release more than a couple of times a day.

From this sentence we can search for the right GitHub event from the [Official Documentation](https://docs.github.com/en/actions/learn-github-actions/events-that-trigger-workflows#webhook-events).

## Create a workflow

First of all, you need to create a new workflow file into the `.github/workflows` directory.

The workflow depends on the event you want to listen to and the corrisponding payload.
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

As you can see, the workflow is very simple.
It requires:
- the `tweet-message` variable to be set with the message you want to send. Note that if you overflow the 280 characters limit, the action will fail.
- the `env` keys to send the tweet on your behalf.

## Configure the Twitter App

To send the tweet, you need to create a Twitter App using the [Twitter Developer Portal](https://developer.twitter.com/en/apps).
The GitHbug Action works with [Twitter API v2.0](https://developer.twitter.com/en/docs/basics/authentication/overview/application-only) so the free plan is enough.

After create the App, you will get the secrets:

- `TWITTER_CONSUMER_API_KEY`
- `TWITTER_CONSUMER_API_SECRET`

Store them in a secure place: you will need them to send the tweet.

Then, from the App details page, you need to change the App Permissions from `read` to `read and write`:

