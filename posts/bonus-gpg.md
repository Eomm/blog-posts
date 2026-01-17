# Signing git commits with GPG

Did you see the "Verified" badge on some GitHub commits and wonder how to get it for your own commits?

![verified badge](image.png)

Well, this badge indicates that the commit was signed with a GPG key, which helps verify the authenticity of the commit.
This help prevent tampering and ensures that the commit was made by the rightful author.

For example, a dummy attack could be to commit code on behalf of another developer, by using their name and email
in the commit metadata!

One of the best practices in software development is to ensure the authenticity and integrity of your commits.
One way to achieve this is by signing your git commits with GPG (GNU Privacy Guard). This guide will walk you through the steps to set up GPG signing for your git commits.
