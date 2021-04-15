var gate = require('../index');

var g = gate.create();
setTimeout(g.latch({val: 'a'}), 30);
setTimeout(g.latch({val: 'b'}), 20);
setTimeout(g.latch({val: 'c'}), 10);

g.await(function (err, results) {
  if (err) throw err;
  console.log(results);
});
