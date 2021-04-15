# newline-remove
[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Downloads][downloads-image]][downloads-url]

Strip all newlines from the given string. Supports linux, osx and windows line
endings.

## Installation
```bash
$ npm i --save newline-remove
```

## Overview
```js
var removeNewline = require('newline-remove');

removeNewline('foo\n bar\n');
// => 'foo bar'
```

## License
[MIT](https://tldrlegal.com/license/mit-license) ©
[yoshuawuyts](http://yoshuawuyts.com/)

[npm-image]: https://img.shields.io/npm/v/newline-remove.svg?style=flat-square
[npm-url]: https://npmjs.org/package/newline-remove
[travis-image]: https://img.shields.io/travis/yoshuawuyts/newline-remove.svg?style=flat-square
[travis-url]: https://travis-ci.org/yoshuawuyts/newline-remove
[coveralls-image]: https://img.shields.io/coveralls/yoshuawuyts/newline-remove.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/newline-remove?branch=master
[downloads-image]: http://img.shields.io/npm/dm/newline-remove.svg?style=flat-square
[downloads-url]: https://npmjs.org/package/newline-remove
