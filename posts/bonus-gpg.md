# Signing git commits with GPG

Did you see the "Verified" badge on some GitHub commits and wonder how to get it for your own commits?

![verified badge](./assets/gpg-verified.png)

Well,GitHub shows the ‘Verified’ badge when a commit has a valid signature from a trusted key (GPG, SSH, S/MIME, or GitHub’s own).
In this article we’ll focus on the GPG path: generating a key pair, registering the public key with GitHub,
matching the key’s email to your GitHub account, and configuring `git` to sign your commits so GitHub can verify them.

A signature proves the commit came from someone who controls a specific private key,
instead of just "whatever machine happened to use your name and email" in the `git` config.
For example, a dummy attack could be to commit code on a Pull Request on behalf of another developer,
by using their name and email in the commit metadata to trick maintainers into thinking the commit is legitimate
and merging it without proper review.

In fact, by simply changing the `git` config user name and email, you can impersonate anyone:

![fake author and committer](./assets/gpg-unverified.png)

With the "Verified" badge, you will get trust for your contributions and it defends against impersonation.

So, would you like to learn how to sign your git commits with GPG?
Let's get started!

## Setup GPG

First, you need to have [GPG (GNU Privacy Guard)](https://www.gnupg.org/download/index.html) installed
on your machine (available for Windows, macOS, and Linux).
GPG is an open-source implementation of the OpenPGP standard used for public-key cryptography,
primarily for encrypting data, signing data, and managing cryptographic keys.  
It works by maintaining a keyring of public and private keys and applying [asymmetric cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography)
for key exchange and identity verification, often combined with [symmetric cryptography](https://en.wikipedia.org/wiki/Symmetric-key_algorithm)
for actual data encryption.

The `gpg-agent` is a long-running background process that handles private key operations on GPG’s behalf:
it securely caches decrypted private keys in memory, prompts for passphrases, integrates with smart cards or hardware tokens,
and exposes a socket-based API so GPG and other tools don’t repeatedly access private key material.
In practice, GPG delegates all sensitive key usage to `gpg-agent`, which reduces passphrase prompts,
centralizes key protection, and limits how often private keys are decrypted.

That sounds complicated, but don't worry; once it is configured, it will work seamlessly in the background!

If you are using macOS, the easiest way to install GPG is by using [Homebrew](https://brew.sh/):

```bash
brew install gnupg
```

### Pinentry

Another important component is the [`pinentry` program](https://www.gnupg.org/related_software/pinentry/index.html),
which is a collection of simple user interface dialogs used by GPG and `gpg-agent` to securely
prompt users for sensitive information, such as passphrases or PINs.
It ensures that sensitive data is entered in a secure manner, preventing exposure to other applications or potential keyloggers.

To install it, you can follow the official website or use your system package manager again:

```bash
brew install pinentry-mac
```

To configure `gpg-agent` to use `pinentry`, you need to edit (or create) the `gpg-agent.conf` file
located in the GPG home directory (usually `~/.gnupg/`):

```bash
echo "pinentry-program /usr/local/bin/pinentry-mac" >> ~/.gnupg/gpg-agent.conf
# Restart gpg-agent to apply the changes
gpgconf --kill gpg-agent
```

> 💡 The `~/.gnupg/gpg-agent.conf` file may include the `default-cache-ttl` and `max-cache-ttl` settings to control how long the passphrase is cached in memory

Good, if you have GPG installed, the `gpg` command should be available in your terminal and we can start using it.

## Create a GPG key pair

To sign your git commits, you need to create a GPG key pair (a public key and a private key).
Creating a GPG key pair can be done using the following command:

```bash
gpg --full-generate-key
```

This will prompt you to select some options for your key pair; let's go through them briefly:

- **Key type**: You can choose the default option by pressing Enter.
  Select the option based on the supported algorithms of your environment. In our case, ECC is a good choice
  because GitHub supports it
- **Elliptic curve**: You can choose the default option (`Curve 25519`) by pressing Enter
- **Key expiration**: You can choose how long the key will be valid. It is a good practice to set an expiration
  date for security reasons such as 1y (1 year) in case you stop using a laptop or device
- **Real name**: Enter your full name as you want it to appear in the commit signature
- **Email address**: Enter the email address associated with your GitHub account
- **Comment**: Add a comment to help you identify the key later
- **Passphrase**: Choose a strong passphrase to protect your private key. Don't forget it! Here we expect `pinentry` to prompt you for it.

To list the keys you have created, you can use the following command:

```bash
# list private (secret) keys
gpg --list-secret-keys --keyid-format=long
```

The output will look like this:

```bash
sec   ed25519/CACEF4B5F2457FA1 2026-01-17 [SC] [expires: 2027-01-17]
      3FDF83A1577BED43B90F0D63CACEF4B5F2457FA1
uid                 [ultimate] Backend Cafe (Demo cert) <be@demo.com>
ssb   cv25519/D732AC59B5E3FC30 2026-01-17 [E] [expires: 2027-01-17]
```

In this example, the GPG key ID is `CACEF4B5F2457FA1`, take note of it because we will need it later.

### Verify GPG signing works

To verify that GPG signing works, we can just sign a test message:

```bash
echo "test" | gpg --default-key CACEF4B5F2457FA1 --sign --armor
```

This should prompt you for your passphrase (handled by `pinentry`) and output a signed message block like this:

```plaintext
gpg: using "CACEF4B5F2457FA1" as default secret key for signing
-----BEGIN PGP MESSAGE-----

owGbwMvMwCV26tyXrZ9c6xcynuZOYsjMXra[...truncated for brevity...]
V98zj+7xb4EP/2rw9pVWn3rMBAA===ma+I
-----END PGP MESSAGE-----
```

If everything works fine, you can proceed to the next step.

## Configure GitHub to verify your GPG signatures

To configure GitHub to verify your GPG signatures, you need to add your public GPG key to your GitHub account.
First, export your public GPG key using the following command:

```bash
gpg --armor --export CACEF4B5F2457FA1
```

This will output something like this:

```plaintext
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEaWulshYJKwYBBAHaRw8B[...truncated for brevity...]
-----END PGP PUBLIC KEY BLOCK-----
```

Now copy the entire output (including the `-----BEGIN PGP PUBLIC KEY BLOCK-----` and `-----END PGP PUBLIC KEY BLOCK-----` lines)
and go to your GitHub account settings at:

- Navigate to **Settings** > **SSH and GPG keys** > **New GPG key**

Or just go to this URL [https://github.com/settings/gpg/new](https://github.com/settings/gpg/new).

Paste your public GPG key into the "Key" field and click on the "Add GPG key" button to save it.
Now GitHub will be able to verify your signed commits.

## Configure Git to sign commits by default

The last step is to configure your local `git` to sign commits by default using your GPG key.
You can do this by running the following commands:

```bash
git config --global user.signingkey CACEF4B5F2457FA1
git config --global commit.gpgSign true
git config --global gpg.program gpg
```

This will edit your `~/.gitconfig` file to include the following lines:

```ini
[user]
	name = Demo cert
	email = be@demo.com
	signingkey = CACEF4B5F2457FA1
[commit]
	gpgsign = true
[gpg]
	program = gpg
```

## Test it!

Fantastic! Now everything is set up, and it is time to test it!
Create a new git commit in any of your repositories and push the code
to GitHub. After pushing, go to the commit page on GitHub,
and you should see the "Verified" badge next to your commit message!

## Backup your GPG keys

It is crucial to back up your GPG keys, especially the private key,
as losing it means you won't be able to sign commits and you will need to create a new key pair.
You can back up your keys by exporting them to a file:

```bash
# export private (secret) key
gpg --export-secret-keys --armor CACEF4B5F2457FA1 > CACEF4B5F2457FA1-secret.asc
```

Make sure to store this file in a safe place, preferably in an offline location such as an encrypted USB drive.

To restore your keys from the backup file, you can use the following command:

```bash
gpg --import CACEF4B5F2457FA1-secret.asc
```

That's it!

## Summary

This guide shows you how to get the “Verified” badge on your GitHub commits by generating a GPG key pair, configuring `gpg-agent` and `pinentry`, and registering your public key with GitHub.

It walks through creating and testing your key, setting `git` to sign commits automatically, and safely backing up your private key so you don’t lose your signing identity.

If you enjoyed this article, comment, share and follow me on [X](https://x.com/ManuEomm)!
