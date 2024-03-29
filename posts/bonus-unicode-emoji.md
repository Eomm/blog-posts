# How to handle emojis in Node.js

Every time I have to deal with emojis in Node.js, I have to google the same things over and over again. So I decided to write this post to have a reference for myself and you, dear reader.

If you know precisely why `'😊'.length` equals 2, you can skip this post; otherwise, let's see it together.

## What is an emoji?

An emoji is a pictogram, and they surround us in our daily life 🧐
But what is an emoji from a technical point of view?

It is a Unicode character, and [Unicode](https://home.unicode.org/technical-quick-start-guide/) is a standard that defines a unique **code point** number for every character, letter, symbol, emoji, etc. in the world.
A code point is a number that uniquely identifies a character, and it is represented in hexadecimal format: `U+<hex code>`.

Let's see some examples:

| Character | Code points |
| --------- | ---------- |
| A         | `U+0041`     |
| 😊        | `U+1F60A`    |
| 🤌🏼        | `U+1F90C` `U+1F3FC` |
| 👨‍👧‍👦        | `U+1F468` `U+200D` `U+1F467` `U+200D` `U+1F466` |

As you can see, the character `A` and the `😊` emoji are represented by a single code point, while `🤌🏼` and `👨‍👧‍👦` has multiple code points, contrary to what I said in the introduction 😱!

This is because some characters are special abstract symbols used to combine other characters to form a single one or change their properties.

In this case, we can have two types of characters:

- **Character modifiers**: a special character modifies one near character. This is the case of the `🤌🏼` emoji, which is the combination of the `🤌`(`U+1F90C`) character and the `🏼`(`U+1F3FC`) character.

- **Combining characters**: a character that combines with other characters to form a single one or change its properties. This is the case of the `👨‍👧‍👦` emoji, which is the combination of:
  - `👨`(`U+1F468`)
  - plus the `ZWJ` (`U+200D`) + `👧`(`U+1F467`)
  - plus the `ZWJ` (`U+200D`) + `👦`(`U+1F466`)

Let's see them in detail.

### Character modifiers

The Unicode standard defines a set of abstract characters that can be combined with other characters to change the appearance of another character or its phonetic transpilation.

An example is to change the emoji color by adding a [**modifier**](https://en.wikipedia.org/wiki/Modifier_letter) next to the emoji itself.  
The colors are represented by five [Fitzpatrick modifiers](https://en.wikipedia.org/wiki/Fitzpatrick_scale):

| Modifier | Code point |
| -------- | ---------- |
| 🏼        | `U+1F3FB`    |
| 🏼        | `U+1F3FC`    |
| 🏽        | `U+1F3FD`    |
| 🏾        | `U+1F3FE`    |
| 🏿        | `U+1F3FF`    |

So, if you print the `🤌` + ` 🏿`, every Unicode viewer will render the `🤌🏾` emoji.


### Combining characters

A combining character changes the character immediately before it by creating a new character.

This technique can be used to represent accents, diacritics, etc.
An example is the `ñ` character, which is the combination of the `n`(`U+006E`) character and the `◌̃`(`U+0303`) character or the Japanese `ぴ` character which is `ひ`(`U+3072`) and `゚`(`U+309A`).  

A special mention goes to the `ZWJ` (`U+200D`) [
**zero-width joiner**](https://en.wikipedia.org/wiki/Zero-width_joiner) character, which is non-printable and is used to merge two or more characters into a single one.
It is the case of the `👨‍👧‍👦` emoji, which is the combination of: `👨`(`U+1F468`) + `👧`(`U+1F467`) + `👦`(`U+1F466`) as we read earlier. Every char depends on the previous one.

Note that the `ZWJ` character is not the only one used to combine emojis, but it is the most common one for Arabic or Indic scripts such as `سلامU+200Dعلیکم` will be shown as `سلام‌علیکم` in a browser.

We did a long introduction about Unicode. Nevertheless, we just scratched the surface of the standard, which is very complex and huge. We did not mention the Unicode Planes or the Grapheme concept, but we have enough knowledge to understand why `'😊'.length` equals 2.


## Why `'😊'.length` is equal to 2

Before answering this question, we must understand how strings are represented in Node.js.
So far, we have talked about Unicode characters as _code points_, but Node.js does not understand what a _code point_ is. It only understands [**code units**](https://developer.mozilla.org/en-US/docs/Glossary/Code_unit).

A **code unit** is the smallest unit of information that a system can manipulate.
For example, in a 7-bit ASCII system, a code unit is a single byte.
In a 16-bit Unicode system, a code unit is a 16-bit word.

Node.js (and its underlying V8 engine) sees strings as a sequence of 16-bit Unicode characters, so one code unit is 16 bits long.

The final step is understanding how to convert a code point to a code unit.

Let's say we want to convert the `😊` (`U+1F60A`) emoji to its code units.
To do it, we can write this low-level code:

```js
const codePoint = 'U+1F60A'; // 😊

// Convert the code point to a string.
// Remember that a code point is a hexadecimal number.
const codePointAsInteger = codePoint.split('U+').filter(c=>c).map((hex) => parseInt(hex, 16));

// Convert the code point to a string.
const codePointAsString = String.fromCodePoint(...codePointAsInteger);

// Convert the string input to an array of code units.
const codeUnits = toCodeUnits(codePointAsString);

console.log({
  codePoint,
  codePointAsInteger,
  codePointAsString,
  stringLength: codePointAsString.length,
  codeUnits,
  codeUnitAsString: String.fromCharCode(...codeUnits),
  codeUnitsLength: codeUnits.length,
});

function toCodeUnits(string) {
  const codeUnits = []

  for (let i = 0; i < string.length; i++) {
    const char = string[i]    
    const codePoint = char.codePointAt(0)
    codeUnits.push(codePoint)
  }

  return codeUnits
}
```

In the code above we are executing the following steps:

1. Convert the code point string to an integer array.
2. Convert the integer array to a string using [`String.fromCodePoint`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint).
3. Convert the string to an array of code units.
4. Print the results.

> Note that the code is not optimized, and it is not intended to be used in production.

The first step is to convert the code point string from the `U+<hex>` format to an integer array.

> **Note**  
> The code point can be declared as an integer just like this: `const codePoint = 0x1F60A;` _(hexadecimal representation)_ or like a string `const codePoint = '\u{1F60A}';` in _UTF32 representation_, but I find more interesting to show how to convert it from a Unicode format.

The second step is to convert the integer array to a string using [`String.fromCodePoint`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/fromCodePoint).
We did not use the `String.fromCharCode` method because it does not support Unicode code points greater than `0xFFFF` (or 65536 in decimal).

The third step is to convert the string to an array of code units. We did it by iterating over the string and calling the [`String.prototype.codePointAt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt) method on each character.

The last step should print the following output:

```js
{
  codePoint: 'U+1F60A',
  codePointAsInteger: [ 128522 ],
  codePointAsString: '😊',
  stringLength: 2,
  codeUnits: [ 55357, 56842 ],
  codeUnitAsString: '😊',
  codeUnitsLength: 2
}
```

As we can see, the `😊` emoji is represented by two code units: `55357` and `56842`.

🏆 The Node.js string length is equal to the number of its code units. So, if the string has characters that require more than one code unit to be displayed, the string length will be greater than the character length.

## Technical explanation

Previously we said that Node.js stores strings as a sequence of 16-bit Unicode characters.
This means that it can store up to 65536 different characters.
However, Unicode defines more than 65536 characters, so it uses a technique called [**surrogate pairs**](https://en.wikipedia.org/wiki/UTF-16#Code_points_from_U+010000_to_U+10FFFF). Every character that requires more than 16 bits to be represented is split into two 16-bit code units.

Now, try to check the output for these code points:

```js
const codePoint = 'U+1F468U+200DU+1F467U+200DU+1F466'; // 👨‍👧‍👦
const codePoint = 'U+1F90CU+1F3FC' // 🤌🏼
```

You will be surprised that the string length is 8 and 4, respectively.


### How to count the number of characters in a string

But how can we count the number of characters in a string without using the `String.length` property?

A common solution is to use the [`String.normalize`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) method to convert the string to a [**normalization form**](https://en.wikipedia.org/wiki/Unicode_equivalence#Normalization).
Then, using the spread operator to convert the string to an array of **code points** will give us the number of characters in the string.

```js
[...'ñañaña'.normalize()].length; // 6
[...'ñañaña'].length; // 9
```

In this example, the `ñ` is represented by two code points `n`(`U+006E`) + `◌̃`(`U+0303`), but the `normalize` method will convert it to a single code point `ñ`(`U+00F1`).

Unfortunately, this does not work for all emojis:

```
[...'😊'.normalize()].length // 1
[...'🤌🏼'.normalize()].length // It is still 2!!!
```

So, we must adopt a new strategy by using [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) to split the string into segments and count the number of segments.

```js
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
[...segmenter.segment('🤌🏼')].length // 1 🎉
```

> **Note**  
> It is available in Node.js since version 16.0.0 and it is not supported by all the browsers.

You may choose the best solution for your use case.

## Summary


In this article, we learned how to convert a Unicode code point to a code unit and why `String.length` is not equal to the number of characters in a string.
I tried to explain the concepts in a simple and accessible way. If you want to learn more about Unicode and Node.js, I recommend you to read these detailed articles:

- https://mathiasbynens.be/notes/javascript-unicode
- https://dmitripavlutin.com/what-every-javascript-developer-should-know-about-unicode/

Other useful resources that I used to debug things are:

- https://github.com/node-unicode/node-unicode-data to get all the Unicode data in Node.js.
- https://codepoints.net/ to explore Unicode characters and code points.
- https://www.compart.com/en/unicode/ to explore Unicode planes and groups.

If you enjoyed this article, comment, share and follow me on [Twitter](https://twitter.com/ManuEomm)!
