define([
  './WBClass',
  './WBPromise'
], function (WBClass, WBPromise) {

  'use strict';

  var arrayRef = [];

  var states = {
    'pending': 0,
    'resolved': 2,
    'rejected': 4
  };

  var stateNames = {
    0: ['pending'],
    2: ['resolved', 'resolve'],
    4: ['rejected', 'reject']
  };

  var proto = {

    'constructor': function () {

      var self = this;
      self._state = states.pending;
      self._args = [];
      self.handlers = [];
    },

    'state': function () {
      var self = this;
      return stateNames[self._state][0];
    },

    // TODO: fucking rename this function
    'check': function (withContext) {

      var self = this;
      if (self._state === states.pending) {
        return;
      }

      self.handlers.forEach(function (flipflop) {

        var state = self._state;
        var context = flipflop.context || withContext || self;
        var args = flipflop.args;
        args = args.concat.apply(args, self._args);

        var really = (flipflop.type === 'then') ||
          (flipflop.type === 'done' && state === states.resolved) ||
          (flipflop.type === 'fail' && state === states.rejected);

        really && flipflop.fn.apply(context, args);

      });
    },

    'promise': function () {

      var self = this;
      self._promise = self._promise || new WBPromise(this);
      return self._promise;
    }
  };

  ['then', 'done', 'fail'].forEach(function (method) {
    proto[method] = function () {

      var self = this;

      // store references to zeug
      // TODO: leave a better comment
      var args = arrayRef.slice.call(arguments);
      var fn = args.shift();
      var context = args.shift();
      self.handlers.push({
        'type': method,
        'context': context,
        'fn': fn,
        'args': args
      });

      // if the defered is nt pending anymore, call the callbacks
      self.check();

      return self;
    };
  });

  // Alias `always` to `then` on Deferred's prototype
  proto.always = proto.then;

  [states.resolved, states.rejected].forEach(function (state) {
    var fnName = stateNames[state][1];
    proto[fnName] = function () {
      var self = this;
      self._state = state;
      self._args = arrayRef.slice.call(arguments);
      self.check();
      return self;
    };

    proto[fnName + 'With'] = function () {
      var self = this;
      self._args = arrayRef.slice.call(arguments);
      var context = self._args.shift();
      self._state = state;
      self.check(context);
      return self;
    };
  });

  return WBClass.extend(proto, {
    'when': function () {

    }
  });
});