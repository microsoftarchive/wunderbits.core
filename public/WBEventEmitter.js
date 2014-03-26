'use strict';

var WBClass = require('./WBClass');

var WBEventEmitter = WBClass.extend({
  'mixins': [
    'WBBindableMixin',
    'WBEventsMixin'
  ].map(function (name) {
    return require('./mixins/' + name);
  })
});

module.exports = WBEventEmitter;
