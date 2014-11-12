'use strict';

var toArray = require('./toArray');
var merge = require('./merge');
var assert = require('./assert');

function extendObject (object, sources) {

  // loop through the sources
  // merging them recursively
  while (sources.length) {
    merge(object, sources.shift());
  }
  return object;
}

function extend () {

  // convert the argument list into an array
  var args = toArray(arguments);
  // validate input
  assert(args.length > 0, 'extend expect one or more objects');
  return extendObject(args.shift(), args);
}

module.exports = extend;
