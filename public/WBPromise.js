define([
  './WBClass'
], function (WBClass) {

  'use strict';

  function generated (name) {
    return function () {
      var deferred = this.deferred;
      return deferred[name].apply(deferred, arguments);
    };
  }

  return WBClass.extend({

    'constructor': function (deferred) {
      this.deferred = deferred;
    },

    'done': generated('done'),
    'fail': generated('fail'),
    'then': generated('then')
  });

});