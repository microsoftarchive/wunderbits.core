'use strict';

var BaseSingleton = require('./WBSingleton').extend({
  'mixins': [
    require('./mixins/WBEventsMixin'),
    require('./mixins/WBBindableMixin'),
    require('./mixins/WBDestroyableMixin'),
    require('./mixins/WBUtilsMixin'),
    require('./mixins/ObservableHashMixin')
  ]
});

module.exports = BaseSingleton;
