# The Secrets Behind High Performance With Node.js

It happens to me to remember what I thought was a performant solution compared to what
I see in the Node.js panorama, and I think it's worth sharing.

What I thought is that the fastest code implementation is achieved by using:

- Esoteric data structures
- Unknown algorithms
- Bitwise operations
- A master degree in rocket science

...and I was wrong!

Let me share some of the secrets behind high performance with Node.js.


## Regular expressions are slow

The title explains it all — regular expressions are slow. If you see a regular expression in your code then
that code can be optimized by removing the regular expression.

The error I was making is to think that regular expressions have a complexity of `O(1)`, but they don't.  
_I know, I know, I was silly to think that._  
Anyway, the regular expression complexity depends on the engine implementation.
In Node.js, the `RegExp` engine is performed by V8 v10.2.x, which implements a
backtracking algorithm with a complexity of <code>O(2<sup>n</sup>)</code>!

In fact, if you try to run this simple code:

```js
/(a*)*b/.exec('a'.repeat(100))
```

It will take 90 seconds.  
Instead, if you run the previous code with `node --enable-experimental-regexp-engine-on-excessive-backtracks regexp.js`,
it will take only **0,01 seconds**!!

The V8 flag `--enable-experimental-regexp-engine-on-excessive-backtracks` enables a new experimental non-backtracking RegExp engine.
You can deepen this new algorithm by following the guidance in this [V8 article](https://v8.dev/blog/non-backtracking-regexp).

So, the first takeaway is that regular expressions are slow, and you should avoid them as much as possible.
If you can't avoid them, you should try to check the `node --v8-options` and verify if you can tune the
default RegExp engine.

If you are interested in the topic then you can find out more by reading [this article](https://swtch.com/~rsc/regexp/regexp1.html). It explains the complexity of regular expressions and compares the different algorithms.


## You don't need regular expressions

Sorry to be so repetitive, but I must talk about regular expressions again.  
Sometimes a regular expression seems to be the best solution, but it's not.

Let's take a look at the following code:

```js
const utf8MimeType = /^text\/|^application\/(javascript|json)/
const isUtf8MimeType = utf8MimeTypeRE.test('application/json')
```

The code above is a simple check to verify if a MIME type is UTF-8 and matches multiple combinations of MIME types.

The code is simple, but it's not performant because it can be optimized by removing the regular expression:

```js
function isUtf8MimeType (value) {
  const len = value.length
  return (
    (len > 21 && value.indexOf('application/javascript') === 0) ||
    (len > 14 && value.indexOf('application/json') === 0) ||
    (len > 5 && value.indexOf('text/') === 0)
  )
}

const isUtf8MimeType = isUtf8MimeType('application/json')
```

The latter code is faster than the former code because it doesn't use a regular expression.  
What does "faster" mean?  
The first code executes 10,632,205 ops/sec ±1.69% (191 runs sampled), while
the second code executes 1,132,847,245 ops/sec ±0.15% (192 runs sampled).
The second code is 106x times faster than the first code.

The code example is not trivial because it is one of [Fastify's pieces of code](https://github.com/fastify/send/pull/39)!  
[Uzlopak](https://github.com/Uzlopak) is one of the Fastify team members obsessed with performance.


## Silly code is not so silly

There may be times when you think the source code is silly, but it's not.  
Let's normalize an unknown input into a string array. If we can't normalize the input, we throw an error:

```js
function normalizeList (val) {
  if (typeof val === 'string') {
    return [val]
  } else if (val === false) {
    return []
  } else if (Array.isArray(val)) {
    for (let i = 0, il = val.length; i < il; ++i) {
      if (typeof val[i] !== 'string') {
        throw new TypeError('must be array of strings or false')
      }
    }
    return val
  } else {
    throw new TypeError('must be array of strings or false')
  }
}
```

I'm sure this code works, but it may not pass a coding interview — it's too verbose, and there is a smell of duplication... but [it is performant](https://github.com/fastify/send/pull/38)!  
The code above is 4x times faster than the nice and clean code below:

```js
function normalizeList (val) {
  const list = [].concat(val || [])
  for (let i = 0; i < list.length; i++) {
    if (typeof list[i] !== 'string') {
      throw new TypeError('must be array of strings or false')
    }
  }
  return list
}
```

So it is important to understand that sometimes simple checks are faster than a single line of code.
Let's call it an `exit early` pattern.  
This doesn't mean that you should write verbose code, but you should be aware how to improve the performance:

- Conditions that are more likely to be true should be checked first
- Simple checks are faster than forcing a unique code path
- A bit of duplication is better than a bit less performance

Another interesting example is to map all the supported ASCII characters to a `Map` object.
In Fastify [we did this too](https://github.com/fastify/fast-uri/pull/7/files), and all in the name of performance.
This new code helps us to reduce the complexity of the code by treating uppercase and lowercase characters as the same.
For sure, this code would not pass a coding interview as well!

### Performance shortcuts

Earlier, I mentioned that you should write readable code and prefer simple checks. However, it's worth mentioning that
sometimes you may isolate a piece of code that is not readable, but it is faster.

A perfect example is the `new Function` usage. By writing:

```js
const functionArgs = ['value']
const functionBody = 'return value[0].toUpperCase()'
const fn = new Function(...functionArgs, functionBody)

console.log(fn('Hello')) // prints H
```

You can create a function body at runtime by concatenating strings.

This technique is the secret sauce of Fastify's [`fast-json-stringify`](https://github.com/fastify/fast-json-stringify) module.
Another extreme example is the `string.startsWith` and `string.endsWith` methods.  
If we want to check that a string starts with the `foo` string, we can generate a function body like the following:


```js
const functionArgs = ['value']
const functionBody = `return value[0] === 'f' && value[1] === 'o' && value[2] === 'o'`
const fn = new Function(...functionArgs, functionBody)

console.log(fn('foo')) // prints true
console.log(fn('bar')) // prints false
```

The generated function is **14x** times faster than the native method!
This is the technique [likely to be integrated](https://github.com/fastify/help/issues/711) into Fastify's code.

⚠️ Note that generating a function body at runtime could be unsafe if you are managing user input to generate the function.
Be careful when you use this technique to make sure it improves the performance!

## Know your language and runtime

Node.js is a JavaScript runtime, but it has its own peculiarities that you should know in order to be able to write performant code.
If you deal with the `Error` object, or you have ever implemented a custom error, you should know about the [`Error.stackTraceLimit`](https://nodejs.org/api/errors.html#errorstacktracelimit)

The `Error.stackTraceLimit` is the maximum number of stack frames captured by the `Error.stack` property.
The default value is `10`, but you can change it to `0` when you don't need the complete stack trace, and this will improve the performance by 600x times!

This is an example of the most uncommon property of Node.js, but it is not always about tweaking the runtime,
sometimes you need to know the best constructs to use in your code.
[RafaelGSS](https://github.com/RafaelGSS) is a Node.js core contributor, and he has
written a [benchmark](https://github.com/RafaelGSS/nodejs-bench-operations) to compare the performance of
the different operations in JavaScript.  
For example:

- Concatenating strings using `['a', 'b', 'c'].join('')` is 100x slower than `a + b + c`!
- The `foreach` loop is ~5% slower than the `for` loop!

The takeaway is to write readable and maintainable code, then optimize it by isolating the hot path
and benchmarking it. The last step is to optimize the hot path, focusing on tiny pieces of code.


## Use the right data structure

The data structure you use in your code can greatly impact your application's performance.

> There is no slow programming language, just bad algorithms and data structures design.

Says [Michele Riva](https://github.com/micheleriva) in his talk at [NodeConf EU 2022](https://www.youtube.com/watch?v=42sMkbGLlh4).
That is incredibly true, and you should always consider the data structure you use in your code.

If you are looping an array repeatedly, it is essential to ask yourself if you can use a `Map` or a `Set` instead.
A tree data structure is sometimes the best solution to run performant searches and traversals.

I can't suggest a simple rule for you to follow, but you should always think about the data structure you are using
and the algorithm that uses it.  
I find it useful to check the [Big O notation cheat sheet](https://www.bigocheatsheet.com/) of the data structure
and to read some books about these topics.


## Summary

In this article, we have seen how to improve the performance of a Node.js application by using and writing
performant code and avoiding unnecessary operations.

Now, think about the application you are working on and try to speed it up by using the techniques we have highlighted in this article.

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
Remember to follow [Uzlopak](https://github.com/Uzlopak) on GitHub to see his amazing work on Fastify!
