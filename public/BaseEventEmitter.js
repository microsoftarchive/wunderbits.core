'use strict';

var BaseEmitter = require('./WBEventEmitter').extend({
  'mixins': [
    require('./mixins/WBDestroyableMixin'),
    require('./mixins/WBUtilsMixin'),
    require('./mixins/ObservableHashMixin')
  ]
});

module.exports = BaseEmitter;
