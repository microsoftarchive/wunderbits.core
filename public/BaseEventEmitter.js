'use strict';

var WBEventEmitter = require('./WBEventEmitter');

var BaseEmitter = WBEventEmitter.extend({
  'mixins': [
    'WBDestroyableMixin',
    'WBUtilsMixin',
    'ObservableHashMixin'
  ].map(function (name) {
    return require('./mixins/' + name);
  })
});

module.exports = BaseEmitter;
