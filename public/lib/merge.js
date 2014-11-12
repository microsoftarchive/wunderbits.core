'use strict';

var toArray = require('./toArray');

function mergeKeys (object, source) {

  Object.keys(source).forEach(function mergeKey (key) {

    if (source.hasOwnProperty(key)) {
      object[key] = source[key];
    }
  });
}

function mergeSources (object, sources) {

  sources.forEach(function mergeSource (source) {

    source && mergeKeys(object, source);
  });
}

function merge (object) { // object, source

  var sources = toArray(arguments, 1);
  if (object && sources.length) {
    mergeSources(object, sources);
  }

  return object;
}

module.exports = merge;
