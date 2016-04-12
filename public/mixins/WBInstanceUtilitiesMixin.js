'use strict';

var WBMixin = require('../WBMixin');

var WBInstanceUtilitiesMixin = WBMixin.extend({
  'isInstanceOf': function isInstanceOf (Class) {
    return (typeof Class === 'function') && (this instanceof Class);
  }
});

module.exports = WBInstanceUtilitiesMixin;
