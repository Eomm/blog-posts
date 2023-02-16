# The secrets behind high performance

It happens to me to remember what I thought was a performant solution compared to what I actually see
in the Node.js panorama, and I think it's worth sharing.

What I thought is that the fastest code implementation is achieved by using:

- Esoteric data structures
- Unknown algorithms
- Bitwise operations
- A master degree in rocket science

..and I was wrong!

Let me share with you a bit of the secrets behind high performance with Node.js.

## Regular Expressions are slow

The title explains it all. Regular expressions are slow. If you see a regular expression in your code,
that code can be optimized by removing the regular expression.

The error is was doing is to think that regular expressions has a complexity of `O(1)`, but they don't.  
_I know, I know, I was silly to think that._  
Anyway, the regular expression complexity depends on the engine implmentation.
In Node.js, the `RegExp` engine is performed by V8 v10.2.x, which implements a
backtracking algorithm with a complexity of <code>O(2<sup>n</sup>)</code>!

In fact, if you try to run this simple code:

```js
/(a*)*b/.exec('a'.repeat(100))
```

It will take 90 seconds.  
Instead, if you run the previous code with `node --enable-experimental-regexp-engine-on-excessive-backtracks regexp.js`,
it will take only **0,01 seconds**!!

The V8 flag `--enable-experimental-regexp-engine-on-excessive-backtracks` enables new experimental non-backtracking RegExp engine.
You can deep on this new algorithm in this [V8 article](https://v8.dev/blog/non-backtracking-regexp).

So, the first take away is that regular expressions are slow, and you should avoid them as much as possible.
If you can't avoid them, you should try to check the `node --v8-options` and verify if you can tune the
default RegExp engine.

If you are interested in the topic, you can read the [following article](https://swtch.com/~rsc/regexp/regexp1.html)
that explains the complexity of regular expressions and compares the different algorithms.

## You don't need Regular Expressions

Sorry to be so repetitive, but I need to talk about regular expressions again.