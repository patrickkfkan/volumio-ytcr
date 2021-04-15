var gate = require('../index');
var fs = require('fs');

var g = gate.create();
['file1', 'file2'].forEach(function (file) {
  fs.readFile(file, 'utf8', g.latch({name: file, data: 1}));
});

g.await(function (err, results) {
  if (err) throw err;
  console.log(results[0]); // { name: 'file1', data: 'FILE1' }
  console.log(results[1]); // { name: 'file2', data: 'FILE2' }
});
