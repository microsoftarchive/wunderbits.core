
define('wunderbits/core/lib/assert',[],function () {

  

  function assert (condition, message) {
    if (!condition) {
      throw new Error(message || '');
    }
  }

  var nativeIsArray = Array.isArray;
  assert.empty = function (object, message) {
    var keys = nativeIsArray(object) ? object : Object.keys(object);
    assert(keys.length === 0, message);
  };

  assert.array = function (array, message) {
    assert(nativeIsArray(array), message);
  };

  var types = [
    'undefined',
    'boolean',
    'number',
    'string',
    'function',
    'object'
  ];

  function typecheck (type) {
    assert[type] = function (o, message) {
      assert(typeof o === type, message);
    };
  }

  while (types.length) {
    typecheck(types.shift());
  }

  return assert;
});
define('wunderbits/core/lib/merge',[],function () {

  

  return function merge (object, source) {

    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }

    return object;
  };
});
define('wunderbits/core/lib/extend',[
  './assert',
  './merge'
], function (assert, merge) {

  

  return function extend () {

    // convert the argument list into an array
    var args = [].slice.call(arguments);

    // validate input
    assert(args.length > 0, 'extend expect one or more objects');

    // loop through the arguments
    // & merging them recursively
    var object = args.shift();
    while (args.length) {
      merge(object, args.shift());
    }

    return object;
  };
});
define('wunderbits/core/lib/createUID',[],function () {

  

  function replacer (match) {
    var r = Math.random() * 16 | 0;
    var v = (match === 'x') ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  }

  return function createUID () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);
  };
});
// Based on https://github.com/jimmydo/js-toolbox
define('wunderbits/core/WBClass',[

  './lib/extend',
  './lib/createUID'

], function (extend, createUID, undefined) {

  

  // Shared empty constructor function to aid in prototype-chain creation.
  var Constructor = function () {};

  // Helper function to correctly set up the prototype chain, for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var inherits = function (parent, protoProps, staticProps) {

    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call `super()`.
    if (protoProps && protoProps.hasOwnProperty('constructor')) {
      child = protoProps.constructor;
    }
    else {
      child = function () {
        return parent.apply(this, arguments);
      };
    }

    // Inherit class (static) properties from parent.
    extend(child, parent);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function.
    Constructor.prototype = parent.prototype;
    child.prototype = new Constructor();

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    extend(child.prototype, protoProps);

    // Correctly set child's `prototype.constructor`.
    child.prototype.constructor = child;

    // Add static properties to the constructor function, if supplied.
    extend(child, staticProps);

    // Set a convenience property
    // in case the parent's prototype is needed later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Self-propagating extend function.
  // Create a new class,
  // that inherits from the class found in the `this` context object.
  // This function is meant to be called,
  // in the context of a constructor function.
  function extendSelf (protoProps, staticProps) {
    /* jshint validthis:true */

    protoProps = protoProps || {};

    // extract mixins, if any
    var mixins = protoProps.mixins || [];
    delete protoProps.mixins;

    // create the derived class
    var child = inherits(this, protoProps, staticProps);

    // apply mixins to the derived class
    var mixin;
    while (mixins.length) {
      mixin = mixins.shift();
      if (typeof mixin.applyToClass === 'function') {
        mixin.applyToClass(child);
      }
    }

    // make the child class extensible
    child.extend = extendSelf;
    return child;
  }

  function WBClass (options) {

    var self = this;

    // Assign a unique identifier to the instance
    self.uid = createUID();

    // save options, make sure it's at least an empty object
    self.options = options || self.options;

    // initialize the instance
    self.initialize.apply(self, arguments);

    // initialize all the mixins, if needed
    // don't keep this in the initialize,
    // initialize can be overwritten
    self.initMixins.apply(self, arguments);
  }

  extend(WBClass.prototype, {

    'initialize': function () {

      // Return self to allow for subclass to assign
      // super initializer value to self
      var self = this;
      return self;
    },

    // If any mixins were applied to the prototype, initialize them
    'initMixins': function () {

      var self = this;

      var initializers = self.initializers || [];

      var initializer;
      while (initializers.length) {
        initializer = initializers.shift();
        if (typeof initializer === 'function') {
          initializer.apply(self, arguments);
        }
      }
    }
  });

  WBClass.extend = extendSelf;

  return WBClass;
});
define('wunderbits/core/lib/toArray',[],function () {

  

  return function (obj, skip) {
    return [].slice.call(obj, skip || 0);
  };
});
define('wunderbits/core/WBEvents',[

  './lib/assert',
  './lib/toArray'

], function (assert, toArray) {

  

  var eventSplitter = /\s+/;

  var validationErrors = {
    'trigger': 'Cannot trigger event(s) without event name(s)',
    'events': 'Cannot bind/unbind without valid event name(s)',
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
      names = name ? [name] : Object.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        events = this._events[name];
        if (events) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback &&
                   callback !== ev.callback._callback) ||
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
      var args = [].slice.call(arguments, 1);
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

      assert.string(events, validationErrors.trigger);

      var self = this;
      var params = toArray(arguments);
      self.iterateOverEvents(events, self.triggerEvent, params);
      return self;
    },

    'triggerEvent': function (eventName, params) {

      var self = this;
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

        fragments = storedFragments || channelFragments;
        storedFragments = fragments.slice(1);
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

      var args = [eventName].concat(params.slice(1));
      self.triggered && self.triggered.apply(self, args);
    },

    'off': function (events) {

      var self = this;

      events && assert.string(events, validationErrors.events);

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

      var self = this;
      var eventsArray = events.split(eventSplitter);
      var args = toArray(arguments, 2);
      args.unshift(null);

      while (eventsArray.length) {
        args[0] = eventsArray.shift();
        callback.apply(self, args);
      }
    }
  };
});
define('wunderbits/core/WBSingleton',[

  './lib/extend',
  './lib/createUID',
  './WBEvents',
  './WBClass'

], function (extend, createUID, WBEvents, WBClass, undefined) {

  

  var WBSingleton = WBClass.extend({
    'initialize': function () {
      throw new Error('Cannot create instance of singleton class');
    }
  });

  function applyMixins (mixins, instance) {
    var mixin;
    while (mixins.length) {
      mixin = mixins.shift();
      if (typeof mixin.applyTo === 'function') {
        mixin.applyTo(instance);
      }
    }
  }

  WBSingleton.extend = function (staticProps) {

    staticProps = staticProps || {};

    // create a new instance
    var singleton = new WBClass();

    // extend from the base singleton
    var BaseSingleton = this || WBSingleton;
    extend(singleton, BaseSingleton);

    // extract mixins
    var mixins = staticProps.mixins || [];
    staticProps.mixins = undefined;

    // apply mixins to the instance
    applyMixins(mixins, singleton);

    // make the singleton an EventEmitter
    extend(singleton, WBEvents, staticProps);

    // make the singleton extendable
    // Do this after applying mixins,
    // to ensure that no mixin can override `extend` method
    singleton.extend = WBSingleton.extend;

    // every signleton gets a UID
    singleton.uid = createUID();

    return singleton;
  };

  return WBSingleton;
});
define('wunderbits/core/lib/clone',[],function () {

  

  var nativeIsArray = Array.isArray;

  function cloneArray (arr) {
    return arr.slice();
  }

  function cloneObject (source) {
    var object = {};
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }
    return object;
  }

  function clone (obj) {

    if (nativeIsArray(obj)) {
      return cloneArray(obj);
    }

    return cloneObject(obj);
  }

  return clone;

});
define('wunderbits/core/WBMixin',[

  './lib/extend',
  './lib/clone',
  './WBSingleton'

], function (extend, clone, WBSingleton, undefined) {

  

  var WBMixin = WBSingleton.extend({

    // Apply the mixin to an instance of a class
    'applyTo': function (instance) {

      var behavior = clone(this.Behavior);

      // apply mixin's initialize & remove it from the instance
      var initializer;
      if (typeof behavior.initialize === 'function') {
        initializer = behavior.initialize;
        delete behavior.initialize;
      }

      // mixin the behavior
      extend(instance, behavior);

      // apply the initializer, if any
      initializer && initializer.apply(instance);

      return instance;
    },

    // Apply the mixin to the class directly
    'applyToClass': function (klass) {

      var proto = klass.prototype;
      if (!proto || !proto.constructor) {
        throw new Error('applyToClass expects a class');
      }

      var behavior = clone(this.Behavior);

      // cache the mixin's initializer, to be applied later
      var initialize = behavior.initialize;
      if (typeof initialize === 'function') {
        var initializers = proto.initializers = proto.initializers || [];
        initializers.push(initialize);
        delete behavior.initialize;
      }

      // extend the prototype
      extend(proto, behavior);

      return klass;
    }
  });

  // The only real change from a simple singleton is
  // the altered extend class method, which will save
  // "mixinProps" into a specific member, for easy
  // and clean application using #applyTo
  WBMixin.extend = function (mixinProps, staticProps) {

    mixinProps || (mixinProps = {});
    staticProps || (staticProps = {});

    var current = clone(this.Behavior);
    staticProps.Behavior = extend(current, mixinProps);
    var mixin = WBSingleton.extend.call(this, staticProps);

    mixin.extend = WBMixin.extend;

    return mixin;
  };

  return WBMixin;
});