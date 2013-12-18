define([

  './lib/assert',
  './lib/toArray'

], function (assert, toArray) {

  'use strict';

  var eventSplitter = /\s+/;

  var validationErrors = {
    'events': 'Cannot bind/unbind without event name(s)',
    'callback': 'Cannot bind/unbind to an event without valid callback'
  };

  var Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      var handler = eventsApi(this, 'on', name, [callback, context]);
      if (!handler || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      var handler = eventsApi(this, 'off', name, [callback, context]);
      if (!this._events || !handler) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }
      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    }
  };

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  return {

    '_eventArgsMap': {},

    'on': function (events, callback, context) {

      var self = this;

      assert.string(events, validationErrors.events);
      assert.function(callback, validationErrors.callback);

      self.iterateOverEvents(events, function (event) {
        var args = self._eventArgsMap[event];
        args && callback.apply(context || self, args);
      });

      Events.on.apply(this, arguments);

      return self;
    },

    'trigger': function (events) {

      assert.string(events, 'Cannot trigger event(s) without event name(s)');

      var self = this;
      var params = toArray(arguments);
      self.iterateOverEvents(events, self.triggerEvent, params);
      return self;
    },

    'triggerEvent': function (eventName, params) {

      var channelName = '';
      var queue = [];
      var storedFragments;
      var message, part, fragments;

      // Iterate the parts of the eventName to create
      // a queue of all channels to trigger event on
      var channelFragments = eventName.split(':');
      while (channelFragments.length) {
        part = channelFragments.shift();
        message = {};
        if (channelName) {
          channelName += ':';
        }
        channelName += part;

        storedFragments = _.rest(storedFragments || channelFragments);
        message.fragments = storedFragments;
        message.channel = channelName;

        queue.push(message);
      }

      // Reverse the queue, to make sure "bubbling"
      // occurs from inside out, up to the parent channel
      queue.reverse();
      while (queue.length) {

        message = queue.shift();
        // Always send the current channel name
        // as the first argument, to be triggered
        fragments = [message.channel];

        // Put the arguments back together with
        // the fragment as the second argument
        // This will work recursively,
        // pushing the fragments onto the arguments
        if (message.fragments.length) {
          fragments.push(message.fragments);
        }
        fragments.push.apply(fragments, params.slice(1));

        Events.trigger.apply(self, fragments);
      }

      var args = [eventName].concat(_.rest(params));
      self.triggered && self.triggered.apply(self, args);
    },

    'off': function (events) {

      var self = this;

      assert.string(events, validationErrors.events);

      // backbone has a funny way of unbinding events, looping
      // the whole list and then applying #on on the events that
      // shouldn't be unbound - so, we have to temporarily replace
      // self's #on, since the on method will re-trigger any
      // published event...
      var _on = self.on;
      self.on = Events.on;
      Events.off.apply(self, arguments);
      self.on = _on;

      return self;
    },

    'once': function () {

      var self = this;
      var args = toArray(arguments);
      var callback = args[1];

      if (typeof callback === 'function') {
        args[1] = function () {
          Events.off.apply(self, args);
          callback.apply(args[2] || self, arguments);
        };
      }

      self.on.apply(self, args);

      return self;
    },

    'publish': function (events) {

      var self = this;
      var args = Array.prototype.slice.call(arguments, 1);

      assert.string(events, validationErrors.events);

      self.iterateOverEvents(events, function (event) {

        if (!self._eventArgsMap[event]) {
          self._eventArgsMap[event] = args;
          var payload = [event].concat(args);
          Events.trigger.apply(self, payload);
        }
      });

      return self;
    },

    'unpublish': function (events) {

      var self = this;

      assert.string(events, validationErrors.events);

      self.iterateOverEvents(events, function (event) {
        delete self._eventArgsMap[event];
      });

      return self;
    },

    'unpublishAll': function () {

      var self = this;
      self._eventArgsMap = {};

      return self;
    },

    'iterateOverEvents': function (events, callback) {

      var eventsArray = events.split(eventSplitter);
      var args = toArray(arguments, 2);
      args.unshift(null);

      while (eventsArray.length) {
        args[0] = eventsArray.shift();
        callback.call(null, args);
      }
    }
  };
});