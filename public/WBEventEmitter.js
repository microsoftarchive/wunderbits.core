'use strict';

var WBEventEmitter = require('./WBClass').extend({
  'mixins': [
    require('./mixins/WBBindableMixin'),
    require('./mixins/WBEventsMixin')
  ]
});

module.exports = WBEventEmitter;
