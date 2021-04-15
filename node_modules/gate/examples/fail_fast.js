var gate = require('../index');
var fs = require('fs');

var g = gate.create();
fs.readFile('file1', 'utf8', g.latch({name: 'file1', data: 1}));
fs.readFile('non-existent', 'utf8', g.latch({name: 'non-existent', data: 1}));

g.await(function (err, results) {
  if (err) {
    console.log(err);
  } else {
    console.log(results);
  }
}); 
