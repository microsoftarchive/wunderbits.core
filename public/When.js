define([
  './WBSingleton',
  './WBDeferred'
], function (WBSingleton, WBDeferred) {

  'use strict';

  var arrayRef = [];

  var self = WBSingleton.extend({

    'when': function() {

      var main = new WBDeferred();
      var deferreds = arrayRef.slice.call(arguments);

      var count = deferreds.length;
      var args = new Array(count);

      function Fail () {
        main.rejectWith(this);
      }

      function Done () {
        var index = count - deferreds.length - 1;
        args[index] = arrayRef.slice.call(arguments);

        if (deferreds.length) {
          var next = deferreds.shift();
          next.done(Done).fail(Fail);
        } else {
          args.unshift(this);
          main.resolveWith.apply(main, args);
        }
      }

      if (deferreds.length) {
        var current = deferreds.shift();
        current.done(Done).fail(Fail);
      } else {
        main.resolve();
      }

      return main.promise();
    }
  });

  return self;
});