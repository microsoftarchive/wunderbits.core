'use strict';

var toArray = require('./toArray');

function merge (object) {
  var localSource;
  var sources = toArray(arguments, 1);
  while (sources.length) {
    localSource = sources.shift();
    for (var key in localSource) {
      if (localSource.hasOwnProperty(key)) {
        object[key] = localSource[key];
      }
    }
  }
  return object;
}

module.exports = merge;
