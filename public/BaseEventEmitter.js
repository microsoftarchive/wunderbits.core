define([

  './WBEventEmitter',

  './mixins/WBDestroyableMixin',
  './mixins/WBUtilsMixin',
  './mixins/ObservableHashMixin'

], function (
  WBEventEmitter,
  WBDestroyableMixin, WBUtilsMixin, ObservableHashMixin,
  undefined
) {

  'use strict';

  return WBEventEmitter.extend({
    'mixins': [
      WBDestroyableMixin,
      WBUtilsMixin,
      ObservableHashMixin
    ]
  });
});
