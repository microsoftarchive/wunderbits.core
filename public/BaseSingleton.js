'use strict';

var WBSingleton = require('./WBSingleton');

var BaseSingleton = WBSingleton.extend({
  'mixins': [
    'WBEventsMixin',
    'WBBindableMixin',
    'WBDestroyableMixin',
    'WBUtilsMixin',
    'ObservableHashMixin'
  ].map(function (name) {
    return require('./mixins/' + name);
  })
});

module.exports = BaseSingleton;
