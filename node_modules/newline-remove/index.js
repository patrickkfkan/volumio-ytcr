/**
 * Module dependencies
 */

var assert = require('assert');

/**
 * Strip all newlines from the given value
 *
 * @param {String} val
 * @return {String}
 * @api public
 */

module.exports = function removeNewlines(val) {
  assert.equal(typeof val, 'string', 'newline-remove: val should be a string');
  return val.replace(/(\r\n|\n|\r)/gm, '');
}
