define([

  './WBSingleton',

  './mixins/WBEventsMixin',
  './mixins/WBBindableMixin',
  './mixins/WBDestroyableMixin',
  './mixins/WBUtilsMixin',
  './mixins/ObservableHashMixin'

], function (
  WBSingleton,
  WBEventsMixin, WBBindableMixin, WBDestroyableMixin,
  WBUtilsMixin, ObservableHashMixin,
  undefined
) {

  'use strict';

  return WBSingleton.extend({
    'mixins': [
      WBEventsMixin,
      WBBindableMixin,
      WBDestroyableMixin,
      WBUtilsMixin,
      ObservableHashMixin
    ]
  });
});
