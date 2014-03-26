'use strict';

var toArray = require('./toArray');
var delay = require('./delay');

function defer (fn) {
  var args = toArray(arguments);
  args[0] = 1;
  args.unshift(fn);
  return delay.apply(null, args);
}

module.exports = defer;
