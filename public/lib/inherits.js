'use strict';

var extend = require('./extend');

// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
function inherits (parent, protoProps, staticProps) {

  var child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call `super()`.
  if (protoProps && protoProps.hasOwnProperty('constructor')) {
    child = protoProps.constructor;
  }
  else {
    child = function () {
      return parent.apply(this, arguments);
    };
  }

  // Inherit class (static) properties from parent.
  extend(child, parent);

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function.
  child.prototype = Object.create(parent.prototype);

  // Add prototype properties (instance properties) to the subclass,
  // if supplied.
  extend(child.prototype, protoProps);

  // Correctly set child's `prototype.constructor`.
  child.prototype.constructor = child;

  // Add static properties to the constructor function, if supplied.
  extend(child, staticProps);

  // Set a convenience property
  // in case the parent's prototype is needed later.
  child.__super__ = parent.prototype;

  return child;
}

module.exports = inherits;
