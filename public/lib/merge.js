'use strict';

var toArray = require('./toArray');

function merge (object, source) {
  var sources = toArray(arguments, 1);
  while (sources.length) {
    source = sources.shift();
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }
  }
  return object;
}

module.exports = merge;
