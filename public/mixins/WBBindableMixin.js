define([

  '../WBMixin',
  '../lib/createUID',
  '../lib/assert'

], function (WBMixin, createUID, assert) {

  'use strict';

  function _initBindings (self) {
    if (!self._bindings) {
      self._bindings = {};
      self._namedEvents = {};
    }
  }

  return WBMixin.extend({

    'bindTo': function (target, event, callback) {

      var self = this;
      _initBindings(self);
      self.checkBindingArgs.apply(self, arguments);

      // check for same callback on the same target instance,
      // return the event binding
      var events = self._namedEvents[event];
      if (events) {
        for (var i = 0, max = events.length; i < max; i++) {
          // TODO: all of our classes should have a cid or uid,
          // and we need to pick one and mixin to all base classes
          // for now let targets without uid/cid rebind
          var targetBound = target.cid ? target.cid === events[i].target.cid :
                      target.uid ? target.uid === events[i].target.uid : false;
          if (events[i].callback === callback && targetBound) {
            return events[i];
          }
        }
      }

      target.on(event, callback);

      var binding = {
        'uid': createUID(),
        'target': target,
        'event': event,
        'callback': callback
      };

      self._bindings[binding.uid] = binding;

      if (!self._namedEvents[event]) {
        self._namedEvents[event] = [];
      }
      self._namedEvents[event].push(binding);

      return binding;
    },

    'bindOnceTo': function (target, event, callback) {

      var self = this;
      _initBindings(self);
      self.checkBindingArgs.apply(self, arguments);

      var onceBinding = function () {

        callback.call(self);
        self.unbindFrom(binding);
      };

      var binding = {

        'uid': createUID(),
        'target': target,
        'event': event,
        'callback': onceBinding
      };

      target.on(event, onceBinding);

      self._bindings[binding.uid] = binding;

      return binding;
    },

    'unbindFrom': function (binding) {

      var self = this;
      _initBindings(self);

      if (!binding) {
        assert.string(binding.uid,
          'Cannot unbind from undefined or invalid binding');
      }

      // a binding object with only uid, i.e. a destroyed/unbound
      // binding object has been passed - just do nothing
      if (!binding.event || !binding.callback || !binding.target) {
        return;
      }

      var event = binding.event;
      binding.target.off(event, binding.callback);

      // clean up binding object, but keep uid to
      // make sure old bindings, that have already been
      // cleaned, are still recognized as bindings
      for (var key in binding) {
        if (key !== 'uid') {
          delete binding[key];
        }
      }

      delete self._bindings[binding.uid];

      var namedEvents = self._namedEvents;
      namedEvents[event] = namedEvents[event].filter(function (b) {
        return (b.cid !== binding.cid);
      });

      return undefined;
    },

    'unbindFromTarget': function (target) {

      var self = this;
      _initBindings(self);

      if (!target) {
        assert.function(target.on,
          'Cannot unbind from undefined or invalid binding target');
      }

      var binding;
      for (var key in self._bindings) {
        binding = self._bindings[key];
        if (binding.target === target) {
          self.unbindFrom(binding);
        }
      }
    },

    'unbindAll': function () {

      var self = this;
      _initBindings(self);

      var binding;
      for (var key in self._bindings) {
        binding = self._bindings[key];
        self.unbindFrom(binding);
      }
    },

    'checkBindingArgs': function (target, event, callback) {

      assert.function(target && target.on,
          'Cannot bind to undefined target or target without #on method');
      assert.string(event,
        'Cannot bind to target event without event name');
      assert.function(callback,
        'Cannot bind to target event without a function as callback');
    }
  });
});