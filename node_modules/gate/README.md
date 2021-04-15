Gate — An utility to await multiple asynchronous calls
=======================================================

Gate is an utility to await multiple asynchronous calls in Node environment.

## Installing

```
$ npm install gate
```

## Example

You can get each asynchronous result by index or name.

### By Index

```js
var gate = require('gate');
var fs = require('fs');

var g = gate.create();
fs.readFile('file1', 'utf8', g.latch({data: 1}));
fs.readFile('file2', 'utf8', g.latch({data: 1}));

g.await(function (err, results) {
  if (err) throw err;
  console.log(results[0].data); // content for file1
  console.log(results[1].data); // content for file2
});
```

### By Name

```js
var gate = require('gate');
var fs = require('fs');

var g = gate.create();
fs.readFile('file1', 'utf8', g.latch('file1Result', {data: 1}));
fs.readFile('file2', 'utf8', g.latch('file2Result', {data: 1}));

g.await(function (err, results) {
  if (err) throw err;
  console.log(results.file1Result.data); // content for file1
  console.log(results.file2Result.data); // content for file2
});
```

## Additions to Error objects

A extra field is added to an Error object.

* `error.gate_locatioin`: The asynchronous call location that the error occurred.


## API

`gate` module provides following API. 

#### create([Object options]) -> Gate

Returns a Gate object. 

* `options`: Optional. The `options` can have followng keys.

<table>
<tr>
<th>KEY</th><th>TYPE</th><th>DEFAULT VALUE</th><th>DESCRIPTION</th>
</tr>
<tr>
<td>count</td>
<td>Number</td>
<td>-1</td>
<td>
A number of times the returned function must be called before an awaiting callback can start.
Negative value means that count is not specified.
</td>
</tr>
<tr>
<td>failFast</td>
<td>Boolean</td>
<td>true</td>
<td>
Indicates whether an awaiting callback is invoked as soon as possible when any error is found. 
If failFast is true, the found error is set as first argument of the awaiting callback.
</td>
</tr>
</table>


```js
var g = gate.create();
```

```js
var g = gate.create({count: 5, failFast: false}});
```

--

`Gate` objects provide following API.

#### latch([String name][, Object mapping]) -> Function

Returns a callback. The callback arguments are mapped with a `mapping` definition.
If a count is given to `gate.create()`, the count is decremented.

* `name`: Optional. A name for callback arguments.
If not specified, an index number is used as name.

```js
var g = gate.create();
fs.readFile('file1', 'utf8', g.latch('file1Result', {data: 1})); // name is specified
fs.readFile('file2', 'utf8', g.latch({data: 1}));                // name is not specified

g.await(function (err, results) {
  if (err) throw err;
  console.log(results.file1Result.data); // get by name
  console.log(results[1].data);          // get by index
});

```

* `mapping`: Optional. An argument mapping definition. The `mapping` gives names to callback arguments. 
The `mappipng` must be a number or an object.
 * If the `mapping` is a number, single argument is mapped.
 * If the `mapping` is an object, multiple arguments can be mapped.
 * If the `mapping` is `null` or `undefined`, all arguments are mapped as Array.

```js
var g = gate.create();
fs.readFile('file1', 'utf8', g.latch(1));                        // single argument
fs.readFile('file2', 'utf8', g.latch({data: 1, name: 'file2'})); // multiple arguments
fs.readFile('file3', 'utf8', g.latch());                         // all arguments

g.await(function (err, results) {
  if (err) throw err;
  console.log(results[0]);      // content for file1
  console.log(results[1].data); // content for file2
  console.log(results[1].name); // arbitrary value for file2
  console.log(results[2][0]);   // read error for file3 (1st argument of fs.readFile callback)
  console.log(results[2][1]);   // content for file3    (2nd argument of fs.readFile callback)
});

```

#### val(Object value) -> Object

Indicates that a value is a plain value and it's not a mapping index.

* `value`: Required. A plain value.

```js
var g = gate.create();

// a number for a `data` property is a mapping index, but a number for `g.val()` is a plain value 
fs.readFile('file1', 'utf8', g.latch({data: 1, i: g.val(1)}));
fs.readFile('file2', 'utf8', g.latch({data: 1, i: g.val(2)}));

g.await(function (err, results) {
  if (err) throw err;
  console.log(results[0].data); // content for file1
  console.log(results[0].i);    // 1
  console.log(results[1].data); // content for file2
  console.log(results[1].i);    // 2
});
```

#### await(Function callback(err, results, gate)) -> Function

Awaits all asynchronous calls completion and then runs a `callback`.

* `callback`: Required. A callback to run after all asynchronous calls are done.
* `err`: An error to indicate any asynhronous calls are failed.
* `results`: An array to contain each asynchronous result as element.
* `gate`: A new gate object.

```js
var g = gate.create();
fs.readFile('file1', 'utf8', g.latch({data: 1}));
fs.readFile('file2', 'utf8', g.latch({data: 1}));

g.await(function (err, results) {
  if (err) {
    console.log(err);
  } else {
    console.log(results[0].data); 
    console.log(results[1].data); 
  }
});
```

### count: Number

Gets a current count, if a count is given to `gate.latch()`.
Otherwise, `-1` is returned.
This is a readonly property.

```js
var g = gate.create(2);

console.log(g.count); // 2
fs.readFile('file1', 'utf8', g.latch({data: 1}));
console.log(g.count); // 1
fs.readFile('file2', 'utf8', g.latch({data: 1}));
console.log(g.count); // 0
```


## More Examples

### Arguments Mapping

Pass an argument index or an object includes argument indexs to a function being returned from `gate.latch()`. 
In the object, values except whose type is `number` are recognized arguments. 
To pass an number as argument, wrap it with `val` function. 

```js
var gate = require('gate');
var fs = require('fs');
var exec = require('child_process').exec;

var g = gate.create();

// single mapping: arguments[1] in the callback will be result
fs.readFile('file1', 'utf8', latch(1)); 

// multiple mapping: arguments[1] and argments[2] in the callback will be result
exec('cat *.js bad_file | wc -l', g.latch({stdout: 1, stderr: 2}));

// all mapping: arguments will be result
fs.readFile('file2', 'utf8', g.latch());

g.await(function (err, results) {
  if (err !== null) {
    console.log('exec error: ' + err);
  }
  console.log('file1: ' + results[0]);
  console.log('stdout: ' + results[1].stdout);
  console.log('stderr: ' + results[1].stderr);
  console.log('file2: ' + results[2]);
});
```

### Countdown

Pass a count number to `gate.create()` to wait until a set of callbacks are done.

```js
var gate = require('gate');
var fs = require('fs');

var files = ['file1', 'file2'];
var g = gate.create(files.length);
g.await(function (err, results) {
  if (err) throw err;
  console.log(results[0]);
  console.log(results[1]);
});

process.nextTick(function () {
  files.forEach(function (file) {
    fs.readFile(file, 'utf8', g.latch({name: file, data: 1}));
  });
});
```

### Error Handling

Check the first argument of the awaiting callback.
If the argument is not null, it is any error object.

```js
var gate = require('gate');
var fs = require('fs');

var g = gate.create();
fs.readFile('file1', 'utf8', g.latch({name: 'file1', data: 1}));
fs.readFile('non-existent', 'utf8', g.latch({name: 'non-existent', data: 1}));

g.await(function (err, results) {
  // handle any error
  if (err) {
    console.log(err);
  } else {
    console.log(results);
  }
});
```

### Error Handling - handling all errors

Turn off `failFaslt` option and include an error object in each result. 
Then you can handle all errors by yourself.

```js
var gate = require('gate');
var fs = require('fs');

var g = gate.create({failFast: false});
fs.readFile('non-existent1', 'utf8', g.latch({err: 0, data: 1}));
fs.readFile('non-existent2', 'utf8', g.latch({err: 0, data: 1}));

g.await(function (err, results) {
  // handle all errors
  results.forEach(function (result) {
    if (result.err) {
      console.log(result.err);
    } 
  });
});
```

### Nesting

You can use third argument of an awaiting callback to nest 'gate.await()'.

```js
var gate = require('gate');
var fs = require('fs');

var g = gate.create();
fs.readFile('file1', 'utf8', g.latch({data: 1}));
fs.readFile('file2', 'utf8', g.latch({data: 1}));

g.await(function (err, results, g) {
  if (err) throw err;
  var name1 = results[0].data;
  var name2 = results[1].data;
  fs.readFile(name1, 'utf8', g.latch({data: 1}));
  fs.readFile(name2, 'utf8', g.latch({data: 1}));
  g.await(function (err, results, g) {
    if (err) throw err;
    console.log(results[0].data); // content for name1
    console.log(results[1].data); // content for name2
  });
});
```