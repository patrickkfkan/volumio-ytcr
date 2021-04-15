var gate = require('../index');
var fs = require('fs');
var exec = require('child_process').exec;

var g = gate.create();

// single mapping: arguments[1] in the callback will be result
fs.readFile('file1', 'utf8', g.latch(1)); 

// multiple mapping: object including arguments[1] and argments[2] in the callback will be result
exec('cat *.js bad_file | wc -l', g.latch({stdout: 1, stderr: 2}));

// all mapping: all arguments in the callback will be result
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
