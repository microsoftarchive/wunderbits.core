!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var n;"undefined"!=typeof window?n=window:"undefined"!=typeof global?n=global:"undefined"!=typeof self&&(n=self),(n.wunderbits||(n.wunderbits={})).core=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';

var BaseEmitter = _dereq_('./WBEventEmitter').extend({
  'mixins': [
    _dereq_('./mixins/WBDestroyableMixin'),
    _dereq_('./mixins/WBUtilsMixin'),
    _dereq_('./mixins/ObservableHashMixin')
  ]
});

module.exports = BaseEmitter;

},{"./WBEventEmitter":5,"./mixins/ObservableHashMixin":31,"./mixins/WBDestroyableMixin":33,"./mixins/WBUtilsMixin":36}],2:[function(_dereq_,module,exports){
'use strict';

var BaseSingleton = _dereq_('./WBSingleton').extend({
  'mixins': [
    _dereq_('./mixins/WBEventsMixin'),
    _dereq_('./mixins/WBBindableMixin'),
    _dereq_('./mixins/WBDestroyableMixin'),
    _dereq_('./mixins/WBUtilsMixin'),
    _dereq_('./mixins/ObservableHashMixin')
  ]
});

module.exports = BaseSingleton;

},{"./WBSingleton":8,"./mixins/ObservableHashMixin":31,"./mixins/WBBindableMixin":32,"./mixins/WBDestroyableMixin":33,"./mixins/WBEventsMixin":34,"./mixins/WBUtilsMixin":36}],3:[function(_dereq_,module,exports){
'use strict';

var inherits = _dereq_('./lib/inherits');
var extend = _dereq_('./lib/extend');
var clone = _dereq_('./lib/clone');
var createUID = _dereq_('./lib/createUID');
var fromSuper = _dereq_('./lib/fromSuper');

// Self-propagating extend function.
// Create a new class,
// that inherits from the class found in the `this` context object.
// This function is meant to be called,
// in the context of a constructor function.
function extendSelf (protoProps, staticProps) {
  /* jshint validthis:true */

  var parent = this;

  protoProps = protoProps || {};

  // extract mixins, if any
  var mixins = protoProps.mixins || [];
  delete protoProps.mixins;

  // create the derived class
  var child = inherits(parent, protoProps, staticProps);

  // apply mixins to the derived class
  var mixin;
  while (mixins.length) {
    mixin = mixins.shift();
    (typeof mixin.applyToClass === 'function') &&
      mixin.applyToClass(child);
  }

  // make the child class extensible
  child.extend = parent.extend || extendSelf;
  return child;
}

function WBClass (options) {

  var self = this;

  // Assign a unique identifier to the instance
  self.uid = self.uid || createUID();

  // save options, make sure it's at least an empty object
  self.options = options || self.options;

  // augment properties from mixins
  self.augmentProperties();

  // initialize the instance
  self.initialize.apply(self, arguments);

  // initialize all the mixins, if needed
  // don't keep this in the initialize,
  // initialize can be overwritten
  self.initMixins.apply(self, arguments);
}

var proto = {

  'initialize': function () {

    // Return self to allow for subclass to assign
    // super initializer value to self
    var self = this;
    return self;
  },

  // If any mixins were applied to the prototype, initialize them
  'initMixins': function () {

    var self = this;
    var initializers = fromSuper.concat(self, 'initializers');

    var initializer;
    while (initializers.length) {
      initializer = initializers.shift();
      (typeof initializer === 'function') &&
        initializer.apply(self, arguments);
    }
  },

  // If any proerties were defined in the mixins, augment them to the instance
  'augmentProperties': function () {

    var self = this;
    var properties = fromSuper.merge(self, 'properties');

    function augmentProperty (property, value) {

      var type = typeof value;

      if (type === 'function') {
        self[property] = value.call(self);
      }
      else if (type === 'object') {
        self[property] = clone(value, true);
      }
      else {
        self[property] = value;
      }
    }

    for (var key in properties) {
      augmentProperty(key, properties[key]);
    }
  }
};

extend(WBClass.prototype, proto);
WBClass.extend = extendSelf;

module.exports = WBClass;

},{"./lib/clone":12,"./lib/createUID":13,"./lib/extend":18,"./lib/fromSuper":20,"./lib/inherits":23}],4:[function(_dereq_,module,exports){
'use strict';

var WBClass = _dereq_('./WBClass');
var WBPromise = _dereq_('./WBPromise');
var assert = _dereq_('./lib/assert');
var toArray = _dereq_('./lib/toArray');

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

  'constructor': function (context) {
    var self = this;
    self._context = context;
    self._state = states.pending;
    self._args = [];
    self.handlers = [];
  },

  'state': function () {
    var self = this;
    return stateNames[self._state][0];
  },

  'trigger': function (withContext) {

    var self = this;
    if (self._state === states.pending) {
      return;
    }

    var handlers = self.handlers, handle;
    while (handlers.length) {
      handle = handlers.shift();
      self.invoke(handle, withContext || self._context);
    }
  },

  'invoke': function (deferredResponse, withContext) {

    var self = this;
    var state = self._state;
    var context = deferredResponse.context || withContext || self;
    var args = deferredResponse.args;

    self._args.forEach(function (arg) {
      // send single arguments as the item, otherwise send it as an array
      args.push(arg);
    });

    var type = deferredResponse.type;
    var isCompleted = (type === 'then') ||
      (type === 'done' && state === states.resolved) ||
      (type === 'fail' && state === states.rejected);

    isCompleted && deferredResponse.fn.apply(context, args);
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

    // store references to the context, callbacks, and arbitrary arguments
    var args = toArray(arguments);
    var fn = args.shift();
    var context = args.shift();

    assert.function(fn, method + ' accepts only functions');

    self.handlers.push({
      'type': method,
      'context': context,
      'fn': fn,
      'args': args
    });

    // if the defered is not pending anymore, call the callbacks
    self.trigger();

    return self;
  };
});

// Alias `always` to `then` on Deferred's prototype
proto.always = proto.then;

function resolver (state, isWith, fnName) {
  return function complete () {

    var self = this;

    if (!(self instanceof WBDeferred)) {
      throw new Error(fnName + ' invoked with wrong context');
    }

    // can't change state once resolved or rejected
    if (self._state !== states.pending) {
      return self;
    }

    self._args = toArray(arguments);
    var context = isWith ? self._args.shift() : undefined;

    self._state = state;
    self.trigger(context);

    return self;
  };
}

[states.resolved, states.rejected].forEach(function (state) {
  var fnName = stateNames[state][1];
  proto[fnName] = resolver(state, false, fnName);
  proto[fnName + 'With'] = resolver(state, true, fnName);
});

var WBDeferred = WBClass.extend(proto);
module.exports = WBDeferred;

},{"./WBClass":3,"./WBPromise":7,"./lib/assert":11,"./lib/toArray":27}],5:[function(_dereq_,module,exports){
'use strict';

var WBEventEmitter = _dereq_('./WBClass').extend({
  'mixins': [
    _dereq_('./mixins/WBBindableMixin'),
    _dereq_('./mixins/WBEventsMixin')
  ]
});

module.exports = WBEventEmitter;

},{"./WBClass":3,"./mixins/WBBindableMixin":32,"./mixins/WBEventsMixin":34}],6:[function(_dereq_,module,exports){
'use strict';

var extend = _dereq_('./lib/extend');
var clone = _dereq_('./lib/clone');
var assert = _dereq_('./lib/assert');
var WBSingleton = _dereq_('./WBSingleton');

var WBMixin = WBSingleton.extend({

  // Apply the mixin to an instance of a class
  'applyTo': function (instance) {

    var behavior = clone(this.Behavior, true);

    // apply mixin's initialize & remove it from the instance
    var initializer;
    if (typeof behavior.initialize === 'function') {
      initializer = behavior.initialize;
      delete behavior.initialize;
    }

    // augment mixin's properties object into the instance
    var properties = behavior.properties;
    delete behavior.properties;

    // mixin the behavior
    extend(instance, behavior);

    // apply the initializer, if any
    initializer && initializer.apply(instance);

    // augment proerties to the instance
    properties && extend(instance, properties);

    return instance;
  },

  // Apply the mixin to the class directly
  'applyToClass': function (klass) {

    // validate class
    assert.class(klass, 'applyToClass expects a class');

    var proto = klass.prototype;
    var behavior = clone(this.Behavior, true);

    // cache the mixin's initializer, to be applied later
    var initialize = behavior.initialize;
    if (typeof initialize === 'function') {
      (!proto.hasOwnProperty('initializers')) && (proto.initializers = []);
      proto.initializers.push(initialize);
      delete behavior.initialize;
    }

    var properties = behavior.properties;
    delete behavior.properties;

    // extend the prototype
    extend(proto, behavior);

    // cache the properties, to be applied later
    (!proto.hasOwnProperty('properties')) && (proto.properties = {});
    properties && extend(proto.properties, properties);

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

  var current = clone(this.Behavior, true);
  staticProps.Behavior = extend(current, mixinProps);
  var mixin = WBSingleton.extend.call(this, staticProps);

  mixin.extend = WBMixin.extend;

  return mixin;
};

module.exports = WBMixin;

},{"./WBSingleton":8,"./lib/assert":11,"./lib/clone":12,"./lib/extend":18}],7:[function(_dereq_,module,exports){
'use strict';

var WBClass = _dereq_('./WBClass');

function proxy (name) {
  return function () {
    var deferred = this.deferred;
    deferred[name].apply(deferred, arguments);
    return this;
  };
}

var proto = {
  'constructor': function (deferred) {
    this.deferred = deferred;
  },

  'promise': function () {
    return this;
  },

  'state': function () {
    return this.deferred.state();
  }
};

[
  'done',
  'fail',
  'then'
].forEach(function (name) {
  proto[name] = proxy(name);
});

proto.always = proto.then;

module.exports = WBClass.extend(proto);

},{"./WBClass":3}],8:[function(_dereq_,module,exports){
'use strict';

var extend = _dereq_('./lib/extend');
var createUID = _dereq_('./lib/createUID');

function applyMixins (mixins, instance) {
  var mixin;
  while (mixins.length) {
    mixin = mixins.shift();
    (typeof mixin.applyTo === 'function') &&
      mixin.applyTo(instance);
  }
}

function extendSelf (staticProps) {
  /* jshint validthis:true */

  staticProps = staticProps || {};

  // extend from the base singleton
  var BaseSingleton = this || WBSingleton;

  // create a new instance
  Ctor.prototype = BaseSingleton;
  var singleton = new Ctor();

  // extract mixins
  var mixins = staticProps.mixins || [];
  staticProps.mixins = undefined;

  // apply mixins to the instance
  applyMixins(mixins, singleton);

  // append the static properties to the singleton
  extend(singleton, staticProps);

  // make the singleton extendable
  // Do this after applying mixins,
  // to ensure that no mixin can override `extend` method
  singleton.extend = extendSelf;

  // every signleton gets a UID
  singleton.uid = createUID();

  return singleton;
}

var Ctor = function () {};
Ctor.prototype = {
  'extend': extendSelf
};

var WBSingleton = new Ctor();
module.exports = WBSingleton;

},{"./lib/createUID":13,"./lib/extend":18}],9:[function(_dereq_,module,exports){
'use strict';

var WBClass = _dereq_('./WBClass');

var WBDestroyableMixin = _dereq_('./mixins/WBDestroyableMixin');
var originalDestroy = WBDestroyableMixin.Behavior.destroy;

var WBStateModel = WBClass.extend({

  'mixins': [
    _dereq_('./mixins/WBEventsMixin'),
    _dereq_('./mixins/WBStateMixin'),
    _dereq_('./mixins/WBBindableMixin'),
    WBDestroyableMixin
  ],

  'initialize': function (attributes) {

    var self = this;

    if (attributes) {
      self.attributes = attributes;
    }
  },

  'sync':  function (method, instance, options) {
    if (options && typeof options.success === 'function') {
      options.success();
    }
  },

  'fetch': function (options) {
    var self = this;
    var success = options.success;
    var model = this;
    options.success = function (resp) {
      if (!model.set(resp, options)) return false;
      if (success) success(model, resp, options);
      model.trigger('sync', model, resp, options);
    };
    return self.sync('read', self, options);
  },

  'save': function (key, val, options) {

    var self = this;
    if (!self.destroying) {
      // set the attributes
      self.set(key, val, options);
      // sync
      (typeof key === 'object') && (options = val);
      self.sync('update', self, options);
    }
    return self;
  },

  'destroy': function (options) {

    var self = this;
    if (!self.destroying) {
      self.destroying = true;
      originalDestroy.call(self, options);
      self.attributes = {};
      self.sync('delete', self, options);
    }
  }
});

module.exports = WBStateModel;

},{"./WBClass":3,"./mixins/WBBindableMixin":32,"./mixins/WBDestroyableMixin":33,"./mixins/WBEventsMixin":34,"./mixins/WBStateMixin":35}],10:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  'lib': _dereq_('./lib'),
  'BaseEventEmitter': _dereq_('./BaseEventEmitter'),
  'BaseSingleton': _dereq_('./BaseSingleton'),
  'WBClass': _dereq_('./WBClass'),
  'WBDeferred': _dereq_('./WBDeferred'),
  'WBEventEmitter': _dereq_('./WBEventEmitter'),
  'WBMixin': _dereq_('./WBMixin'),
  'WBSingleton': _dereq_('./WBSingleton'),
  'WBStateModel': _dereq_('./WBStateModel'),
  'mixins': _dereq_('./mixins')
};

},{"./BaseEventEmitter":1,"./BaseSingleton":2,"./WBClass":3,"./WBDeferred":4,"./WBEventEmitter":5,"./WBMixin":6,"./WBSingleton":8,"./WBStateModel":9,"./lib":22,"./mixins":37}],11:[function(_dereq_,module,exports){
'use strict';

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

assert.class = function (klass, message) {
  var proto = klass.prototype;
  assert(proto && proto.constructor === klass, message);
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

module.exports = assert;
},{}],12:[function(_dereq_,module,exports){
'use strict';

var nativeIsArray = Array.isArray;

function cloneArray (arr, isDeep) {
  arr = arr.slice();
  if (isDeep) {
    var newArr = [], value;
    while (arr.length) {
      value = arr.shift();
      value = (value instanceof Object) ? clone(value, isDeep) : value;
      newArr.push(value);
    }
    arr = newArr;
  }
  return arr;
}

function cloneDate (date) {
  return new Date(date);
}

function cloneObject (source, isDeep) {
  var object = {};
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      var value = source[key];
      if (value instanceof Date) {
        object[key] = cloneDate(value);
      } else if (typeof value === 'object' && value !== null && isDeep) {
        object[key] = clone(value, isDeep);
      } else {
        object[key] = value;
      }
    }
  }
  return object;
}

function clone (obj, isDeep) {

  if (nativeIsArray(obj)) {
    return cloneArray(obj, isDeep);
  }

  return cloneObject(obj, isDeep);
}

module.exports = clone;

},{}],13:[function(_dereq_,module,exports){
'use strict';

function replacer (match) {
  var rand = Math.random() * 16 | 0;
  var chr = (match === 'x') ? rand : (rand & 0x3 | 0x8);
  return chr.toString(16);
}

function createUID (prefix) {
  var uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);
  return String(!prefix ? '' : prefix) + uid;
}

module.exports = createUID;

},{}],14:[function(_dereq_,module,exports){
'use strict';

// Returns a function, that, as long as it continues to be invoked, will not
// be triggered. The function will be called after it stops being called for
// N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing.
// From: http://davidwalsh.name/function-debounce
function debounce (fn, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) {
        fn.apply(context, args);
      }
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      fn.apply(context, args);
    }
  };
}

module.exports = debounce;
},{}],15:[function(_dereq_,module,exports){
'use strict';

var toArray = _dereq_('./toArray');
var delay = _dereq_('./delay');

function defer (fn) {
  var args = toArray(arguments);
  args[0] = 1;
  args.unshift(fn);
  return delay.apply(null, args);
}

module.exports = defer;

},{"./delay":16,"./toArray":27}],16:[function(_dereq_,module,exports){
'use strict';

var toArray = _dereq_('./toArray');

function delay (fn, time, context) {
  var args = toArray(arguments, 3);
  return setTimeout(function () {

    var destroyed = context && context.destroyed;
    !destroyed && fn.apply(context, args);
  }, time);
}

module.exports = delay;

},{"./toArray":27}],17:[function(_dereq_,module,exports){
'use strict';

var assert = _dereq_('./assert');
var toArray = _dereq_('./toArray');
var clone = _dereq_('./clone');

var eventSplitter = /\s+/;

var validationErrors = {
  'trigger': 'Cannot trigger event(s) without event name(s)',
  'events': 'Cannot bind/unbind without valid event name(s)',
  'callback': 'Cannot bind/unbind to an event without valid callback function'
};

var events = {

  'properties': {
    '_events': {},
    '_cache': {}
  },

  'on': function (events, callback, context) {

    var self = this;

    // validate arguments
    assert.string(events, validationErrors.events);
    assert.function(callback, validationErrors.callback);

    // loop through the events & bind them
    self.iterate(events, function (name) {
      // keep the binding
      self.bind(name, callback, context);

      // if this was a published event, do an immediate trigger
      var cache = self._cache;
      if (cache[name]) {
        callback.apply(context || self, cache[name]);
      }
    });

    return self;
  },

  'off': function (events, callback, context) {

    var self = this;

    // validate events only if a truthy value is passed
    events && assert.string(events, validationErrors.events);

    // if no arguments were passed, unbind everything
    if (!events && !callback && !context) {
      self._events = {};
      return self;
    }

    // if no events are passed, unbind all events with this callback
    events = events || Object.keys(self._events);

    // loop through the events & bind them
    self.iterate(events, function (name) {
      self.unbind(name, callback, context);
    });

    return self;
  },

  'once': function (events, callback, context) {

    var self = this;
    var args = toArray(arguments);

    // create a one time binding
    args[1] = function () {
      self.off.apply(self, args);
      callback.apply(context || self, arguments);
    };

    self.on.apply(self, args);

    return self;
  },

  'publish': function (events) {

    var self = this;
    var args = toArray(arguments);

    // validate events
    assert.string(events, validationErrors.events);

    self.iterate(events, function (name) {
      var cache = self._cache;
      if (!cache[name]) {
        cache[name] = args.slice(1);
        args[0] = name;
        self.trigger.apply(self, args);
      }
    });

    return self;
  },

  'unpublish': function (events) {

    var self = this;

    // validate events
    assert.string(events, validationErrors.events);

    // remove the cache for the events
    self.iterate(events, function (name) {
      self._cache[name] = undefined;
    });

    return self;
  },

  'unpublishAll': function () {
    var self = this;
    self._cache = {};
    return self;
  },

  'trigger': function (events) {

    var self = this;

    // validate arguments
    assert.string(events, validationErrors.trigger);

    // loop through the events & trigger them
    var params = toArray(arguments, 1);
    self.iterate(events, function (name) {
      self.triggerEvent(name, params);
    });

    return self;
  },

  'triggerEvent': function (name, params) {

    var self = this;
    var events = self._events || {};

    // call sub-event handlers
    var current = [];
    var fragments = name.split(':');
    while (fragments.length) {
      current.push(fragments.shift());
      name = current.join(':');
      if (name in events) {
        self.triggerSection(name, fragments, params);
      }
    }
  },

  'triggerSection': function (name, fragments, params) {

    var self = this;
    var events = self._events || {};
    var bucket = events[name] || [];

    bucket.forEach(function (item) {
      var args;
      if (fragments.length) {
        args = clone(params);
        args.unshift(fragments);
      }
      item.callback.apply(item.context || self, args || params);
    });
  },

  'iterate': function (events, iterator) {

    var self = this;

    if (typeof events === 'string') {
      events = events.split(eventSplitter);
    } else {
      assert.array(events);
    }

    while (events.length) {
      iterator.call(self, events.shift());
    }
  },

  'bind': function (name, callback, context) {

    var self = this;

    // store the reference to the callback + context
    var events = self._events || {};
    var bucket = events[name] || (events[name] = []);
    bucket.push({
      'callback': callback,
      'context': context
    });

    return self;
  },

  'unbind': function (name, callback, context) {

    var self = this;

    // lookup the reference to handler & remove it
    var events = self._events;
    var bucket = events[name] || [];
    var retain = [];

    // loop through the handlers
    var i = -1, l = bucket.length, item;
    while (++i < l) {
      item = bucket[i];
      if ((callback && callback !== item.callback) ||
          (context && context !== item.context)) {
        retain.push(item);
      }
    }

    // flush out detached handlers
    events[name] = retain;

    return self;
  }
};

module.exports = events;

},{"./assert":11,"./clone":12,"./toArray":27}],18:[function(_dereq_,module,exports){
'use strict';

var toArray = _dereq_('./toArray');
var merge = _dereq_('./merge');
var assert = _dereq_('./assert');

function extend () {

  // convert the argument list into an array
  var args = toArray(arguments);

  // validate input
  assert(args.length > 0, 'extend expect one or more objects');

  // loop through the arguments
  // & merging them recursively
  var object = args.shift();
  while (args.length) {
    merge(object, args.shift());
  }

  return object;
}

module.exports = extend;

},{"./assert":11,"./merge":25,"./toArray":27}],19:[function(_dereq_,module,exports){
'use strict';

function forArray (array, iterator, context) {
  for (var i = 0, l = array.length; i < l; i++) {
    if (iterator.call(context, array[i], i, array) === false) {
      return;
    }
  }
}

function forObject (object, iterator, context) {
  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      if (iterator.call(context, object[key], key) === false) {
        return;
      }
    }
  }
}

function forEach (collection, iterator, context) {
  var handler = Array.isArray(collection) ? forArray : forObject;
  handler(collection, iterator, context);
}

module.exports = forEach;

},{}],20:[function(_dereq_,module,exports){
'use strict';

var merge = _dereq_('./merge');
var extend = _dereq_('./extend');

function mergeFromSuper (instance, key) {

  var constructor = instance.constructor;
  var proto = constructor.prototype;

  var baseData = {};
  if (instance.hasOwnProperty(key)) {
    baseData = instance[key];
  } else if (proto.hasOwnProperty(key)) {
    baseData = proto[key];
  }

  var _super = constructor && constructor.__super__;
  if (_super) {
    baseData = merge(mergeFromSuper(_super, key), baseData);
  }

  return extend({}, baseData);
}

function concatFromSuper (instance, key) {

  var constructor = instance.constructor;
  var proto = constructor.prototype;

  var baseData = [];
  if (instance.hasOwnProperty(key)) {
    baseData = instance[key];
  } else if (proto.hasOwnProperty(key)) {
    baseData = proto[key];
  }

  var _super = constructor && constructor.__super__;
  if (_super) {
    baseData = [].concat(concatFromSuper(_super, key), baseData);
  }

  return [].concat(baseData);
}

module.exports = {
  'merge': mergeFromSuper,
  'concat': concatFromSuper
};

},{"./extend":18,"./merge":25}],21:[function(_dereq_,module,exports){
'use strict';

function functions (obj) {
  var funcs = [];
  for (var key in obj) {
    if (typeof obj[key] === 'function') {
      funcs.push(key);
    }
  }
  return funcs;
}

module.exports = functions;

},{}],22:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  'assert': _dereq_('./assert'),
  'clone': _dereq_('./clone'),
  'createUID': _dereq_('./createUID'),
  'debounce': _dereq_('./debounce'),
  'defer': _dereq_('./defer'),
  'delay': _dereq_('./delay'),
  'events': _dereq_('./events'),
  'extend': _dereq_('./extend'),
  'forEach': _dereq_('./forEach'),
  'fromSuper': _dereq_('./fromSuper'),
  'functions': _dereq_('./functions'),
  'inherits': _dereq_('./inherits'),
  'isEqual': _dereq_('./isEqual'),
  'merge': _dereq_('./merge'),
  'size': _dereq_('./size'),
  'toArray': _dereq_('./toArray'),
  'when': _dereq_('./when'),
  'where': _dereq_('./where')
};
},{"./assert":11,"./clone":12,"./createUID":13,"./debounce":14,"./defer":15,"./delay":16,"./events":17,"./extend":18,"./forEach":19,"./fromSuper":20,"./functions":21,"./inherits":23,"./isEqual":24,"./merge":25,"./size":26,"./toArray":27,"./when":28,"./where":29}],23:[function(_dereq_,module,exports){
'use strict';

var extend = _dereq_('./extend');

// Helper function to correctly set up the prototype chain, for subclasses.
// Similar to `goog.inherits`, but uses a hash of prototype properties and
// class properties to be extended.
function inherits (parent, protoProps, staticProps) {

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
  child.prototype = Object.create(parent.prototype);

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
}

module.exports = inherits;

},{"./extend":18}],24:[function(_dereq_,module,exports){
'use strict';

// TODO: implement deepEqual
function isEqual (a, b) {
  return a === b;
}

module.exports = isEqual;

},{}],25:[function(_dereq_,module,exports){
'use strict';

var toArray = _dereq_('./toArray');

function merge (object, source) {
  var sources = toArray(arguments, 1);
  while (sources.length) {
    source = sources.shift();
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        object[key] = source[key];
      }
    }
  }
  return object;
}

module.exports = merge;

},{"./toArray":27}],26:[function(_dereq_,module,exports){
'use strict';

function size (collection) {
  !Array.isArray(collection) && (collection = Object.keys(collection));
  return collection.length;
}

module.exports = size;

},{}],27:[function(_dereq_,module,exports){
'use strict';

var slice = Array.prototype.slice;
function toArray (obj, skip) {
  return slice.call(obj, skip || 0);
}

module.exports = toArray;

},{}],28:[function(_dereq_,module,exports){
'use strict';

var WBDeferred = _dereq_('../WBDeferred');
var toArray = _dereq_('./toArray');

function When () {

  var context = this;
  var main = new WBDeferred(context);
  var deferreds = toArray(arguments);

  // support passing an array of deferreds, to avoid `apply`
  if (deferreds.length === 1 && Array.isArray(deferreds[0])) {
    deferreds = deferreds[0];
  }

  var count = deferreds.length;
  var args = new Array(count);

  function Fail () {
    main.rejectWith(this);
  }

  function Done () {

    if (main.state() === 'rejected') {
      return;
    }

    var index = count - deferreds.length - 1;
    args[index] = toArray(arguments);

    if (deferreds.length) {
      var next = deferreds.shift();
      next.done(Done);
    } else {
      args.unshift(this);
      main.resolveWith.apply(main, args);
    }
  }

  if (deferreds.length) {

    deferreds.forEach(function (deferred) {
      deferred.fail(Fail);
    });

    var current = deferreds.shift();
    current.done(Done);
  } else {
    main.resolve();
  }

  return main.promise();
}

module.exports = When;

},{"../WBDeferred":4,"./toArray":27}],29:[function(_dereq_,module,exports){
'use strict';

var forEach = _dereq_('./forEach');

function where (collection, properties) {
  var matches = [];
  forEach(collection, function (item) {
    for (var key in properties) {
      if (item[key] !== properties[key]) {
        return;
      }
      matches.push(item);
    }
  });
  return matches;
}

module.exports = where;

},{"./forEach":19}],30:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var fromSuper = _dereq_('../lib/fromSuper');

var ControllableMixin = WBMixin.extend({

  'initialize': function () {

    var self = this;

    self.controllers = [];
    self.implemented = [];

    self.implements = fromSuper.concat(self, 'implements');
    self.createControllerInstances();

    self.bindOnceTo(self, 'destroy', 'destroyControllers');
  },

  'createControllerInstances': function () {

    var self = this;

    var Controllers = self.implements;
    if (typeof Controllers === 'function') {
      Controllers = Controllers.call(self);
    }
    Controllers.reverse();

    var ControllerClass, controllerInstance, i;
    for (i = Controllers.length; i--;) {
      ControllerClass = Controllers[i];

      // If we have already implemented a controller that inherits from
      // this controller, we don't need another one...
      if (self.implemented.indexOf(ControllerClass.toString()) < 0) {

        controllerInstance = new ControllerClass(self);
        self.controllers.push(controllerInstance);
        controllerInstance.parent = self;

        self.trackImplementedSuperConstructors(ControllerClass);
      }
    }

    return self.implemented;
  },

  'trackImplementedSuperConstructors': function (Controller) {

    var self = this;
    var _super = Controller.__super__;
    var superConstructor = _super && _super.constructor;

    if (superConstructor) {
      self.implemented.push(superConstructor.toString());
      self.trackImplementedSuperConstructors(superConstructor);
    }
  },

  'destroyControllers': function () {

    var self = this;

    // Loop and destroy
    var controller;
    var controllers = self.controllers;

    while (controllers.length) {
      // A controller can exist multiple times in the list,
      // since it's based on the event name,
      // so make sure to only destroy each one once
      controller = controllers.shift();
      controller.destroyed || controller.destroy();
    }
  }
});

module.exports = ControllableMixin;

},{"../WBMixin":6,"../lib/fromSuper":20}],31:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var fromSuper = _dereq_('../lib/fromSuper');
var clone = _dereq_('../lib/clone');

var ObservableHashMixin = WBMixin.extend({

  'initialize': function () {

    var self = this;

    var observesHash = fromSuper.merge(self, 'observes');
    for (var target in observesHash) {
      self.bindToTarget(self.resolveTarget(target), observesHash[target]);
    }
  },

  'bindToTarget': function (target, events) {

    var self = this;

    for (var eventString in events) {
      self.bindHandlers(target, eventString, events[eventString]);
    }
  },

  'bindHandlers': function (target, eventString, handlers) {

    var self = this;

    if (typeof handlers === 'string') {
      handlers = [handlers];
    } else {
      handlers = clone(handlers);
    }

    while (handlers.length) {
      self.bindTo(target, eventString, handlers.shift());
    }
  },

  'resolveTarget': function (key) {

    var self = this;

    // allow observing self
    if (key === 'self') {
      return self;
    }

    var target = self[key];
    if (!target && typeof key === 'string' && key.indexOf('.') > -1) {
      key = key.split('.');
      target = self;
      while (key.length && target) {
        target = target[key.shift()];
      }
    }

    return target;
  }

});

module.exports = ObservableHashMixin;

},{"../WBMixin":6,"../lib/clone":12,"../lib/fromSuper":20}],32:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
// var assert = require('../lib/assert');
var createUID = _dereq_('../lib/createUID');

var WBBindableMixin = WBMixin.extend({

  'properties': {
    '_bindings': {},
    '_namedEvents': {}
  },

  // keeps callback closure in own execution context with
  // only callback and context
  'callbackFactory': function  (callback, context) {

    var bindCallback;

    var forString = function stringCallback () {
      context[callback].apply(context, arguments);
    };

    var forFunction = function functionCallback () {
      callback.apply(context, arguments);
    };

    if (typeof callback === 'string') {
      bindCallback = forString;
      // cancel alternate closure immediately
      forFunction = null;
    }
    else {
      bindCallback = forFunction;
      forString = null;
    }

    return bindCallback;
  },

  'bindTo': function (target, event, callback, context) {

    var self = this;
    self.checkBindingArgs.apply(self, arguments);

    // default to self if context not provided
    context = context || self;

    // if this binding already made, return it
    var bound = self.isAlreadyBound(target, event, callback, context);
    if (bound) {
      return bound;
    }


    var callbackFunc, args;

    // if a jquery object
    if (target.constructor && target.constructor.fn && target.constructor.fn.on === target.on) {
      // jquery does not take context in .on()
      // cannot assume on takes context as a param for bindable object
      // create a callback which will apply the original callback in the correct context
      callbackFunc = self.callbackFactory(callback, context);
      args = [event, callbackFunc];
    } else {
      // Backbone accepts context when binding, simply pass it on
      callbackFunc = (typeof callback === 'string') ? context[callback] : callback;
      args = [event, callbackFunc, context];
    }

    // create binding on target
    target.on.apply(target, args);

    var binding = {
      'uid': createUID(),
      'target': target,
      'event': event,
      'originalCallback': callback,
      'callback': callbackFunc,
      'context': context
    };

    self._bindings[binding.uid] = binding;
    self.addToNamedBindings(event, binding);

    return binding;
  },

  'bindOnceTo': function (target, event, callback, context) {

    var self = this;
    self.checkBindingArgs.apply(self, arguments);

    context = context || self;

    // if this binding already made, return it
    var bound = self.isAlreadyBound(target, event, callback, context);
    if (bound) {
      return bound;
    }


    // this is a wrapper
    var onceBinding = function () {

      ((typeof callback === 'string') ? context[callback] : callback).apply(context, arguments);
      self.unbindFrom(binding);
    };

    var binding = {
      'uid': createUID(),
      'target': target,
      'event': event,
      'originalCallback': callback,
      'callback': onceBinding,
      'context': context
    };

    target.on(event, onceBinding, context);

    self._bindings[binding.uid] = binding;
    self.addToNamedBindings(event, binding);

    return binding;
  },

  'unbindFrom': function (binding) {

    var self = this;

    var uid = binding && binding.uid;
    if (!binding || (typeof uid !== 'string')) {
      throw new Error('Cannot unbind from undefined or invalid binding');
    }

    var event = binding.event;
    var context = binding.context;
    var callback = binding.callback;
    var target = binding.target;

    // a binding object with only uid, i.e. a destroyed/unbound
    // binding object has been passed - just do nothing
    if (!event || !callback || !target || !context) {
      return;
    }

    target.off(event, callback, context);

    // clean up binding object, but keep uid to
    // make sure old bindings, that have already been
    // cleaned, are still recognized as bindings
    for (var key in binding) {
      if (key !== 'uid') {
        delete binding[key];
      }
    }

    delete self._bindings[uid];

    var namedEvents = self._namedEvents;
    var events = namedEvents[event];

    if (events) {
      var cloned = events && events.slice(0);
      for (var i = events.length - 1; i >= 0; i--) {
        if (events[i].uid === uid) {
          cloned.splice(i, 1);
        }
      }

      namedEvents[event] = cloned;
    }

    return;
  },

  'unbindFromTarget': function (target) {

    var self = this;

    if (!target || (typeof target.on !== 'function')) {
      throw new Error('Cannot unbind from undefined or invalid binding target');
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

    var binding;
    for (var key in self._bindings) {
      binding = self._bindings[key];
      self.unbindFrom(binding);
    }
  },

  'checkBindingArgs': function (target, event, callback, context) {

    context = context || this;

    // do not change these messages without updating the specs
    if (!target || (typeof target.on !== 'function')) {
      throw new Error('Cannot bind to undefined target or target without #on method');
    }

    if (!event || (typeof event !== 'string')) {
      throw new Error('Cannot bind to target event without event name');
    }

    if (!callback || ((typeof callback !== 'function') && (typeof callback !== 'string'))) {
      throw new Error('Cannot bind to target event without a function or method name as callback');
    }

    if ((typeof callback === 'string') && !context[callback]) {
      throw new Error('Cannot bind to target using a method name that does not exist for the context');
    }
  },

  'isAlreadyBound': function (target, event, callback, context) {

    var self = this;
    // check for same callback on the same target instance
    // return early withthe event binding
    var events = self._namedEvents[event];
    if (events) {
      for (var i = 0, max = events.length; i < max; i++) {

        var current = events[i] || {};

        // the below !boundTarget check seems unreachable
        // was added in this commit of the web app: c75d5077c0a8629b60cb6dd1cd78d3bc77fcac48
        // need to ask Adam under what conditions this would be possible
        var boundTarget = current.target;
        if (!boundTarget) {
          return false;
        }

        var targetBound = target.uid ? target.uid === boundTarget.uid : false;
        if (current.originalCallback === callback &&
            current.context === context && targetBound) {
          return current;
        }
      }
    }

    return false;
  },

  'addToNamedBindings': function (event, binding) {

    var self = this;
    if (!self._namedEvents[event]) {
      self._namedEvents[event] = [];
    }
    self._namedEvents[event].push(binding);
  }
});

module.exports = WBBindableMixin;

},{"../WBMixin":6,"../lib/createUID":13}],33:[function(_dereq_,module,exports){
'use strict';

var forEach = _dereq_('../lib/forEach');
var WBMixin = _dereq_('../WBMixin');

function noop () {}

function Call (fn) {
  var self = this;
  (typeof fn === 'string') && (fn = self[fn]);
  (typeof fn === 'function') && fn.call(self);
}

var cleanupMethods = ['unbind', 'unbindAll', 'onDestroy'];

var WBDestroyableMixin = WBMixin.extend({

  'destroy': function () {

    var self = this;

    self.trigger('destroy');

    // clean up
    forEach(cleanupMethods, Call, self);

    self.destroyObject(self);

    self.destroyed = true;
  },

  'destroyObject': function (object) {

    var self = this;
    for (var key in object) {
      self.destroyKey(key, object);
    }
  },

  'destroyKey': function (key, context) {

    if (context.hasOwnProperty(key) && key !== 'uid' && key !== 'cid') {
      // make functions noop
      if (typeof context[key] === 'function') {
        context[key] = noop;
      }
      // and others undefined
      else {
        context[key] = undefined;
      }
    }
  }
});

module.exports = WBDestroyableMixin;

},{"../WBMixin":6,"../lib/forEach":19}],34:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var events = _dereq_('../lib/events');

var WBEventsMixin = WBMixin.extend(events);

module.exports = WBEventsMixin;

},{"../WBMixin":6,"../lib/events":17}],35:[function(_dereq_,module,exports){
'use strict';

var clone = _dereq_('../lib/clone');
var merge = _dereq_('../lib/merge');
var extend = _dereq_('../lib/extend');
var isEqual = _dereq_('../lib/isEqual');
var WBMixin = _dereq_('../WBMixin');

var WBStateMixin = WBMixin.extend({

  'attributes': {},
  'options': {},

  'initialize': function (attributes, options) {

    var self = this;
    self.attributes = extend({}, self.defaults, attributes);
    self.options = options || {};
    self.changed = {};
  },

  'get': function (key) {
    console.warn('getters are deprecated');
    return this.attributes[key];
  },

  'set': function (key, val, options) {

    var self = this;
    if (key === null) {
      return self;
    }

    var attrs, attr;
    // Handle both `"key", value` and `{key: value}` -style arguments.
    if (typeof key === 'object') {
      attrs = key;
      options = val;
    } else {
      attrs = {};
      attrs[key] = val;
    }

    // default options are empty
    options || (options = {});

    // no need to track changes on options.silent
    if (options.silent) {
      merge(self.attributes, attr);
    }
    // For each `set` attribute, update or delete the current value.
    else {
      var changes = self.changes(attrs, options);
      self._trigger(attrs, changes, options);
    }

    return self;
  },

  'unset': function (attr, options) {
    return this.set(attr, undefined, extend({}, options, { 'unset': true }));
  },

  'clear': function (options) {
    var self = this;
    return self.set(self.defaults, options);
  },

  'changes': function (attrs, options) {

    var self = this;
    var key, val;
    var changes = [];

    var prev = clone(self.attributes, true);
    var current = self.attributes;
    self.changed = {};

    for (key in attrs) {
      val = attrs[key];
      if (!isEqual(current[key], val)) {
        changes.push(key);
      }
      if (!isEqual(prev[key], val)) {
        self.changed[key] = val;
      } else {
        delete self.changed[key];
      }

      current[key] = options.unset ? undefined : val;
    }

    return changes;
  },

  '_trigger': function (attrs, changes, options) {

    var self = this;
    var current = self.attributes;

    // if any changes found
    // & if this is an EventEmitter,
    // trigger the change events
    var attr;
    while (changes && changes.length && self.trigger) {
      attr = changes.shift();
      self.trigger('change:' + attr, self, current[attr], options);
    }
  }
});

module.exports = WBStateMixin;

},{"../WBMixin":6,"../lib/clone":12,"../lib/extend":18,"../lib/isEqual":24,"../lib/merge":25}],36:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var WBDeferred = _dereq_('../WBDeferred');
var when = _dereq_('../lib/when');
var toArray = _dereq_('../lib/toArray');
var forEach = _dereq_('../lib/forEach');
var delay = _dereq_('../lib/delay');
var defer = _dereq_('../lib/defer');
var functions = _dereq_('../lib/functions');

var WBUtilsMixin = WBMixin.extend({

  'deferred': function () {
    var self = this;
    return new WBDeferred(self);
  },

  'when': function () {
    var self = this;
    return when.apply(self, arguments);
  },

  'defer': function (fn) {
    var self = this;
    var args = toArray(arguments);
    // default context to self
    args[1] = args[1] || this;
    // support string names of functions on self
    (typeof fn === 'string') && (args[0] = self[fn]);
    return defer.apply(null, args);
  },

  'delay': function (fn) {
    var self = this;
    var args = toArray(arguments);
    // default context to self
    args[2] = args[2] || self;
    // support string names of functions on self
    (typeof fn === 'string') && (args[0] = self[fn]);
    return delay.apply(null, args);
  },

  'forEach': function (collection, fn, context) {
    var self = this;
    // default context to self
    context = context || self;
    // support string names of functions on self
    (typeof fn === 'string') && (fn = self[fn]);
    forEach(collection, fn, context);
  },

  'functions': function (obj) {
    return functions(obj || this);
  }
});

module.exports = WBUtilsMixin;

},{"../WBDeferred":4,"../WBMixin":6,"../lib/defer":15,"../lib/delay":16,"../lib/forEach":19,"../lib/functions":21,"../lib/toArray":27,"../lib/when":28}],37:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  'ControllableMixin': _dereq_('./ControllableMixin'),
  'ObservableHashMixin': _dereq_('./ObservableHashMixin'),
  'WBBindableMixin': _dereq_('./WBBindableMixin'),
  'WBDestroyableMixin': _dereq_('./WBDestroyableMixin'),
  'WBEventsMixin': _dereq_('./WBEventsMixin'),
  'WBStateMixin': _dereq_('./WBStateMixin'),
  'WBUtilsMixin': _dereq_('./WBUtilsMixin')
};
},{"./ControllableMixin":30,"./ObservableHashMixin":31,"./WBBindableMixin":32,"./WBDestroyableMixin":33,"./WBEventsMixin":34,"./WBStateMixin":35,"./WBUtilsMixin":36}]},{},[10])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicHVibGljL0Jhc2VFdmVudEVtaXR0ZXIuanMiLCJwdWJsaWMvQmFzZVNpbmdsZXRvbi5qcyIsInB1YmxpYy9XQkNsYXNzLmpzIiwicHVibGljL1dCRGVmZXJyZWQuanMiLCJwdWJsaWMvV0JFdmVudEVtaXR0ZXIuanMiLCJwdWJsaWMvV0JNaXhpbi5qcyIsInB1YmxpYy9XQlByb21pc2UuanMiLCJwdWJsaWMvV0JTaW5nbGV0b24uanMiLCJwdWJsaWMvV0JTdGF0ZU1vZGVsLmpzIiwicHVibGljL2luZGV4LmpzIiwicHVibGljL2xpYi9hc3NlcnQuanMiLCJwdWJsaWMvbGliL2Nsb25lLmpzIiwicHVibGljL2xpYi9jcmVhdGVVSUQuanMiLCJwdWJsaWMvbGliL2RlYm91bmNlLmpzIiwicHVibGljL2xpYi9kZWZlci5qcyIsInB1YmxpYy9saWIvZGVsYXkuanMiLCJwdWJsaWMvbGliL2V2ZW50cy5qcyIsInB1YmxpYy9saWIvZXh0ZW5kLmpzIiwicHVibGljL2xpYi9mb3JFYWNoLmpzIiwicHVibGljL2xpYi9mcm9tU3VwZXIuanMiLCJwdWJsaWMvbGliL2Z1bmN0aW9ucy5qcyIsInB1YmxpYy9saWIvaW5kZXguanMiLCJwdWJsaWMvbGliL2luaGVyaXRzLmpzIiwicHVibGljL2xpYi9pc0VxdWFsLmpzIiwicHVibGljL2xpYi9tZXJnZS5qcyIsInB1YmxpYy9saWIvc2l6ZS5qcyIsInB1YmxpYy9saWIvdG9BcnJheS5qcyIsInB1YmxpYy9saWIvd2hlbi5qcyIsInB1YmxpYy9saWIvd2hlcmUuanMiLCJwdWJsaWMvbWl4aW5zL0NvbnRyb2xsYWJsZU1peGluLmpzIiwicHVibGljL21peGlucy9PYnNlcnZhYmxlSGFzaE1peGluLmpzIiwicHVibGljL21peGlucy9XQkJpbmRhYmxlTWl4aW4uanMiLCJwdWJsaWMvbWl4aW5zL1dCRGVzdHJveWFibGVNaXhpbi5qcyIsInB1YmxpYy9taXhpbnMvV0JFdmVudHNNaXhpbi5qcyIsInB1YmxpYy9taXhpbnMvV0JTdGF0ZU1peGluLmpzIiwicHVibGljL21peGlucy9XQlV0aWxzTWl4aW4uanMiLCJwdWJsaWMvbWl4aW5zL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpfXZhciBmPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChmLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGYsZi5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBCYXNlRW1pdHRlciA9IHJlcXVpcmUoJy4vV0JFdmVudEVtaXR0ZXInKS5leHRlbmQoe1xuICAnbWl4aW5zJzogW1xuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCRGVzdHJveWFibGVNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCVXRpbHNNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL09ic2VydmFibGVIYXNoTWl4aW4nKVxuICBdXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlRW1pdHRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEJhc2VTaW5nbGV0b24gPSByZXF1aXJlKCcuL1dCU2luZ2xldG9uJykuZXh0ZW5kKHtcbiAgJ21peGlucyc6IFtcbiAgICByZXF1aXJlKCcuL21peGlucy9XQkV2ZW50c01peGluJyksXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JCaW5kYWJsZU1peGluJyksXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JEZXN0cm95YWJsZU1peGluJyksXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JVdGlsc01peGluJyksXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvT2JzZXJ2YWJsZUhhc2hNaXhpbicpXG4gIF1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VTaW5nbGV0b247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbmhlcml0cyA9IHJlcXVpcmUoJy4vbGliL2luaGVyaXRzJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi9saWIvZXh0ZW5kJyk7XG52YXIgY2xvbmUgPSByZXF1aXJlKCcuL2xpYi9jbG9uZScpO1xudmFyIGNyZWF0ZVVJRCA9IHJlcXVpcmUoJy4vbGliL2NyZWF0ZVVJRCcpO1xudmFyIGZyb21TdXBlciA9IHJlcXVpcmUoJy4vbGliL2Zyb21TdXBlcicpO1xuXG4vLyBTZWxmLXByb3BhZ2F0aW5nIGV4dGVuZCBmdW5jdGlvbi5cbi8vIENyZWF0ZSBhIG5ldyBjbGFzcyxcbi8vIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGUgY2xhc3MgZm91bmQgaW4gdGhlIGB0aGlzYCBjb250ZXh0IG9iamVjdC5cbi8vIFRoaXMgZnVuY3Rpb24gaXMgbWVhbnQgdG8gYmUgY2FsbGVkLFxuLy8gaW4gdGhlIGNvbnRleHQgb2YgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbmZ1bmN0aW9uIGV4dGVuZFNlbGYgKHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gIC8qIGpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXG4gIHZhciBwYXJlbnQgPSB0aGlzO1xuXG4gIHByb3RvUHJvcHMgPSBwcm90b1Byb3BzIHx8IHt9O1xuXG4gIC8vIGV4dHJhY3QgbWl4aW5zLCBpZiBhbnlcbiAgdmFyIG1peGlucyA9IHByb3RvUHJvcHMubWl4aW5zIHx8IFtdO1xuICBkZWxldGUgcHJvdG9Qcm9wcy5taXhpbnM7XG5cbiAgLy8gY3JlYXRlIHRoZSBkZXJpdmVkIGNsYXNzXG4gIHZhciBjaGlsZCA9IGluaGVyaXRzKHBhcmVudCwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpO1xuXG4gIC8vIGFwcGx5IG1peGlucyB0byB0aGUgZGVyaXZlZCBjbGFzc1xuICB2YXIgbWl4aW47XG4gIHdoaWxlIChtaXhpbnMubGVuZ3RoKSB7XG4gICAgbWl4aW4gPSBtaXhpbnMuc2hpZnQoKTtcbiAgICAodHlwZW9mIG1peGluLmFwcGx5VG9DbGFzcyA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICAgIG1peGluLmFwcGx5VG9DbGFzcyhjaGlsZCk7XG4gIH1cblxuICAvLyBtYWtlIHRoZSBjaGlsZCBjbGFzcyBleHRlbnNpYmxlXG4gIGNoaWxkLmV4dGVuZCA9IHBhcmVudC5leHRlbmQgfHwgZXh0ZW5kU2VsZjtcbiAgcmV0dXJuIGNoaWxkO1xufVxuXG5mdW5jdGlvbiBXQkNsYXNzIChvcHRpb25zKSB7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIEFzc2lnbiBhIHVuaXF1ZSBpZGVudGlmaWVyIHRvIHRoZSBpbnN0YW5jZVxuICBzZWxmLnVpZCA9IHNlbGYudWlkIHx8IGNyZWF0ZVVJRCgpO1xuXG4gIC8vIHNhdmUgb3B0aW9ucywgbWFrZSBzdXJlIGl0J3MgYXQgbGVhc3QgYW4gZW1wdHkgb2JqZWN0XG4gIHNlbGYub3B0aW9ucyA9IG9wdGlvbnMgfHwgc2VsZi5vcHRpb25zO1xuXG4gIC8vIGF1Z21lbnQgcHJvcGVydGllcyBmcm9tIG1peGluc1xuICBzZWxmLmF1Z21lbnRQcm9wZXJ0aWVzKCk7XG5cbiAgLy8gaW5pdGlhbGl6ZSB0aGUgaW5zdGFuY2VcbiAgc2VsZi5pbml0aWFsaXplLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG5cbiAgLy8gaW5pdGlhbGl6ZSBhbGwgdGhlIG1peGlucywgaWYgbmVlZGVkXG4gIC8vIGRvbid0IGtlZXAgdGhpcyBpbiB0aGUgaW5pdGlhbGl6ZSxcbiAgLy8gaW5pdGlhbGl6ZSBjYW4gYmUgb3ZlcndyaXR0ZW5cbiAgc2VsZi5pbml0TWl4aW5zLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG59XG5cbnZhciBwcm90byA9IHtcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uICgpIHtcblxuICAgIC8vIFJldHVybiBzZWxmIHRvIGFsbG93IGZvciBzdWJjbGFzcyB0byBhc3NpZ25cbiAgICAvLyBzdXBlciBpbml0aWFsaXplciB2YWx1ZSB0byBzZWxmXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gIC8vIElmIGFueSBtaXhpbnMgd2VyZSBhcHBsaWVkIHRvIHRoZSBwcm90b3R5cGUsIGluaXRpYWxpemUgdGhlbVxuICAnaW5pdE1peGlucyc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgaW5pdGlhbGl6ZXJzID0gZnJvbVN1cGVyLmNvbmNhdChzZWxmLCAnaW5pdGlhbGl6ZXJzJyk7XG5cbiAgICB2YXIgaW5pdGlhbGl6ZXI7XG4gICAgd2hpbGUgKGluaXRpYWxpemVycy5sZW5ndGgpIHtcbiAgICAgIGluaXRpYWxpemVyID0gaW5pdGlhbGl6ZXJzLnNoaWZ0KCk7XG4gICAgICAodHlwZW9mIGluaXRpYWxpemVyID09PSAnZnVuY3Rpb24nKSAmJlxuICAgICAgICBpbml0aWFsaXplci5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfSxcblxuICAvLyBJZiBhbnkgcHJvZXJ0aWVzIHdlcmUgZGVmaW5lZCBpbiB0aGUgbWl4aW5zLCBhdWdtZW50IHRoZW0gdG8gdGhlIGluc3RhbmNlXG4gICdhdWdtZW50UHJvcGVydGllcyc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcHJvcGVydGllcyA9IGZyb21TdXBlci5tZXJnZShzZWxmLCAncHJvcGVydGllcycpO1xuXG4gICAgZnVuY3Rpb24gYXVnbWVudFByb3BlcnR5IChwcm9wZXJ0eSwgdmFsdWUpIHtcblxuICAgICAgdmFyIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG5cbiAgICAgIGlmICh0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHNlbGZbcHJvcGVydHldID0gdmFsdWUuY2FsbChzZWxmKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHNlbGZbcHJvcGVydHldID0gY2xvbmUodmFsdWUsIHRydWUpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGZbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIga2V5IGluIHByb3BlcnRpZXMpIHtcbiAgICAgIGF1Z21lbnRQcm9wZXJ0eShrZXksIHByb3BlcnRpZXNba2V5XSk7XG4gICAgfVxuICB9XG59O1xuXG5leHRlbmQoV0JDbGFzcy5wcm90b3R5cGUsIHByb3RvKTtcbldCQ2xhc3MuZXh0ZW5kID0gZXh0ZW5kU2VsZjtcblxubW9kdWxlLmV4cG9ydHMgPSBXQkNsYXNzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgV0JDbGFzcyA9IHJlcXVpcmUoJy4vV0JDbGFzcycpO1xudmFyIFdCUHJvbWlzZSA9IHJlcXVpcmUoJy4vV0JQcm9taXNlJyk7XG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnLi9saWIvYXNzZXJ0Jyk7XG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vbGliL3RvQXJyYXknKTtcblxudmFyIHN0YXRlcyA9IHtcbiAgJ3BlbmRpbmcnOiAwLFxuICAncmVzb2x2ZWQnOiAyLFxuICAncmVqZWN0ZWQnOiA0XG59O1xuXG52YXIgc3RhdGVOYW1lcyA9IHtcbiAgMDogWydwZW5kaW5nJ10sXG4gIDI6IFsncmVzb2x2ZWQnLCAncmVzb2x2ZSddLFxuICA0OiBbJ3JlamVjdGVkJywgJ3JlamVjdCddXG59O1xuXG52YXIgcHJvdG8gPSB7XG5cbiAgJ2NvbnN0cnVjdG9yJzogZnVuY3Rpb24gKGNvbnRleHQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fY29udGV4dCA9IGNvbnRleHQ7XG4gICAgc2VsZi5fc3RhdGUgPSBzdGF0ZXMucGVuZGluZztcbiAgICBzZWxmLl9hcmdzID0gW107XG4gICAgc2VsZi5oYW5kbGVycyA9IFtdO1xuICB9LFxuXG4gICdzdGF0ZSc6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHN0YXRlTmFtZXNbc2VsZi5fc3RhdGVdWzBdO1xuICB9LFxuXG4gICd0cmlnZ2VyJzogZnVuY3Rpb24gKHdpdGhDb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0YXRlID09PSBzdGF0ZXMucGVuZGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyA9IHNlbGYuaGFuZGxlcnMsIGhhbmRsZTtcbiAgICB3aGlsZSAoaGFuZGxlcnMubGVuZ3RoKSB7XG4gICAgICBoYW5kbGUgPSBoYW5kbGVycy5zaGlmdCgpO1xuICAgICAgc2VsZi5pbnZva2UoaGFuZGxlLCB3aXRoQ29udGV4dCB8fCBzZWxmLl9jb250ZXh0KTtcbiAgICB9XG4gIH0sXG5cbiAgJ2ludm9rZSc6IGZ1bmN0aW9uIChkZWZlcnJlZFJlc3BvbnNlLCB3aXRoQ29udGV4dCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBzdGF0ZSA9IHNlbGYuX3N0YXRlO1xuICAgIHZhciBjb250ZXh0ID0gZGVmZXJyZWRSZXNwb25zZS5jb250ZXh0IHx8IHdpdGhDb250ZXh0IHx8IHNlbGY7XG4gICAgdmFyIGFyZ3MgPSBkZWZlcnJlZFJlc3BvbnNlLmFyZ3M7XG5cbiAgICBzZWxmLl9hcmdzLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgLy8gc2VuZCBzaW5nbGUgYXJndW1lbnRzIGFzIHRoZSBpdGVtLCBvdGhlcndpc2Ugc2VuZCBpdCBhcyBhbiBhcnJheVxuICAgICAgYXJncy5wdXNoKGFyZyk7XG4gICAgfSk7XG5cbiAgICB2YXIgdHlwZSA9IGRlZmVycmVkUmVzcG9uc2UudHlwZTtcbiAgICB2YXIgaXNDb21wbGV0ZWQgPSAodHlwZSA9PT0gJ3RoZW4nKSB8fFxuICAgICAgKHR5cGUgPT09ICdkb25lJyAmJiBzdGF0ZSA9PT0gc3RhdGVzLnJlc29sdmVkKSB8fFxuICAgICAgKHR5cGUgPT09ICdmYWlsJyAmJiBzdGF0ZSA9PT0gc3RhdGVzLnJlamVjdGVkKTtcblxuICAgIGlzQ29tcGxldGVkICYmIGRlZmVycmVkUmVzcG9uc2UuZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gIH0sXG5cbiAgJ3Byb21pc2UnOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX3Byb21pc2UgPSBzZWxmLl9wcm9taXNlIHx8IG5ldyBXQlByb21pc2UodGhpcyk7XG4gICAgcmV0dXJuIHNlbGYuX3Byb21pc2U7XG4gIH1cbn07XG5cblsndGhlbicsICdkb25lJywgJ2ZhaWwnXS5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgcHJvdG9bbWV0aG9kXSA9IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHN0b3JlIHJlZmVyZW5jZXMgdG8gdGhlIGNvbnRleHQsIGNhbGxiYWNrcywgYW5kIGFyYml0cmFyeSBhcmd1bWVudHNcbiAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICB2YXIgZm4gPSBhcmdzLnNoaWZ0KCk7XG4gICAgdmFyIGNvbnRleHQgPSBhcmdzLnNoaWZ0KCk7XG5cbiAgICBhc3NlcnQuZnVuY3Rpb24oZm4sIG1ldGhvZCArICcgYWNjZXB0cyBvbmx5IGZ1bmN0aW9ucycpO1xuXG4gICAgc2VsZi5oYW5kbGVycy5wdXNoKHtcbiAgICAgICd0eXBlJzogbWV0aG9kLFxuICAgICAgJ2NvbnRleHQnOiBjb250ZXh0LFxuICAgICAgJ2ZuJzogZm4sXG4gICAgICAnYXJncyc6IGFyZ3NcbiAgICB9KTtcblxuICAgIC8vIGlmIHRoZSBkZWZlcmVkIGlzIG5vdCBwZW5kaW5nIGFueW1vcmUsIGNhbGwgdGhlIGNhbGxiYWNrc1xuICAgIHNlbGYudHJpZ2dlcigpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG59KTtcblxuLy8gQWxpYXMgYGFsd2F5c2AgdG8gYHRoZW5gIG9uIERlZmVycmVkJ3MgcHJvdG90eXBlXG5wcm90by5hbHdheXMgPSBwcm90by50aGVuO1xuXG5mdW5jdGlvbiByZXNvbHZlciAoc3RhdGUsIGlzV2l0aCwgZm5OYW1lKSB7XG4gIHJldHVybiBmdW5jdGlvbiBjb21wbGV0ZSAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoIShzZWxmIGluc3RhbmNlb2YgV0JEZWZlcnJlZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihmbk5hbWUgKyAnIGludm9rZWQgd2l0aCB3cm9uZyBjb250ZXh0Jyk7XG4gICAgfVxuXG4gICAgLy8gY2FuJ3QgY2hhbmdlIHN0YXRlIG9uY2UgcmVzb2x2ZWQgb3IgcmVqZWN0ZWRcbiAgICBpZiAoc2VsZi5fc3RhdGUgIT09IHN0YXRlcy5wZW5kaW5nKSB7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9XG5cbiAgICBzZWxmLl9hcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgIHZhciBjb250ZXh0ID0gaXNXaXRoID8gc2VsZi5fYXJncy5zaGlmdCgpIDogdW5kZWZpbmVkO1xuXG4gICAgc2VsZi5fc3RhdGUgPSBzdGF0ZTtcbiAgICBzZWxmLnRyaWdnZXIoY29udGV4dCk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfTtcbn1cblxuW3N0YXRlcy5yZXNvbHZlZCwgc3RhdGVzLnJlamVjdGVkXS5mb3JFYWNoKGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgZm5OYW1lID0gc3RhdGVOYW1lc1tzdGF0ZV1bMV07XG4gIHByb3RvW2ZuTmFtZV0gPSByZXNvbHZlcihzdGF0ZSwgZmFsc2UsIGZuTmFtZSk7XG4gIHByb3RvW2ZuTmFtZSArICdXaXRoJ10gPSByZXNvbHZlcihzdGF0ZSwgdHJ1ZSwgZm5OYW1lKTtcbn0pO1xuXG52YXIgV0JEZWZlcnJlZCA9IFdCQ2xhc3MuZXh0ZW5kKHByb3RvKTtcbm1vZHVsZS5leHBvcnRzID0gV0JEZWZlcnJlZDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFdCRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnLi9XQkNsYXNzJykuZXh0ZW5kKHtcbiAgJ21peGlucyc6IFtcbiAgICByZXF1aXJlKCcuL21peGlucy9XQkJpbmRhYmxlTWl4aW4nKSxcbiAgICByZXF1aXJlKCcuL21peGlucy9XQkV2ZW50c01peGluJylcbiAgXVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JFdmVudEVtaXR0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBleHRlbmQgPSByZXF1aXJlKCcuL2xpYi9leHRlbmQnKTtcbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4vbGliL2Nsb25lJyk7XG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnLi9saWIvYXNzZXJ0Jyk7XG52YXIgV0JTaW5nbGV0b24gPSByZXF1aXJlKCcuL1dCU2luZ2xldG9uJyk7XG5cbnZhciBXQk1peGluID0gV0JTaW5nbGV0b24uZXh0ZW5kKHtcblxuICAvLyBBcHBseSB0aGUgbWl4aW4gdG8gYW4gaW5zdGFuY2Ugb2YgYSBjbGFzc1xuICAnYXBwbHlUbyc6IGZ1bmN0aW9uIChpbnN0YW5jZSkge1xuXG4gICAgdmFyIGJlaGF2aW9yID0gY2xvbmUodGhpcy5CZWhhdmlvciwgdHJ1ZSk7XG5cbiAgICAvLyBhcHBseSBtaXhpbidzIGluaXRpYWxpemUgJiByZW1vdmUgaXQgZnJvbSB0aGUgaW5zdGFuY2VcbiAgICB2YXIgaW5pdGlhbGl6ZXI7XG4gICAgaWYgKHR5cGVvZiBiZWhhdmlvci5pbml0aWFsaXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBpbml0aWFsaXplciA9IGJlaGF2aW9yLmluaXRpYWxpemU7XG4gICAgICBkZWxldGUgYmVoYXZpb3IuaW5pdGlhbGl6ZTtcbiAgICB9XG5cbiAgICAvLyBhdWdtZW50IG1peGluJ3MgcHJvcGVydGllcyBvYmplY3QgaW50byB0aGUgaW5zdGFuY2VcbiAgICB2YXIgcHJvcGVydGllcyA9IGJlaGF2aW9yLnByb3BlcnRpZXM7XG4gICAgZGVsZXRlIGJlaGF2aW9yLnByb3BlcnRpZXM7XG5cbiAgICAvLyBtaXhpbiB0aGUgYmVoYXZpb3JcbiAgICBleHRlbmQoaW5zdGFuY2UsIGJlaGF2aW9yKTtcblxuICAgIC8vIGFwcGx5IHRoZSBpbml0aWFsaXplciwgaWYgYW55XG4gICAgaW5pdGlhbGl6ZXIgJiYgaW5pdGlhbGl6ZXIuYXBwbHkoaW5zdGFuY2UpO1xuXG4gICAgLy8gYXVnbWVudCBwcm9lcnRpZXMgdG8gdGhlIGluc3RhbmNlXG4gICAgcHJvcGVydGllcyAmJiBleHRlbmQoaW5zdGFuY2UsIHByb3BlcnRpZXMpO1xuXG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9LFxuXG4gIC8vIEFwcGx5IHRoZSBtaXhpbiB0byB0aGUgY2xhc3MgZGlyZWN0bHlcbiAgJ2FwcGx5VG9DbGFzcyc6IGZ1bmN0aW9uIChrbGFzcykge1xuXG4gICAgLy8gdmFsaWRhdGUgY2xhc3NcbiAgICBhc3NlcnQuY2xhc3Moa2xhc3MsICdhcHBseVRvQ2xhc3MgZXhwZWN0cyBhIGNsYXNzJyk7XG5cbiAgICB2YXIgcHJvdG8gPSBrbGFzcy5wcm90b3R5cGU7XG4gICAgdmFyIGJlaGF2aW9yID0gY2xvbmUodGhpcy5CZWhhdmlvciwgdHJ1ZSk7XG5cbiAgICAvLyBjYWNoZSB0aGUgbWl4aW4ncyBpbml0aWFsaXplciwgdG8gYmUgYXBwbGllZCBsYXRlclxuICAgIHZhciBpbml0aWFsaXplID0gYmVoYXZpb3IuaW5pdGlhbGl6ZTtcbiAgICBpZiAodHlwZW9mIGluaXRpYWxpemUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICghcHJvdG8uaGFzT3duUHJvcGVydHkoJ2luaXRpYWxpemVycycpKSAmJiAocHJvdG8uaW5pdGlhbGl6ZXJzID0gW10pO1xuICAgICAgcHJvdG8uaW5pdGlhbGl6ZXJzLnB1c2goaW5pdGlhbGl6ZSk7XG4gICAgICBkZWxldGUgYmVoYXZpb3IuaW5pdGlhbGl6ZTtcbiAgICB9XG5cbiAgICB2YXIgcHJvcGVydGllcyA9IGJlaGF2aW9yLnByb3BlcnRpZXM7XG4gICAgZGVsZXRlIGJlaGF2aW9yLnByb3BlcnRpZXM7XG5cbiAgICAvLyBleHRlbmQgdGhlIHByb3RvdHlwZVxuICAgIGV4dGVuZChwcm90bywgYmVoYXZpb3IpO1xuXG4gICAgLy8gY2FjaGUgdGhlIHByb3BlcnRpZXMsIHRvIGJlIGFwcGxpZWQgbGF0ZXJcbiAgICAoIXByb3RvLmhhc093blByb3BlcnR5KCdwcm9wZXJ0aWVzJykpICYmIChwcm90by5wcm9wZXJ0aWVzID0ge30pO1xuICAgIHByb3BlcnRpZXMgJiYgZXh0ZW5kKHByb3RvLnByb3BlcnRpZXMsIHByb3BlcnRpZXMpO1xuXG4gICAgcmV0dXJuIGtsYXNzO1xuICB9XG59KTtcblxuLy8gVGhlIG9ubHkgcmVhbCBjaGFuZ2UgZnJvbSBhIHNpbXBsZSBzaW5nbGV0b24gaXNcbi8vIHRoZSBhbHRlcmVkIGV4dGVuZCBjbGFzcyBtZXRob2QsIHdoaWNoIHdpbGwgc2F2ZVxuLy8gXCJtaXhpblByb3BzXCIgaW50byBhIHNwZWNpZmljIG1lbWJlciwgZm9yIGVhc3lcbi8vIGFuZCBjbGVhbiBhcHBsaWNhdGlvbiB1c2luZyAjYXBwbHlUb1xuV0JNaXhpbi5leHRlbmQgPSBmdW5jdGlvbiAobWl4aW5Qcm9wcywgc3RhdGljUHJvcHMpIHtcblxuICBtaXhpblByb3BzIHx8IChtaXhpblByb3BzID0ge30pO1xuICBzdGF0aWNQcm9wcyB8fCAoc3RhdGljUHJvcHMgPSB7fSk7XG5cbiAgdmFyIGN1cnJlbnQgPSBjbG9uZSh0aGlzLkJlaGF2aW9yLCB0cnVlKTtcbiAgc3RhdGljUHJvcHMuQmVoYXZpb3IgPSBleHRlbmQoY3VycmVudCwgbWl4aW5Qcm9wcyk7XG4gIHZhciBtaXhpbiA9IFdCU2luZ2xldG9uLmV4dGVuZC5jYWxsKHRoaXMsIHN0YXRpY1Byb3BzKTtcblxuICBtaXhpbi5leHRlbmQgPSBXQk1peGluLmV4dGVuZDtcblxuICByZXR1cm4gbWl4aW47XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdCTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQkNsYXNzID0gcmVxdWlyZSgnLi9XQkNsYXNzJyk7XG5cbmZ1bmN0aW9uIHByb3h5IChuYW1lKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGRlZmVycmVkID0gdGhpcy5kZWZlcnJlZDtcbiAgICBkZWZlcnJlZFtuYW1lXS5hcHBseShkZWZlcnJlZCwgYXJndW1lbnRzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcbn1cblxudmFyIHByb3RvID0ge1xuICAnY29uc3RydWN0b3InOiBmdW5jdGlvbiAoZGVmZXJyZWQpIHtcbiAgICB0aGlzLmRlZmVycmVkID0gZGVmZXJyZWQ7XG4gIH0sXG5cbiAgJ3Byb21pc2UnOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgJ3N0YXRlJzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmRlZmVycmVkLnN0YXRlKCk7XG4gIH1cbn07XG5cbltcbiAgJ2RvbmUnLFxuICAnZmFpbCcsXG4gICd0aGVuJ1xuXS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gIHByb3RvW25hbWVdID0gcHJveHkobmFtZSk7XG59KTtcblxucHJvdG8uYWx3YXlzID0gcHJvdG8udGhlbjtcblxubW9kdWxlLmV4cG9ydHMgPSBXQkNsYXNzLmV4dGVuZChwcm90byk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBleHRlbmQgPSByZXF1aXJlKCcuL2xpYi9leHRlbmQnKTtcbnZhciBjcmVhdGVVSUQgPSByZXF1aXJlKCcuL2xpYi9jcmVhdGVVSUQnKTtcblxuZnVuY3Rpb24gYXBwbHlNaXhpbnMgKG1peGlucywgaW5zdGFuY2UpIHtcbiAgdmFyIG1peGluO1xuICB3aGlsZSAobWl4aW5zLmxlbmd0aCkge1xuICAgIG1peGluID0gbWl4aW5zLnNoaWZ0KCk7XG4gICAgKHR5cGVvZiBtaXhpbi5hcHBseVRvID09PSAnZnVuY3Rpb24nKSAmJlxuICAgICAgbWl4aW4uYXBwbHlUbyhpbnN0YW5jZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZXh0ZW5kU2VsZiAoc3RhdGljUHJvcHMpIHtcbiAgLyoganNoaW50IHZhbGlkdGhpczp0cnVlICovXG5cbiAgc3RhdGljUHJvcHMgPSBzdGF0aWNQcm9wcyB8fCB7fTtcblxuICAvLyBleHRlbmQgZnJvbSB0aGUgYmFzZSBzaW5nbGV0b25cbiAgdmFyIEJhc2VTaW5nbGV0b24gPSB0aGlzIHx8IFdCU2luZ2xldG9uO1xuXG4gIC8vIGNyZWF0ZSBhIG5ldyBpbnN0YW5jZVxuICBDdG9yLnByb3RvdHlwZSA9IEJhc2VTaW5nbGV0b247XG4gIHZhciBzaW5nbGV0b24gPSBuZXcgQ3RvcigpO1xuXG4gIC8vIGV4dHJhY3QgbWl4aW5zXG4gIHZhciBtaXhpbnMgPSBzdGF0aWNQcm9wcy5taXhpbnMgfHwgW107XG4gIHN0YXRpY1Byb3BzLm1peGlucyA9IHVuZGVmaW5lZDtcblxuICAvLyBhcHBseSBtaXhpbnMgdG8gdGhlIGluc3RhbmNlXG4gIGFwcGx5TWl4aW5zKG1peGlucywgc2luZ2xldG9uKTtcblxuICAvLyBhcHBlbmQgdGhlIHN0YXRpYyBwcm9wZXJ0aWVzIHRvIHRoZSBzaW5nbGV0b25cbiAgZXh0ZW5kKHNpbmdsZXRvbiwgc3RhdGljUHJvcHMpO1xuXG4gIC8vIG1ha2UgdGhlIHNpbmdsZXRvbiBleHRlbmRhYmxlXG4gIC8vIERvIHRoaXMgYWZ0ZXIgYXBwbHlpbmcgbWl4aW5zLFxuICAvLyB0byBlbnN1cmUgdGhhdCBubyBtaXhpbiBjYW4gb3ZlcnJpZGUgYGV4dGVuZGAgbWV0aG9kXG4gIHNpbmdsZXRvbi5leHRlbmQgPSBleHRlbmRTZWxmO1xuXG4gIC8vIGV2ZXJ5IHNpZ25sZXRvbiBnZXRzIGEgVUlEXG4gIHNpbmdsZXRvbi51aWQgPSBjcmVhdGVVSUQoKTtcblxuICByZXR1cm4gc2luZ2xldG9uO1xufVxuXG52YXIgQ3RvciA9IGZ1bmN0aW9uICgpIHt9O1xuQ3Rvci5wcm90b3R5cGUgPSB7XG4gICdleHRlbmQnOiBleHRlbmRTZWxmXG59O1xuXG52YXIgV0JTaW5nbGV0b24gPSBuZXcgQ3RvcigpO1xubW9kdWxlLmV4cG9ydHMgPSBXQlNpbmdsZXRvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFdCQ2xhc3MgPSByZXF1aXJlKCcuL1dCQ2xhc3MnKTtcblxudmFyIFdCRGVzdHJveWFibGVNaXhpbiA9IHJlcXVpcmUoJy4vbWl4aW5zL1dCRGVzdHJveWFibGVNaXhpbicpO1xudmFyIG9yaWdpbmFsRGVzdHJveSA9IFdCRGVzdHJveWFibGVNaXhpbi5CZWhhdmlvci5kZXN0cm95O1xuXG52YXIgV0JTdGF0ZU1vZGVsID0gV0JDbGFzcy5leHRlbmQoe1xuXG4gICdtaXhpbnMnOiBbXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JFdmVudHNNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCU3RhdGVNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCQmluZGFibGVNaXhpbicpLFxuICAgIFdCRGVzdHJveWFibGVNaXhpblxuICBdLFxuXG4gICdpbml0aWFsaXplJzogZnVuY3Rpb24gKGF0dHJpYnV0ZXMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChhdHRyaWJ1dGVzKSB7XG4gICAgICBzZWxmLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzO1xuICAgIH1cbiAgfSxcblxuICAnc3luYyc6ICBmdW5jdGlvbiAobWV0aG9kLCBpbnN0YW5jZSwgb3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zICYmIHR5cGVvZiBvcHRpb25zLnN1Y2Nlc3MgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIG9wdGlvbnMuc3VjY2VzcygpO1xuICAgIH1cbiAgfSxcblxuICAnZmV0Y2gnOiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgc3VjY2VzcyA9IG9wdGlvbnMuc3VjY2VzcztcbiAgICB2YXIgbW9kZWwgPSB0aGlzO1xuICAgIG9wdGlvbnMuc3VjY2VzcyA9IGZ1bmN0aW9uIChyZXNwKSB7XG4gICAgICBpZiAoIW1vZGVsLnNldChyZXNwLCBvcHRpb25zKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgaWYgKHN1Y2Nlc3MpIHN1Y2Nlc3MobW9kZWwsIHJlc3AsIG9wdGlvbnMpO1xuICAgICAgbW9kZWwudHJpZ2dlcignc3luYycsIG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICB9O1xuICAgIHJldHVybiBzZWxmLnN5bmMoJ3JlYWQnLCBzZWxmLCBvcHRpb25zKTtcbiAgfSxcblxuICAnc2F2ZSc6IGZ1bmN0aW9uIChrZXksIHZhbCwgb3B0aW9ucykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5kZXN0cm95aW5nKSB7XG4gICAgICAvLyBzZXQgdGhlIGF0dHJpYnV0ZXNcbiAgICAgIHNlbGYuc2V0KGtleSwgdmFsLCBvcHRpb25zKTtcbiAgICAgIC8vIHN5bmNcbiAgICAgICh0eXBlb2Yga2V5ID09PSAnb2JqZWN0JykgJiYgKG9wdGlvbnMgPSB2YWwpO1xuICAgICAgc2VsZi5zeW5jKCd1cGRhdGUnLCBzZWxmLCBvcHRpb25zKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ2Rlc3Ryb3knOiBmdW5jdGlvbiAob3B0aW9ucykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5kZXN0cm95aW5nKSB7XG4gICAgICBzZWxmLmRlc3Ryb3lpbmcgPSB0cnVlO1xuICAgICAgb3JpZ2luYWxEZXN0cm95LmNhbGwoc2VsZiwgb3B0aW9ucyk7XG4gICAgICBzZWxmLmF0dHJpYnV0ZXMgPSB7fTtcbiAgICAgIHNlbGYuc3luYygnZGVsZXRlJywgc2VsZiwgb3B0aW9ucyk7XG4gICAgfVxuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQlN0YXRlTW9kZWw7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnbGliJzogcmVxdWlyZSgnLi9saWInKSxcbiAgJ0Jhc2VFdmVudEVtaXR0ZXInOiByZXF1aXJlKCcuL0Jhc2VFdmVudEVtaXR0ZXInKSxcbiAgJ0Jhc2VTaW5nbGV0b24nOiByZXF1aXJlKCcuL0Jhc2VTaW5nbGV0b24nKSxcbiAgJ1dCQ2xhc3MnOiByZXF1aXJlKCcuL1dCQ2xhc3MnKSxcbiAgJ1dCRGVmZXJyZWQnOiByZXF1aXJlKCcuL1dCRGVmZXJyZWQnKSxcbiAgJ1dCRXZlbnRFbWl0dGVyJzogcmVxdWlyZSgnLi9XQkV2ZW50RW1pdHRlcicpLFxuICAnV0JNaXhpbic6IHJlcXVpcmUoJy4vV0JNaXhpbicpLFxuICAnV0JTaW5nbGV0b24nOiByZXF1aXJlKCcuL1dCU2luZ2xldG9uJyksXG4gICdXQlN0YXRlTW9kZWwnOiByZXF1aXJlKCcuL1dCU3RhdGVNb2RlbCcpLFxuICAnbWl4aW5zJzogcmVxdWlyZSgnLi9taXhpbnMnKVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gYXNzZXJ0IChjb25kaXRpb24sIG1lc3NhZ2UpIHtcbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSB8fCAnJyk7XG4gIH1cbn1cblxudmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuYXNzZXJ0LmVtcHR5ID0gZnVuY3Rpb24gKG9iamVjdCwgbWVzc2FnZSkge1xuICB2YXIga2V5cyA9IG5hdGl2ZUlzQXJyYXkob2JqZWN0KSA/IG9iamVjdCA6IE9iamVjdC5rZXlzKG9iamVjdCk7XG4gIGFzc2VydChrZXlzLmxlbmd0aCA9PT0gMCwgbWVzc2FnZSk7XG59O1xuXG5hc3NlcnQuYXJyYXkgPSBmdW5jdGlvbiAoYXJyYXksIG1lc3NhZ2UpIHtcbiAgYXNzZXJ0KG5hdGl2ZUlzQXJyYXkoYXJyYXkpLCBtZXNzYWdlKTtcbn07XG5cbmFzc2VydC5jbGFzcyA9IGZ1bmN0aW9uIChrbGFzcywgbWVzc2FnZSkge1xuICB2YXIgcHJvdG8gPSBrbGFzcy5wcm90b3R5cGU7XG4gIGFzc2VydChwcm90byAmJiBwcm90by5jb25zdHJ1Y3RvciA9PT0ga2xhc3MsIG1lc3NhZ2UpO1xufTtcblxudmFyIHR5cGVzID0gW1xuICAndW5kZWZpbmVkJyxcbiAgJ2Jvb2xlYW4nLFxuICAnbnVtYmVyJyxcbiAgJ3N0cmluZycsXG4gICdmdW5jdGlvbicsXG4gICdvYmplY3QnXG5dO1xuXG5mdW5jdGlvbiB0eXBlY2hlY2sgKHR5cGUpIHtcbiAgYXNzZXJ0W3R5cGVdID0gZnVuY3Rpb24gKG8sIG1lc3NhZ2UpIHtcbiAgICBhc3NlcnQodHlwZW9mIG8gPT09IHR5cGUsIG1lc3NhZ2UpO1xuICB9O1xufVxuXG53aGlsZSAodHlwZXMubGVuZ3RoKSB7XG4gIHR5cGVjaGVjayh0eXBlcy5zaGlmdCgpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhc3NlcnQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbmF0aXZlSXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbmZ1bmN0aW9uIGNsb25lQXJyYXkgKGFyciwgaXNEZWVwKSB7XG4gIGFyciA9IGFyci5zbGljZSgpO1xuICBpZiAoaXNEZWVwKSB7XG4gICAgdmFyIG5ld0FyciA9IFtdLCB2YWx1ZTtcbiAgICB3aGlsZSAoYXJyLmxlbmd0aCkge1xuICAgICAgdmFsdWUgPSBhcnIuc2hpZnQoKTtcbiAgICAgIHZhbHVlID0gKHZhbHVlIGluc3RhbmNlb2YgT2JqZWN0KSA/IGNsb25lKHZhbHVlLCBpc0RlZXApIDogdmFsdWU7XG4gICAgICBuZXdBcnIucHVzaCh2YWx1ZSk7XG4gICAgfVxuICAgIGFyciA9IG5ld0FycjtcbiAgfVxuICByZXR1cm4gYXJyO1xufVxuXG5mdW5jdGlvbiBjbG9uZURhdGUgKGRhdGUpIHtcbiAgcmV0dXJuIG5ldyBEYXRlKGRhdGUpO1xufVxuXG5mdW5jdGlvbiBjbG9uZU9iamVjdCAoc291cmNlLCBpc0RlZXApIHtcbiAgdmFyIG9iamVjdCA9IHt9O1xuICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICB2YXIgdmFsdWUgPSBzb3VyY2Vba2V5XTtcbiAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSBjbG9uZURhdGUodmFsdWUpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmIGlzRGVlcCkge1xuICAgICAgICBvYmplY3Rba2V5XSA9IGNsb25lKHZhbHVlLCBpc0RlZXApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxuZnVuY3Rpb24gY2xvbmUgKG9iaiwgaXNEZWVwKSB7XG5cbiAgaWYgKG5hdGl2ZUlzQXJyYXkob2JqKSkge1xuICAgIHJldHVybiBjbG9uZUFycmF5KG9iaiwgaXNEZWVwKTtcbiAgfVxuXG4gIHJldHVybiBjbG9uZU9iamVjdChvYmosIGlzRGVlcCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2xvbmU7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHJlcGxhY2VyIChtYXRjaCkge1xuICB2YXIgcmFuZCA9IE1hdGgucmFuZG9tKCkgKiAxNiB8IDA7XG4gIHZhciBjaHIgPSAobWF0Y2ggPT09ICd4JykgPyByYW5kIDogKHJhbmQgJiAweDMgfCAweDgpO1xuICByZXR1cm4gY2hyLnRvU3RyaW5nKDE2KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVUlEIChwcmVmaXgpIHtcbiAgdmFyIHVpZCA9ICd4eHh4eHh4eC14eHh4LTR4eHgteXh4eC14eHh4eHh4eHh4eHgnLnJlcGxhY2UoL1t4eV0vZywgcmVwbGFjZXIpO1xuICByZXR1cm4gU3RyaW5nKCFwcmVmaXggPyAnJyA6IHByZWZpeCkgKyB1aWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlVUlEO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBSZXR1cm5zIGEgZnVuY3Rpb24sIHRoYXQsIGFzIGxvbmcgYXMgaXQgY29udGludWVzIHRvIGJlIGludm9rZWQsIHdpbGwgbm90XG4vLyBiZSB0cmlnZ2VyZWQuIFRoZSBmdW5jdGlvbiB3aWxsIGJlIGNhbGxlZCBhZnRlciBpdCBzdG9wcyBiZWluZyBjYWxsZWQgZm9yXG4vLyBOIG1pbGxpc2Vjb25kcy4gSWYgYGltbWVkaWF0ZWAgaXMgcGFzc2VkLCB0cmlnZ2VyIHRoZSBmdW5jdGlvbiBvbiB0aGVcbi8vIGxlYWRpbmcgZWRnZSwgaW5zdGVhZCBvZiB0aGUgdHJhaWxpbmcuXG4vLyBGcm9tOiBodHRwOi8vZGF2aWR3YWxzaC5uYW1lL2Z1bmN0aW9uLWRlYm91bmNlXG5mdW5jdGlvbiBkZWJvdW5jZSAoZm4sIHdhaXQsIGltbWVkaWF0ZSkge1xuICB2YXIgdGltZW91dDtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBjb250ZXh0ID0gdGhpcywgYXJncyA9IGFyZ3VtZW50cztcbiAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgaWYgKCFpbW1lZGlhdGUpIHtcbiAgICAgICAgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICB9XG4gICAgfTtcbiAgICB2YXIgY2FsbE5vdyA9IGltbWVkaWF0ZSAmJiAhdGltZW91dDtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgIGlmIChjYWxsTm93KSB7XG4gICAgICBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVib3VuY2U7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vdG9BcnJheScpO1xudmFyIGRlbGF5ID0gcmVxdWlyZSgnLi9kZWxheScpO1xuXG5mdW5jdGlvbiBkZWZlciAoZm4pIHtcbiAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gIGFyZ3NbMF0gPSAxO1xuICBhcmdzLnVuc2hpZnQoZm4pO1xuICByZXR1cm4gZGVsYXkuYXBwbHkobnVsbCwgYXJncyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0b0FycmF5ID0gcmVxdWlyZSgnLi90b0FycmF5Jyk7XG5cbmZ1bmN0aW9uIGRlbGF5IChmbiwgdGltZSwgY29udGV4dCkge1xuICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzLCAzKTtcbiAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIGRlc3Ryb3llZCA9IGNvbnRleHQgJiYgY29udGV4dC5kZXN0cm95ZWQ7XG4gICAgIWRlc3Ryb3llZCAmJiBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgfSwgdGltZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVsYXk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhc3NlcnQgPSByZXF1aXJlKCcuL2Fzc2VydCcpO1xudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuL3RvQXJyYXknKTtcbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4vY2xvbmUnKTtcblxudmFyIGV2ZW50U3BsaXR0ZXIgPSAvXFxzKy87XG5cbnZhciB2YWxpZGF0aW9uRXJyb3JzID0ge1xuICAndHJpZ2dlcic6ICdDYW5ub3QgdHJpZ2dlciBldmVudChzKSB3aXRob3V0IGV2ZW50IG5hbWUocyknLFxuICAnZXZlbnRzJzogJ0Nhbm5vdCBiaW5kL3VuYmluZCB3aXRob3V0IHZhbGlkIGV2ZW50IG5hbWUocyknLFxuICAnY2FsbGJhY2snOiAnQ2Fubm90IGJpbmQvdW5iaW5kIHRvIGFuIGV2ZW50IHdpdGhvdXQgdmFsaWQgY2FsbGJhY2sgZnVuY3Rpb24nXG59O1xuXG52YXIgZXZlbnRzID0ge1xuXG4gICdwcm9wZXJ0aWVzJzoge1xuICAgICdfZXZlbnRzJzoge30sXG4gICAgJ19jYWNoZSc6IHt9XG4gIH0sXG5cbiAgJ29uJzogZnVuY3Rpb24gKGV2ZW50cywgY2FsbGJhY2ssIGNvbnRleHQpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHZhbGlkYXRlIGFyZ3VtZW50c1xuICAgIGFzc2VydC5zdHJpbmcoZXZlbnRzLCB2YWxpZGF0aW9uRXJyb3JzLmV2ZW50cyk7XG4gICAgYXNzZXJ0LmZ1bmN0aW9uKGNhbGxiYWNrLCB2YWxpZGF0aW9uRXJyb3JzLmNhbGxiYWNrKTtcblxuICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgZXZlbnRzICYgYmluZCB0aGVtXG4gICAgc2VsZi5pdGVyYXRlKGV2ZW50cywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIC8vIGtlZXAgdGhlIGJpbmRpbmdcbiAgICAgIHNlbGYuYmluZChuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICAgIC8vIGlmIHRoaXMgd2FzIGEgcHVibGlzaGVkIGV2ZW50LCBkbyBhbiBpbW1lZGlhdGUgdHJpZ2dlclxuICAgICAgdmFyIGNhY2hlID0gc2VsZi5fY2FjaGU7XG4gICAgICBpZiAoY2FjaGVbbmFtZV0pIHtcbiAgICAgICAgY2FsbGJhY2suYXBwbHkoY29udGV4dCB8fCBzZWxmLCBjYWNoZVtuYW1lXSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAnb2ZmJzogZnVuY3Rpb24gKGV2ZW50cywgY2FsbGJhY2ssIGNvbnRleHQpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHZhbGlkYXRlIGV2ZW50cyBvbmx5IGlmIGEgdHJ1dGh5IHZhbHVlIGlzIHBhc3NlZFxuICAgIGV2ZW50cyAmJiBhc3NlcnQuc3RyaW5nKGV2ZW50cywgdmFsaWRhdGlvbkVycm9ycy5ldmVudHMpO1xuXG4gICAgLy8gaWYgbm8gYXJndW1lbnRzIHdlcmUgcGFzc2VkLCB1bmJpbmQgZXZlcnl0aGluZ1xuICAgIGlmICghZXZlbnRzICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgc2VsZi5fZXZlbnRzID0ge307XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9XG5cbiAgICAvLyBpZiBubyBldmVudHMgYXJlIHBhc3NlZCwgdW5iaW5kIGFsbCBldmVudHMgd2l0aCB0aGlzIGNhbGxiYWNrXG4gICAgZXZlbnRzID0gZXZlbnRzIHx8IE9iamVjdC5rZXlzKHNlbGYuX2V2ZW50cyk7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGV2ZW50cyAmIGJpbmQgdGhlbVxuICAgIHNlbGYuaXRlcmF0ZShldmVudHMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICBzZWxmLnVuYmluZChuYW1lLCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAnb25jZSc6IGZ1bmN0aW9uIChldmVudHMsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG5cbiAgICAvLyBjcmVhdGUgYSBvbmUgdGltZSBiaW5kaW5nXG4gICAgYXJnc1sxXSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYub2ZmLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgY2FsbGJhY2suYXBwbHkoY29udGV4dCB8fCBzZWxmLCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICBzZWxmLm9uLmFwcGx5KHNlbGYsIGFyZ3MpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ3B1Ymxpc2gnOiBmdW5jdGlvbiAoZXZlbnRzKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG5cbiAgICAvLyB2YWxpZGF0ZSBldmVudHNcbiAgICBhc3NlcnQuc3RyaW5nKGV2ZW50cywgdmFsaWRhdGlvbkVycm9ycy5ldmVudHMpO1xuXG4gICAgc2VsZi5pdGVyYXRlKGV2ZW50cywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHZhciBjYWNoZSA9IHNlbGYuX2NhY2hlO1xuICAgICAgaWYgKCFjYWNoZVtuYW1lXSkge1xuICAgICAgICBjYWNoZVtuYW1lXSA9IGFyZ3Muc2xpY2UoMSk7XG4gICAgICAgIGFyZ3NbMF0gPSBuYW1lO1xuICAgICAgICBzZWxmLnRyaWdnZXIuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAndW5wdWJsaXNoJzogZnVuY3Rpb24gKGV2ZW50cykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gdmFsaWRhdGUgZXZlbnRzXG4gICAgYXNzZXJ0LnN0cmluZyhldmVudHMsIHZhbGlkYXRpb25FcnJvcnMuZXZlbnRzKTtcblxuICAgIC8vIHJlbW92ZSB0aGUgY2FjaGUgZm9yIHRoZSBldmVudHNcbiAgICBzZWxmLml0ZXJhdGUoZXZlbnRzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgc2VsZi5fY2FjaGVbbmFtZV0gPSB1bmRlZmluZWQ7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAndW5wdWJsaXNoQWxsJzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9jYWNoZSA9IHt9O1xuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICd0cmlnZ2VyJzogZnVuY3Rpb24gKGV2ZW50cykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gdmFsaWRhdGUgYXJndW1lbnRzXG4gICAgYXNzZXJ0LnN0cmluZyhldmVudHMsIHZhbGlkYXRpb25FcnJvcnMudHJpZ2dlcik7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGV2ZW50cyAmIHRyaWdnZXIgdGhlbVxuICAgIHZhciBwYXJhbXMgPSB0b0FycmF5KGFyZ3VtZW50cywgMSk7XG4gICAgc2VsZi5pdGVyYXRlKGV2ZW50cywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHNlbGYudHJpZ2dlckV2ZW50KG5hbWUsIHBhcmFtcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAndHJpZ2dlckV2ZW50JzogZnVuY3Rpb24gKG5hbWUsIHBhcmFtcykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBldmVudHMgPSBzZWxmLl9ldmVudHMgfHwge307XG5cbiAgICAvLyBjYWxsIHN1Yi1ldmVudCBoYW5kbGVyc1xuICAgIHZhciBjdXJyZW50ID0gW107XG4gICAgdmFyIGZyYWdtZW50cyA9IG5hbWUuc3BsaXQoJzonKTtcbiAgICB3aGlsZSAoZnJhZ21lbnRzLmxlbmd0aCkge1xuICAgICAgY3VycmVudC5wdXNoKGZyYWdtZW50cy5zaGlmdCgpKTtcbiAgICAgIG5hbWUgPSBjdXJyZW50LmpvaW4oJzonKTtcbiAgICAgIGlmIChuYW1lIGluIGV2ZW50cykge1xuICAgICAgICBzZWxmLnRyaWdnZXJTZWN0aW9uKG5hbWUsIGZyYWdtZW50cywgcGFyYW1zKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgJ3RyaWdnZXJTZWN0aW9uJzogZnVuY3Rpb24gKG5hbWUsIGZyYWdtZW50cywgcGFyYW1zKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGV2ZW50cyA9IHNlbGYuX2V2ZW50cyB8fCB7fTtcbiAgICB2YXIgYnVja2V0ID0gZXZlbnRzW25hbWVdIHx8IFtdO1xuXG4gICAgYnVja2V0LmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHZhciBhcmdzO1xuICAgICAgaWYgKGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgYXJncyA9IGNsb25lKHBhcmFtcyk7XG4gICAgICAgIGFyZ3MudW5zaGlmdChmcmFnbWVudHMpO1xuICAgICAgfVxuICAgICAgaXRlbS5jYWxsYmFjay5hcHBseShpdGVtLmNvbnRleHQgfHwgc2VsZiwgYXJncyB8fCBwYXJhbXMpO1xuICAgIH0pO1xuICB9LFxuXG4gICdpdGVyYXRlJzogZnVuY3Rpb24gKGV2ZW50cywgaXRlcmF0b3IpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh0eXBlb2YgZXZlbnRzID09PSAnc3RyaW5nJykge1xuICAgICAgZXZlbnRzID0gZXZlbnRzLnNwbGl0KGV2ZW50U3BsaXR0ZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhc3NlcnQuYXJyYXkoZXZlbnRzKTtcbiAgICB9XG5cbiAgICB3aGlsZSAoZXZlbnRzLmxlbmd0aCkge1xuICAgICAgaXRlcmF0b3IuY2FsbChzZWxmLCBldmVudHMuc2hpZnQoKSk7XG4gICAgfVxuICB9LFxuXG4gICdiaW5kJzogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBzdG9yZSB0aGUgcmVmZXJlbmNlIHRvIHRoZSBjYWxsYmFjayArIGNvbnRleHRcbiAgICB2YXIgZXZlbnRzID0gc2VsZi5fZXZlbnRzIHx8IHt9O1xuICAgIHZhciBidWNrZXQgPSBldmVudHNbbmFtZV0gfHwgKGV2ZW50c1tuYW1lXSA9IFtdKTtcbiAgICBidWNrZXQucHVzaCh7XG4gICAgICAnY2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjb250ZXh0JzogY29udGV4dFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ3VuYmluZCc6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gbG9va3VwIHRoZSByZWZlcmVuY2UgdG8gaGFuZGxlciAmIHJlbW92ZSBpdFxuICAgIHZhciBldmVudHMgPSBzZWxmLl9ldmVudHM7XG4gICAgdmFyIGJ1Y2tldCA9IGV2ZW50c1tuYW1lXSB8fCBbXTtcbiAgICB2YXIgcmV0YWluID0gW107XG5cbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGhhbmRsZXJzXG4gICAgdmFyIGkgPSAtMSwgbCA9IGJ1Y2tldC5sZW5ndGgsIGl0ZW07XG4gICAgd2hpbGUgKCsraSA8IGwpIHtcbiAgICAgIGl0ZW0gPSBidWNrZXRbaV07XG4gICAgICBpZiAoKGNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBpdGVtLmNhbGxiYWNrKSB8fFxuICAgICAgICAgIChjb250ZXh0ICYmIGNvbnRleHQgIT09IGl0ZW0uY29udGV4dCkpIHtcbiAgICAgICAgcmV0YWluLnB1c2goaXRlbSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZmx1c2ggb3V0IGRldGFjaGVkIGhhbmRsZXJzXG4gICAgZXZlbnRzW25hbWVdID0gcmV0YWluO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZXZlbnRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vdG9BcnJheScpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi9tZXJnZScpO1xudmFyIGFzc2VydCA9IHJlcXVpcmUoJy4vYXNzZXJ0Jyk7XG5cbmZ1bmN0aW9uIGV4dGVuZCAoKSB7XG5cbiAgLy8gY29udmVydCB0aGUgYXJndW1lbnQgbGlzdCBpbnRvIGFuIGFycmF5XG4gIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuXG4gIC8vIHZhbGlkYXRlIGlucHV0XG4gIGFzc2VydChhcmdzLmxlbmd0aCA+IDAsICdleHRlbmQgZXhwZWN0IG9uZSBvciBtb3JlIG9iamVjdHMnKTtcblxuICAvLyBsb29wIHRocm91Z2ggdGhlIGFyZ3VtZW50c1xuICAvLyAmIG1lcmdpbmcgdGhlbSByZWN1cnNpdmVseVxuICB2YXIgb2JqZWN0ID0gYXJncy5zaGlmdCgpO1xuICB3aGlsZSAoYXJncy5sZW5ndGgpIHtcbiAgICBtZXJnZShvYmplY3QsIGFyZ3Muc2hpZnQoKSk7XG4gIH1cblxuICByZXR1cm4gb2JqZWN0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZm9yQXJyYXkgKGFycmF5LCBpdGVyYXRvciwgY29udGV4dCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGFycmF5Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmIChpdGVyYXRvci5jYWxsKGNvbnRleHQsIGFycmF5W2ldLCBpLCBhcnJheSkgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGZvck9iamVjdCAob2JqZWN0LCBpdGVyYXRvciwgY29udGV4dCkge1xuICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmplY3Rba2V5XSwga2V5KSA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JFYWNoIChjb2xsZWN0aW9uLCBpdGVyYXRvciwgY29udGV4dCkge1xuICB2YXIgaGFuZGxlciA9IEFycmF5LmlzQXJyYXkoY29sbGVjdGlvbikgPyBmb3JBcnJheSA6IGZvck9iamVjdDtcbiAgaGFuZGxlcihjb2xsZWN0aW9uLCBpdGVyYXRvciwgY29udGV4dCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZm9yRWFjaDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1lcmdlID0gcmVxdWlyZSgnLi9tZXJnZScpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJy4vZXh0ZW5kJyk7XG5cbmZ1bmN0aW9uIG1lcmdlRnJvbVN1cGVyIChpbnN0YW5jZSwga2V5KSB7XG5cbiAgdmFyIGNvbnN0cnVjdG9yID0gaW5zdGFuY2UuY29uc3RydWN0b3I7XG4gIHZhciBwcm90byA9IGNvbnN0cnVjdG9yLnByb3RvdHlwZTtcblxuICB2YXIgYmFzZURhdGEgPSB7fTtcbiAgaWYgKGluc3RhbmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICBiYXNlRGF0YSA9IGluc3RhbmNlW2tleV07XG4gIH0gZWxzZSBpZiAocHJvdG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgIGJhc2VEYXRhID0gcHJvdG9ba2V5XTtcbiAgfVxuXG4gIHZhciBfc3VwZXIgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5fX3N1cGVyX187XG4gIGlmIChfc3VwZXIpIHtcbiAgICBiYXNlRGF0YSA9IG1lcmdlKG1lcmdlRnJvbVN1cGVyKF9zdXBlciwga2V5KSwgYmFzZURhdGEpO1xuICB9XG5cbiAgcmV0dXJuIGV4dGVuZCh7fSwgYmFzZURhdGEpO1xufVxuXG5mdW5jdGlvbiBjb25jYXRGcm9tU3VwZXIgKGluc3RhbmNlLCBrZXkpIHtcblxuICB2YXIgY29uc3RydWN0b3IgPSBpbnN0YW5jZS5jb25zdHJ1Y3RvcjtcbiAgdmFyIHByb3RvID0gY29uc3RydWN0b3IucHJvdG90eXBlO1xuXG4gIHZhciBiYXNlRGF0YSA9IFtdO1xuICBpZiAoaW5zdGFuY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgIGJhc2VEYXRhID0gaW5zdGFuY2Vba2V5XTtcbiAgfSBlbHNlIGlmIChwcm90by5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgYmFzZURhdGEgPSBwcm90b1trZXldO1xuICB9XG5cbiAgdmFyIF9zdXBlciA9IGNvbnN0cnVjdG9yICYmIGNvbnN0cnVjdG9yLl9fc3VwZXJfXztcbiAgaWYgKF9zdXBlcikge1xuICAgIGJhc2VEYXRhID0gW10uY29uY2F0KGNvbmNhdEZyb21TdXBlcihfc3VwZXIsIGtleSksIGJhc2VEYXRhKTtcbiAgfVxuXG4gIHJldHVybiBbXS5jb25jYXQoYmFzZURhdGEpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ21lcmdlJzogbWVyZ2VGcm9tU3VwZXIsXG4gICdjb25jYXQnOiBjb25jYXRGcm9tU3VwZXJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZ1bmN0aW9ucyAob2JqKSB7XG4gIHZhciBmdW5jcyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgaWYgKHR5cGVvZiBvYmpba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZnVuY3MucHVzaChrZXkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZnVuY3M7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb25zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ2Fzc2VydCc6IHJlcXVpcmUoJy4vYXNzZXJ0JyksXG4gICdjbG9uZSc6IHJlcXVpcmUoJy4vY2xvbmUnKSxcbiAgJ2NyZWF0ZVVJRCc6IHJlcXVpcmUoJy4vY3JlYXRlVUlEJyksXG4gICdkZWJvdW5jZSc6IHJlcXVpcmUoJy4vZGVib3VuY2UnKSxcbiAgJ2RlZmVyJzogcmVxdWlyZSgnLi9kZWZlcicpLFxuICAnZGVsYXknOiByZXF1aXJlKCcuL2RlbGF5JyksXG4gICdldmVudHMnOiByZXF1aXJlKCcuL2V2ZW50cycpLFxuICAnZXh0ZW5kJzogcmVxdWlyZSgnLi9leHRlbmQnKSxcbiAgJ2ZvckVhY2gnOiByZXF1aXJlKCcuL2ZvckVhY2gnKSxcbiAgJ2Zyb21TdXBlcic6IHJlcXVpcmUoJy4vZnJvbVN1cGVyJyksXG4gICdmdW5jdGlvbnMnOiByZXF1aXJlKCcuL2Z1bmN0aW9ucycpLFxuICAnaW5oZXJpdHMnOiByZXF1aXJlKCcuL2luaGVyaXRzJyksXG4gICdpc0VxdWFsJzogcmVxdWlyZSgnLi9pc0VxdWFsJyksXG4gICdtZXJnZSc6IHJlcXVpcmUoJy4vbWVyZ2UnKSxcbiAgJ3NpemUnOiByZXF1aXJlKCcuL3NpemUnKSxcbiAgJ3RvQXJyYXknOiByZXF1aXJlKCcuL3RvQXJyYXknKSxcbiAgJ3doZW4nOiByZXF1aXJlKCcuL3doZW4nKSxcbiAgJ3doZXJlJzogcmVxdWlyZSgnLi93aGVyZScpXG59OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV4dGVuZCA9IHJlcXVpcmUoJy4vZXh0ZW5kJyk7XG5cbi8vIEhlbHBlciBmdW5jdGlvbiB0byBjb3JyZWN0bHkgc2V0IHVwIHRoZSBwcm90b3R5cGUgY2hhaW4sIGZvciBzdWJjbGFzc2VzLlxuLy8gU2ltaWxhciB0byBgZ29vZy5pbmhlcml0c2AsIGJ1dCB1c2VzIGEgaGFzaCBvZiBwcm90b3R5cGUgcHJvcGVydGllcyBhbmRcbi8vIGNsYXNzIHByb3BlcnRpZXMgdG8gYmUgZXh0ZW5kZWQuXG5mdW5jdGlvbiBpbmhlcml0cyAocGFyZW50LCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuXG4gIHZhciBjaGlsZDtcblxuICAvLyBUaGUgY29uc3RydWN0b3IgZnVuY3Rpb24gZm9yIHRoZSBuZXcgc3ViY2xhc3MgaXMgZWl0aGVyIGRlZmluZWQgYnkgeW91XG4gIC8vICh0aGUgXCJjb25zdHJ1Y3RvclwiIHByb3BlcnR5IGluIHlvdXIgYGV4dGVuZGAgZGVmaW5pdGlvbiksIG9yIGRlZmF1bHRlZFxuICAvLyBieSB1cyB0byBzaW1wbHkgY2FsbCBgc3VwZXIoKWAuXG4gIGlmIChwcm90b1Byb3BzICYmIHByb3RvUHJvcHMuaGFzT3duUHJvcGVydHkoJ2NvbnN0cnVjdG9yJykpIHtcbiAgICBjaGlsZCA9IHByb3RvUHJvcHMuY29uc3RydWN0b3I7XG4gIH1cbiAgZWxzZSB7XG4gICAgY2hpbGQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIEluaGVyaXQgY2xhc3MgKHN0YXRpYykgcHJvcGVydGllcyBmcm9tIHBhcmVudC5cbiAgZXh0ZW5kKGNoaWxkLCBwYXJlbnQpO1xuXG4gIC8vIFNldCB0aGUgcHJvdG90eXBlIGNoYWluIHRvIGluaGVyaXQgZnJvbSBgcGFyZW50YCwgd2l0aG91dCBjYWxsaW5nXG4gIC8vIGBwYXJlbnRgJ3MgY29uc3RydWN0b3IgZnVuY3Rpb24uXG4gIGNoaWxkLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUocGFyZW50LnByb3RvdHlwZSk7XG5cbiAgLy8gQWRkIHByb3RvdHlwZSBwcm9wZXJ0aWVzIChpbnN0YW5jZSBwcm9wZXJ0aWVzKSB0byB0aGUgc3ViY2xhc3MsXG4gIC8vIGlmIHN1cHBsaWVkLlxuICBleHRlbmQoY2hpbGQucHJvdG90eXBlLCBwcm90b1Byb3BzKTtcblxuICAvLyBDb3JyZWN0bHkgc2V0IGNoaWxkJ3MgYHByb3RvdHlwZS5jb25zdHJ1Y3RvcmAuXG4gIGNoaWxkLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGNoaWxkO1xuXG4gIC8vIEFkZCBzdGF0aWMgcHJvcGVydGllcyB0byB0aGUgY29uc3RydWN0b3IgZnVuY3Rpb24sIGlmIHN1cHBsaWVkLlxuICBleHRlbmQoY2hpbGQsIHN0YXRpY1Byb3BzKTtcblxuICAvLyBTZXQgYSBjb252ZW5pZW5jZSBwcm9wZXJ0eVxuICAvLyBpbiBjYXNlIHRoZSBwYXJlbnQncyBwcm90b3R5cGUgaXMgbmVlZGVkIGxhdGVyLlxuICBjaGlsZC5fX3N1cGVyX18gPSBwYXJlbnQucHJvdG90eXBlO1xuXG4gIHJldHVybiBjaGlsZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbmhlcml0cztcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogaW1wbGVtZW50IGRlZXBFcXVhbFxuZnVuY3Rpb24gaXNFcXVhbCAoYSwgYikge1xuICByZXR1cm4gYSA9PT0gYjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc0VxdWFsO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vdG9BcnJheScpO1xuXG5mdW5jdGlvbiBtZXJnZSAob2JqZWN0LCBzb3VyY2UpIHtcbiAgdmFyIHNvdXJjZXMgPSB0b0FycmF5KGFyZ3VtZW50cywgMSk7XG4gIHdoaWxlIChzb3VyY2VzLmxlbmd0aCkge1xuICAgIHNvdXJjZSA9IHNvdXJjZXMuc2hpZnQoKTtcbiAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZXJnZTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gc2l6ZSAoY29sbGVjdGlvbikge1xuICAhQXJyYXkuaXNBcnJheShjb2xsZWN0aW9uKSAmJiAoY29sbGVjdGlvbiA9IE9iamVjdC5rZXlzKGNvbGxlY3Rpb24pKTtcbiAgcmV0dXJuIGNvbGxlY3Rpb24ubGVuZ3RoO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNpemU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbmZ1bmN0aW9uIHRvQXJyYXkgKG9iaiwgc2tpcCkge1xuICByZXR1cm4gc2xpY2UuY2FsbChvYmosIHNraXAgfHwgMCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9BcnJheTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFdCRGVmZXJyZWQgPSByZXF1aXJlKCcuLi9XQkRlZmVycmVkJyk7XG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vdG9BcnJheScpO1xuXG5mdW5jdGlvbiBXaGVuICgpIHtcblxuICB2YXIgY29udGV4dCA9IHRoaXM7XG4gIHZhciBtYWluID0gbmV3IFdCRGVmZXJyZWQoY29udGV4dCk7XG4gIHZhciBkZWZlcnJlZHMgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG5cbiAgLy8gc3VwcG9ydCBwYXNzaW5nIGFuIGFycmF5IG9mIGRlZmVycmVkcywgdG8gYXZvaWQgYGFwcGx5YFxuICBpZiAoZGVmZXJyZWRzLmxlbmd0aCA9PT0gMSAmJiBBcnJheS5pc0FycmF5KGRlZmVycmVkc1swXSkpIHtcbiAgICBkZWZlcnJlZHMgPSBkZWZlcnJlZHNbMF07XG4gIH1cblxuICB2YXIgY291bnQgPSBkZWZlcnJlZHMubGVuZ3RoO1xuICB2YXIgYXJncyA9IG5ldyBBcnJheShjb3VudCk7XG5cbiAgZnVuY3Rpb24gRmFpbCAoKSB7XG4gICAgbWFpbi5yZWplY3RXaXRoKHRoaXMpO1xuICB9XG5cbiAgZnVuY3Rpb24gRG9uZSAoKSB7XG5cbiAgICBpZiAobWFpbi5zdGF0ZSgpID09PSAncmVqZWN0ZWQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluZGV4ID0gY291bnQgLSBkZWZlcnJlZHMubGVuZ3RoIC0gMTtcbiAgICBhcmdzW2luZGV4XSA9IHRvQXJyYXkoYXJndW1lbnRzKTtcblxuICAgIGlmIChkZWZlcnJlZHMubGVuZ3RoKSB7XG4gICAgICB2YXIgbmV4dCA9IGRlZmVycmVkcy5zaGlmdCgpO1xuICAgICAgbmV4dC5kb25lKERvbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgICBtYWluLnJlc29sdmVXaXRoLmFwcGx5KG1haW4sIGFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIGlmIChkZWZlcnJlZHMubGVuZ3RoKSB7XG5cbiAgICBkZWZlcnJlZHMuZm9yRWFjaChmdW5jdGlvbiAoZGVmZXJyZWQpIHtcbiAgICAgIGRlZmVycmVkLmZhaWwoRmFpbCk7XG4gICAgfSk7XG5cbiAgICB2YXIgY3VycmVudCA9IGRlZmVycmVkcy5zaGlmdCgpO1xuICAgIGN1cnJlbnQuZG9uZShEb25lKTtcbiAgfSBlbHNlIHtcbiAgICBtYWluLnJlc29sdmUoKTtcbiAgfVxuXG4gIHJldHVybiBtYWluLnByb21pc2UoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBXaGVuO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm9yRWFjaCA9IHJlcXVpcmUoJy4vZm9yRWFjaCcpO1xuXG5mdW5jdGlvbiB3aGVyZSAoY29sbGVjdGlvbiwgcHJvcGVydGllcykge1xuICB2YXIgbWF0Y2hlcyA9IFtdO1xuICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgZm9yICh2YXIga2V5IGluIHByb3BlcnRpZXMpIHtcbiAgICAgIGlmIChpdGVtW2tleV0gIT09IHByb3BlcnRpZXNba2V5XSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBtYXRjaGVzLnB1c2goaXRlbSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIG1hdGNoZXM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd2hlcmU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xudmFyIGZyb21TdXBlciA9IHJlcXVpcmUoJy4uL2xpYi9mcm9tU3VwZXInKTtcblxudmFyIENvbnRyb2xsYWJsZU1peGluID0gV0JNaXhpbi5leHRlbmQoe1xuXG4gICdpbml0aWFsaXplJzogZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5jb250cm9sbGVycyA9IFtdO1xuICAgIHNlbGYuaW1wbGVtZW50ZWQgPSBbXTtcblxuICAgIHNlbGYuaW1wbGVtZW50cyA9IGZyb21TdXBlci5jb25jYXQoc2VsZiwgJ2ltcGxlbWVudHMnKTtcbiAgICBzZWxmLmNyZWF0ZUNvbnRyb2xsZXJJbnN0YW5jZXMoKTtcblxuICAgIHNlbGYuYmluZE9uY2VUbyhzZWxmLCAnZGVzdHJveScsICdkZXN0cm95Q29udHJvbGxlcnMnKTtcbiAgfSxcblxuICAnY3JlYXRlQ29udHJvbGxlckluc3RhbmNlcyc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBDb250cm9sbGVycyA9IHNlbGYuaW1wbGVtZW50cztcbiAgICBpZiAodHlwZW9mIENvbnRyb2xsZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBDb250cm9sbGVycyA9IENvbnRyb2xsZXJzLmNhbGwoc2VsZik7XG4gICAgfVxuICAgIENvbnRyb2xsZXJzLnJldmVyc2UoKTtcblxuICAgIHZhciBDb250cm9sbGVyQ2xhc3MsIGNvbnRyb2xsZXJJbnN0YW5jZSwgaTtcbiAgICBmb3IgKGkgPSBDb250cm9sbGVycy5sZW5ndGg7IGktLTspIHtcbiAgICAgIENvbnRyb2xsZXJDbGFzcyA9IENvbnRyb2xsZXJzW2ldO1xuXG4gICAgICAvLyBJZiB3ZSBoYXZlIGFscmVhZHkgaW1wbGVtZW50ZWQgYSBjb250cm9sbGVyIHRoYXQgaW5oZXJpdHMgZnJvbVxuICAgICAgLy8gdGhpcyBjb250cm9sbGVyLCB3ZSBkb24ndCBuZWVkIGFub3RoZXIgb25lLi4uXG4gICAgICBpZiAoc2VsZi5pbXBsZW1lbnRlZC5pbmRleE9mKENvbnRyb2xsZXJDbGFzcy50b1N0cmluZygpKSA8IDApIHtcblxuICAgICAgICBjb250cm9sbGVySW5zdGFuY2UgPSBuZXcgQ29udHJvbGxlckNsYXNzKHNlbGYpO1xuICAgICAgICBzZWxmLmNvbnRyb2xsZXJzLnB1c2goY29udHJvbGxlckluc3RhbmNlKTtcbiAgICAgICAgY29udHJvbGxlckluc3RhbmNlLnBhcmVudCA9IHNlbGY7XG5cbiAgICAgICAgc2VsZi50cmFja0ltcGxlbWVudGVkU3VwZXJDb25zdHJ1Y3RvcnMoQ29udHJvbGxlckNsYXNzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2VsZi5pbXBsZW1lbnRlZDtcbiAgfSxcblxuICAndHJhY2tJbXBsZW1lbnRlZFN1cGVyQ29uc3RydWN0b3JzJzogZnVuY3Rpb24gKENvbnRyb2xsZXIpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgX3N1cGVyID0gQ29udHJvbGxlci5fX3N1cGVyX187XG4gICAgdmFyIHN1cGVyQ29uc3RydWN0b3IgPSBfc3VwZXIgJiYgX3N1cGVyLmNvbnN0cnVjdG9yO1xuXG4gICAgaWYgKHN1cGVyQ29uc3RydWN0b3IpIHtcbiAgICAgIHNlbGYuaW1wbGVtZW50ZWQucHVzaChzdXBlckNvbnN0cnVjdG9yLnRvU3RyaW5nKCkpO1xuICAgICAgc2VsZi50cmFja0ltcGxlbWVudGVkU3VwZXJDb25zdHJ1Y3RvcnMoc3VwZXJDb25zdHJ1Y3Rvcik7XG4gICAgfVxuICB9LFxuXG4gICdkZXN0cm95Q29udHJvbGxlcnMnOiBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBMb29wIGFuZCBkZXN0cm95XG4gICAgdmFyIGNvbnRyb2xsZXI7XG4gICAgdmFyIGNvbnRyb2xsZXJzID0gc2VsZi5jb250cm9sbGVycztcblxuICAgIHdoaWxlIChjb250cm9sbGVycy5sZW5ndGgpIHtcbiAgICAgIC8vIEEgY29udHJvbGxlciBjYW4gZXhpc3QgbXVsdGlwbGUgdGltZXMgaW4gdGhlIGxpc3QsXG4gICAgICAvLyBzaW5jZSBpdCdzIGJhc2VkIG9uIHRoZSBldmVudCBuYW1lLFxuICAgICAgLy8gc28gbWFrZSBzdXJlIHRvIG9ubHkgZGVzdHJveSBlYWNoIG9uZSBvbmNlXG4gICAgICBjb250cm9sbGVyID0gY29udHJvbGxlcnMuc2hpZnQoKTtcbiAgICAgIGNvbnRyb2xsZXIuZGVzdHJveWVkIHx8IGNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQ29udHJvbGxhYmxlTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xudmFyIGZyb21TdXBlciA9IHJlcXVpcmUoJy4uL2xpYi9mcm9tU3VwZXInKTtcbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4uL2xpYi9jbG9uZScpO1xuXG52YXIgT2JzZXJ2YWJsZUhhc2hNaXhpbiA9IFdCTWl4aW4uZXh0ZW5kKHtcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBvYnNlcnZlc0hhc2ggPSBmcm9tU3VwZXIubWVyZ2Uoc2VsZiwgJ29ic2VydmVzJyk7XG4gICAgZm9yICh2YXIgdGFyZ2V0IGluIG9ic2VydmVzSGFzaCkge1xuICAgICAgc2VsZi5iaW5kVG9UYXJnZXQoc2VsZi5yZXNvbHZlVGFyZ2V0KHRhcmdldCksIG9ic2VydmVzSGFzaFt0YXJnZXRdKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2JpbmRUb1RhcmdldCc6IGZ1bmN0aW9uICh0YXJnZXQsIGV2ZW50cykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZm9yICh2YXIgZXZlbnRTdHJpbmcgaW4gZXZlbnRzKSB7XG4gICAgICBzZWxmLmJpbmRIYW5kbGVycyh0YXJnZXQsIGV2ZW50U3RyaW5nLCBldmVudHNbZXZlbnRTdHJpbmddKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2JpbmRIYW5kbGVycyc6IGZ1bmN0aW9uICh0YXJnZXQsIGV2ZW50U3RyaW5nLCBoYW5kbGVycykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnMgPSBjbG9uZShoYW5kbGVycyk7XG4gICAgfVxuXG4gICAgd2hpbGUgKGhhbmRsZXJzLmxlbmd0aCkge1xuICAgICAgc2VsZi5iaW5kVG8odGFyZ2V0LCBldmVudFN0cmluZywgaGFuZGxlcnMuc2hpZnQoKSk7XG4gICAgfVxuICB9LFxuXG4gICdyZXNvbHZlVGFyZ2V0JzogZnVuY3Rpb24gKGtleSkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gYWxsb3cgb2JzZXJ2aW5nIHNlbGZcbiAgICBpZiAoa2V5ID09PSAnc2VsZicpIHtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH1cblxuICAgIHZhciB0YXJnZXQgPSBzZWxmW2tleV07XG4gICAgaWYgKCF0YXJnZXQgJiYgdHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYga2V5LmluZGV4T2YoJy4nKSA+IC0xKSB7XG4gICAgICBrZXkgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICAgIHRhcmdldCA9IHNlbGY7XG4gICAgICB3aGlsZSAoa2V5Lmxlbmd0aCAmJiB0YXJnZXQpIHtcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0W2tleS5zaGlmdCgpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9ic2VydmFibGVIYXNoTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xuLy8gdmFyIGFzc2VydCA9IHJlcXVpcmUoJy4uL2xpYi9hc3NlcnQnKTtcbnZhciBjcmVhdGVVSUQgPSByZXF1aXJlKCcuLi9saWIvY3JlYXRlVUlEJyk7XG5cbnZhciBXQkJpbmRhYmxlTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ3Byb3BlcnRpZXMnOiB7XG4gICAgJ19iaW5kaW5ncyc6IHt9LFxuICAgICdfbmFtZWRFdmVudHMnOiB7fVxuICB9LFxuXG4gIC8vIGtlZXBzIGNhbGxiYWNrIGNsb3N1cmUgaW4gb3duIGV4ZWN1dGlvbiBjb250ZXh0IHdpdGhcbiAgLy8gb25seSBjYWxsYmFjayBhbmQgY29udGV4dFxuICAnY2FsbGJhY2tGYWN0b3J5JzogZnVuY3Rpb24gIChjYWxsYmFjaywgY29udGV4dCkge1xuXG4gICAgdmFyIGJpbmRDYWxsYmFjaztcblxuICAgIHZhciBmb3JTdHJpbmcgPSBmdW5jdGlvbiBzdHJpbmdDYWxsYmFjayAoKSB7XG4gICAgICBjb250ZXh0W2NhbGxiYWNrXS5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICB2YXIgZm9yRnVuY3Rpb24gPSBmdW5jdGlvbiBmdW5jdGlvbkNhbGxiYWNrICgpIHtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSB7XG4gICAgICBiaW5kQ2FsbGJhY2sgPSBmb3JTdHJpbmc7XG4gICAgICAvLyBjYW5jZWwgYWx0ZXJuYXRlIGNsb3N1cmUgaW1tZWRpYXRlbHlcbiAgICAgIGZvckZ1bmN0aW9uID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBiaW5kQ2FsbGJhY2sgPSBmb3JGdW5jdGlvbjtcbiAgICAgIGZvclN0cmluZyA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJpbmRDYWxsYmFjaztcbiAgfSxcblxuICAnYmluZFRvJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jaGVja0JpbmRpbmdBcmdzLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG5cbiAgICAvLyBkZWZhdWx0IHRvIHNlbGYgaWYgY29udGV4dCBub3QgcHJvdmlkZWRcbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuXG4gICAgLy8gaWYgdGhpcyBiaW5kaW5nIGFscmVhZHkgbWFkZSwgcmV0dXJuIGl0XG4gICAgdmFyIGJvdW5kID0gc2VsZi5pc0FscmVhZHlCb3VuZCh0YXJnZXQsIGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgaWYgKGJvdW5kKSB7XG4gICAgICByZXR1cm4gYm91bmQ7XG4gICAgfVxuXG5cbiAgICB2YXIgY2FsbGJhY2tGdW5jLCBhcmdzO1xuXG4gICAgLy8gaWYgYSBqcXVlcnkgb2JqZWN0XG4gICAgaWYgKHRhcmdldC5jb25zdHJ1Y3RvciAmJiB0YXJnZXQuY29uc3RydWN0b3IuZm4gJiYgdGFyZ2V0LmNvbnN0cnVjdG9yLmZuLm9uID09PSB0YXJnZXQub24pIHtcbiAgICAgIC8vIGpxdWVyeSBkb2VzIG5vdCB0YWtlIGNvbnRleHQgaW4gLm9uKClcbiAgICAgIC8vIGNhbm5vdCBhc3N1bWUgb24gdGFrZXMgY29udGV4dCBhcyBhIHBhcmFtIGZvciBiaW5kYWJsZSBvYmplY3RcbiAgICAgIC8vIGNyZWF0ZSBhIGNhbGxiYWNrIHdoaWNoIHdpbGwgYXBwbHkgdGhlIG9yaWdpbmFsIGNhbGxiYWNrIGluIHRoZSBjb3JyZWN0IGNvbnRleHRcbiAgICAgIGNhbGxiYWNrRnVuYyA9IHNlbGYuY2FsbGJhY2tGYWN0b3J5KGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICAgIGFyZ3MgPSBbZXZlbnQsIGNhbGxiYWNrRnVuY107XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEJhY2tib25lIGFjY2VwdHMgY29udGV4dCB3aGVuIGJpbmRpbmcsIHNpbXBseSBwYXNzIGl0IG9uXG4gICAgICBjYWxsYmFja0Z1bmMgPSAodHlwZW9mIGNhbGxiYWNrID09PSAnc3RyaW5nJykgPyBjb250ZXh0W2NhbGxiYWNrXSA6IGNhbGxiYWNrO1xuICAgICAgYXJncyA9IFtldmVudCwgY2FsbGJhY2tGdW5jLCBjb250ZXh0XTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYmluZGluZyBvbiB0YXJnZXRcbiAgICB0YXJnZXQub24uYXBwbHkodGFyZ2V0LCBhcmdzKTtcblxuICAgIHZhciBiaW5kaW5nID0ge1xuICAgICAgJ3VpZCc6IGNyZWF0ZVVJRCgpLFxuICAgICAgJ3RhcmdldCc6IHRhcmdldCxcbiAgICAgICdldmVudCc6IGV2ZW50LFxuICAgICAgJ29yaWdpbmFsQ2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjYWxsYmFjayc6IGNhbGxiYWNrRnVuYyxcbiAgICAgICdjb250ZXh0JzogY29udGV4dFxuICAgIH07XG5cbiAgICBzZWxmLl9iaW5kaW5nc1tiaW5kaW5nLnVpZF0gPSBiaW5kaW5nO1xuICAgIHNlbGYuYWRkVG9OYW1lZEJpbmRpbmdzKGV2ZW50LCBiaW5kaW5nKTtcblxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9LFxuXG4gICdiaW5kT25jZVRvJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jaGVja0JpbmRpbmdBcmdzLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG5cbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuXG4gICAgLy8gaWYgdGhpcyBiaW5kaW5nIGFscmVhZHkgbWFkZSwgcmV0dXJuIGl0XG4gICAgdmFyIGJvdW5kID0gc2VsZi5pc0FscmVhZHlCb3VuZCh0YXJnZXQsIGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgaWYgKGJvdW5kKSB7XG4gICAgICByZXR1cm4gYm91bmQ7XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIGEgd3JhcHBlclxuICAgIHZhciBvbmNlQmluZGluZyA9IGZ1bmN0aW9uICgpIHtcblxuICAgICAgKCh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSA/IGNvbnRleHRbY2FsbGJhY2tdIDogY2FsbGJhY2spLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgICBzZWxmLnVuYmluZEZyb20oYmluZGluZyk7XG4gICAgfTtcblxuICAgIHZhciBiaW5kaW5nID0ge1xuICAgICAgJ3VpZCc6IGNyZWF0ZVVJRCgpLFxuICAgICAgJ3RhcmdldCc6IHRhcmdldCxcbiAgICAgICdldmVudCc6IGV2ZW50LFxuICAgICAgJ29yaWdpbmFsQ2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjYWxsYmFjayc6IG9uY2VCaW5kaW5nLFxuICAgICAgJ2NvbnRleHQnOiBjb250ZXh0XG4gICAgfTtcblxuICAgIHRhcmdldC5vbihldmVudCwgb25jZUJpbmRpbmcsIGNvbnRleHQpO1xuXG4gICAgc2VsZi5fYmluZGluZ3NbYmluZGluZy51aWRdID0gYmluZGluZztcbiAgICBzZWxmLmFkZFRvTmFtZWRCaW5kaW5ncyhldmVudCwgYmluZGluZyk7XG5cbiAgICByZXR1cm4gYmluZGluZztcbiAgfSxcblxuICAndW5iaW5kRnJvbSc6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgdWlkID0gYmluZGluZyAmJiBiaW5kaW5nLnVpZDtcbiAgICBpZiAoIWJpbmRpbmcgfHwgKHR5cGVvZiB1aWQgIT09ICdzdHJpbmcnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdW5iaW5kIGZyb20gdW5kZWZpbmVkIG9yIGludmFsaWQgYmluZGluZycpO1xuICAgIH1cblxuICAgIHZhciBldmVudCA9IGJpbmRpbmcuZXZlbnQ7XG4gICAgdmFyIGNvbnRleHQgPSBiaW5kaW5nLmNvbnRleHQ7XG4gICAgdmFyIGNhbGxiYWNrID0gYmluZGluZy5jYWxsYmFjaztcbiAgICB2YXIgdGFyZ2V0ID0gYmluZGluZy50YXJnZXQ7XG5cbiAgICAvLyBhIGJpbmRpbmcgb2JqZWN0IHdpdGggb25seSB1aWQsIGkuZS4gYSBkZXN0cm95ZWQvdW5ib3VuZFxuICAgIC8vIGJpbmRpbmcgb2JqZWN0IGhhcyBiZWVuIHBhc3NlZCAtIGp1c3QgZG8gbm90aGluZ1xuICAgIGlmICghZXZlbnQgfHwgIWNhbGxiYWNrIHx8ICF0YXJnZXQgfHwgIWNvbnRleHQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0YXJnZXQub2ZmKGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICAvLyBjbGVhbiB1cCBiaW5kaW5nIG9iamVjdCwgYnV0IGtlZXAgdWlkIHRvXG4gICAgLy8gbWFrZSBzdXJlIG9sZCBiaW5kaW5ncywgdGhhdCBoYXZlIGFscmVhZHkgYmVlblxuICAgIC8vIGNsZWFuZWQsIGFyZSBzdGlsbCByZWNvZ25pemVkIGFzIGJpbmRpbmdzXG4gICAgZm9yICh2YXIga2V5IGluIGJpbmRpbmcpIHtcbiAgICAgIGlmIChrZXkgIT09ICd1aWQnKSB7XG4gICAgICAgIGRlbGV0ZSBiaW5kaW5nW2tleV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZGVsZXRlIHNlbGYuX2JpbmRpbmdzW3VpZF07XG5cbiAgICB2YXIgbmFtZWRFdmVudHMgPSBzZWxmLl9uYW1lZEV2ZW50cztcbiAgICB2YXIgZXZlbnRzID0gbmFtZWRFdmVudHNbZXZlbnRdO1xuXG4gICAgaWYgKGV2ZW50cykge1xuICAgICAgdmFyIGNsb25lZCA9IGV2ZW50cyAmJiBldmVudHMuc2xpY2UoMCk7XG4gICAgICBmb3IgKHZhciBpID0gZXZlbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChldmVudHNbaV0udWlkID09PSB1aWQpIHtcbiAgICAgICAgICBjbG9uZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG5hbWVkRXZlbnRzW2V2ZW50XSA9IGNsb25lZDtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH0sXG5cbiAgJ3VuYmluZEZyb21UYXJnZXQnOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoIXRhcmdldCB8fCAodHlwZW9mIHRhcmdldC5vbiAhPT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVuYmluZCBmcm9tIHVuZGVmaW5lZCBvciBpbnZhbGlkIGJpbmRpbmcgdGFyZ2V0Jyk7XG4gICAgfVxuXG4gICAgdmFyIGJpbmRpbmc7XG4gICAgZm9yICh2YXIga2V5IGluIHNlbGYuX2JpbmRpbmdzKSB7XG4gICAgICBiaW5kaW5nID0gc2VsZi5fYmluZGluZ3Nba2V5XTtcbiAgICAgIGlmIChiaW5kaW5nLnRhcmdldCA9PT0gdGFyZ2V0KSB7XG4gICAgICAgIHNlbGYudW5iaW5kRnJvbShiaW5kaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgJ3VuYmluZEFsbCc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBiaW5kaW5nO1xuICAgIGZvciAodmFyIGtleSBpbiBzZWxmLl9iaW5kaW5ncykge1xuICAgICAgYmluZGluZyA9IHNlbGYuX2JpbmRpbmdzW2tleV07XG4gICAgICBzZWxmLnVuYmluZEZyb20oYmluZGluZyk7XG4gICAgfVxuICB9LFxuXG4gICdjaGVja0JpbmRpbmdBcmdzJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCB0aGlzO1xuXG4gICAgLy8gZG8gbm90IGNoYW5nZSB0aGVzZSBtZXNzYWdlcyB3aXRob3V0IHVwZGF0aW5nIHRoZSBzcGVjc1xuICAgIGlmICghdGFyZ2V0IHx8ICh0eXBlb2YgdGFyZ2V0Lm9uICE9PSAnZnVuY3Rpb24nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB1bmRlZmluZWQgdGFyZ2V0IG9yIHRhcmdldCB3aXRob3V0ICNvbiBtZXRob2QnKTtcbiAgICB9XG5cbiAgICBpZiAoIWV2ZW50IHx8ICh0eXBlb2YgZXZlbnQgIT09ICdzdHJpbmcnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB0YXJnZXQgZXZlbnQgd2l0aG91dCBldmVudCBuYW1lJyk7XG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFjayB8fCAoKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykgJiYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ3N0cmluZycpKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB0YXJnZXQgZXZlbnQgd2l0aG91dCBhIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIGFzIGNhbGxiYWNrJyk7XG4gICAgfVxuXG4gICAgaWYgKCh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSAmJiAhY29udGV4dFtjYWxsYmFja10pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGJpbmQgdG8gdGFyZ2V0IHVzaW5nIGEgbWV0aG9kIG5hbWUgdGhhdCBkb2VzIG5vdCBleGlzdCBmb3IgdGhlIGNvbnRleHQnKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2lzQWxyZWFkeUJvdW5kJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gY2hlY2sgZm9yIHNhbWUgY2FsbGJhY2sgb24gdGhlIHNhbWUgdGFyZ2V0IGluc3RhbmNlXG4gICAgLy8gcmV0dXJuIGVhcmx5IHdpdGh0aGUgZXZlbnQgYmluZGluZ1xuICAgIHZhciBldmVudHMgPSBzZWxmLl9uYW1lZEV2ZW50c1tldmVudF07XG4gICAgaWYgKGV2ZW50cykge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIG1heCA9IGV2ZW50cy5sZW5ndGg7IGkgPCBtYXg7IGkrKykge1xuXG4gICAgICAgIHZhciBjdXJyZW50ID0gZXZlbnRzW2ldIHx8IHt9O1xuXG4gICAgICAgIC8vIHRoZSBiZWxvdyAhYm91bmRUYXJnZXQgY2hlY2sgc2VlbXMgdW5yZWFjaGFibGVcbiAgICAgICAgLy8gd2FzIGFkZGVkIGluIHRoaXMgY29tbWl0IG9mIHRoZSB3ZWIgYXBwOiBjNzVkNTA3N2MwYTg2MjliNjBjYjZkZDFjZDc4ZDNiYzc3ZmNhYzQ4XG4gICAgICAgIC8vIG5lZWQgdG8gYXNrIEFkYW0gdW5kZXIgd2hhdCBjb25kaXRpb25zIHRoaXMgd291bGQgYmUgcG9zc2libGVcbiAgICAgICAgdmFyIGJvdW5kVGFyZ2V0ID0gY3VycmVudC50YXJnZXQ7XG4gICAgICAgIGlmICghYm91bmRUYXJnZXQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdGFyZ2V0Qm91bmQgPSB0YXJnZXQudWlkID8gdGFyZ2V0LnVpZCA9PT0gYm91bmRUYXJnZXQudWlkIDogZmFsc2U7XG4gICAgICAgIGlmIChjdXJyZW50Lm9yaWdpbmFsQ2FsbGJhY2sgPT09IGNhbGxiYWNrICYmXG4gICAgICAgICAgICBjdXJyZW50LmNvbnRleHQgPT09IGNvbnRleHQgJiYgdGFyZ2V0Qm91bmQpIHtcbiAgICAgICAgICByZXR1cm4gY3VycmVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICAnYWRkVG9OYW1lZEJpbmRpbmdzJzogZnVuY3Rpb24gKGV2ZW50LCBiaW5kaW5nKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9uYW1lZEV2ZW50c1tldmVudF0pIHtcbiAgICAgIHNlbGYuX25hbWVkRXZlbnRzW2V2ZW50XSA9IFtdO1xuICAgIH1cbiAgICBzZWxmLl9uYW1lZEV2ZW50c1tldmVudF0ucHVzaChiaW5kaW5nKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JCaW5kYWJsZU1peGluO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm9yRWFjaCA9IHJlcXVpcmUoJy4uL2xpYi9mb3JFYWNoJyk7XG52YXIgV0JNaXhpbiA9IHJlcXVpcmUoJy4uL1dCTWl4aW4nKTtcblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBDYWxsIChmbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoZm4gPSBzZWxmW2ZuXSk7XG4gICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpICYmIGZuLmNhbGwoc2VsZik7XG59XG5cbnZhciBjbGVhbnVwTWV0aG9kcyA9IFsndW5iaW5kJywgJ3VuYmluZEFsbCcsICdvbkRlc3Ryb3knXTtcblxudmFyIFdCRGVzdHJveWFibGVNaXhpbiA9IFdCTWl4aW4uZXh0ZW5kKHtcblxuICAnZGVzdHJveSc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYudHJpZ2dlcignZGVzdHJveScpO1xuXG4gICAgLy8gY2xlYW4gdXBcbiAgICBmb3JFYWNoKGNsZWFudXBNZXRob2RzLCBDYWxsLCBzZWxmKTtcblxuICAgIHNlbGYuZGVzdHJveU9iamVjdChzZWxmKTtcblxuICAgIHNlbGYuZGVzdHJveWVkID0gdHJ1ZTtcbiAgfSxcblxuICAnZGVzdHJveU9iamVjdCc6IGZ1bmN0aW9uIChvYmplY3QpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICBzZWxmLmRlc3Ryb3lLZXkoa2V5LCBvYmplY3QpO1xuICAgIH1cbiAgfSxcblxuICAnZGVzdHJveUtleSc6IGZ1bmN0aW9uIChrZXksIGNvbnRleHQpIHtcblxuICAgIGlmIChjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkgJiYga2V5ICE9PSAndWlkJyAmJiBrZXkgIT09ICdjaWQnKSB7XG4gICAgICAvLyBtYWtlIGZ1bmN0aW9ucyBub29wXG4gICAgICBpZiAodHlwZW9mIGNvbnRleHRba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjb250ZXh0W2tleV0gPSBub29wO1xuICAgICAgfVxuICAgICAgLy8gYW5kIG90aGVycyB1bmRlZmluZWRcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb250ZXh0W2tleV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQkRlc3Ryb3lhYmxlTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xudmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9ldmVudHMnKTtcblxudmFyIFdCRXZlbnRzTWl4aW4gPSBXQk1peGluLmV4dGVuZChldmVudHMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdCRXZlbnRzTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4uL2xpYi9jbG9uZScpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vbGliL21lcmdlJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi4vbGliL2V4dGVuZCcpO1xudmFyIGlzRXF1YWwgPSByZXF1aXJlKCcuLi9saWIvaXNFcXVhbCcpO1xudmFyIFdCTWl4aW4gPSByZXF1aXJlKCcuLi9XQk1peGluJyk7XG5cbnZhciBXQlN0YXRlTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ2F0dHJpYnV0ZXMnOiB7fSxcbiAgJ29wdGlvbnMnOiB7fSxcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5hdHRyaWJ1dGVzID0gZXh0ZW5kKHt9LCBzZWxmLmRlZmF1bHRzLCBhdHRyaWJ1dGVzKTtcbiAgICBzZWxmLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHNlbGYuY2hhbmdlZCA9IHt9O1xuICB9LFxuXG4gICdnZXQnOiBmdW5jdGlvbiAoa2V5KSB7XG4gICAgY29uc29sZS53YXJuKCdnZXR0ZXJzIGFyZSBkZXByZWNhdGVkJyk7XG4gICAgcmV0dXJuIHRoaXMuYXR0cmlidXRlc1trZXldO1xuICB9LFxuXG4gICdzZXQnOiBmdW5jdGlvbiAoa2V5LCB2YWwsIG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoa2V5ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9XG5cbiAgICB2YXIgYXR0cnMsIGF0dHI7XG4gICAgLy8gSGFuZGxlIGJvdGggYFwia2V5XCIsIHZhbHVlYCBhbmQgYHtrZXk6IHZhbHVlfWAgLXN0eWxlIGFyZ3VtZW50cy5cbiAgICBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGF0dHJzID0ga2V5O1xuICAgICAgb3B0aW9ucyA9IHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgYXR0cnMgPSB7fTtcbiAgICAgIGF0dHJzW2tleV0gPSB2YWw7XG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBvcHRpb25zIGFyZSBlbXB0eVxuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICAvLyBubyBuZWVkIHRvIHRyYWNrIGNoYW5nZXMgb24gb3B0aW9ucy5zaWxlbnRcbiAgICBpZiAob3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgIG1lcmdlKHNlbGYuYXR0cmlidXRlcywgYXR0cik7XG4gICAgfVxuICAgIC8vIEZvciBlYWNoIGBzZXRgIGF0dHJpYnV0ZSwgdXBkYXRlIG9yIGRlbGV0ZSB0aGUgY3VycmVudCB2YWx1ZS5cbiAgICBlbHNlIHtcbiAgICAgIHZhciBjaGFuZ2VzID0gc2VsZi5jaGFuZ2VzKGF0dHJzLCBvcHRpb25zKTtcbiAgICAgIHNlbGYuX3RyaWdnZXIoYXR0cnMsIGNoYW5nZXMsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICd1bnNldCc6IGZ1bmN0aW9uIChhdHRyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KGF0dHIsIHVuZGVmaW5lZCwgZXh0ZW5kKHt9LCBvcHRpb25zLCB7ICd1bnNldCc6IHRydWUgfSkpO1xuICB9LFxuXG4gICdjbGVhcic6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLnNldChzZWxmLmRlZmF1bHRzLCBvcHRpb25zKTtcbiAgfSxcblxuICAnY2hhbmdlcyc6IGZ1bmN0aW9uIChhdHRycywgb3B0aW9ucykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBrZXksIHZhbDtcbiAgICB2YXIgY2hhbmdlcyA9IFtdO1xuXG4gICAgdmFyIHByZXYgPSBjbG9uZShzZWxmLmF0dHJpYnV0ZXMsIHRydWUpO1xuICAgIHZhciBjdXJyZW50ID0gc2VsZi5hdHRyaWJ1dGVzO1xuICAgIHNlbGYuY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yIChrZXkgaW4gYXR0cnMpIHtcbiAgICAgIHZhbCA9IGF0dHJzW2tleV07XG4gICAgICBpZiAoIWlzRXF1YWwoY3VycmVudFtrZXldLCB2YWwpKSB7XG4gICAgICAgIGNoYW5nZXMucHVzaChrZXkpO1xuICAgICAgfVxuICAgICAgaWYgKCFpc0VxdWFsKHByZXZba2V5XSwgdmFsKSkge1xuICAgICAgICBzZWxmLmNoYW5nZWRba2V5XSA9IHZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmLmNoYW5nZWRba2V5XTtcbiAgICAgIH1cblxuICAgICAgY3VycmVudFtrZXldID0gb3B0aW9ucy51bnNldCA/IHVuZGVmaW5lZCA6IHZhbDtcbiAgICB9XG5cbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfSxcblxuICAnX3RyaWdnZXInOiBmdW5jdGlvbiAoYXR0cnMsIGNoYW5nZXMsIG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudCA9IHNlbGYuYXR0cmlidXRlcztcblxuICAgIC8vIGlmIGFueSBjaGFuZ2VzIGZvdW5kXG4gICAgLy8gJiBpZiB0aGlzIGlzIGFuIEV2ZW50RW1pdHRlcixcbiAgICAvLyB0cmlnZ2VyIHRoZSBjaGFuZ2UgZXZlbnRzXG4gICAgdmFyIGF0dHI7XG4gICAgd2hpbGUgKGNoYW5nZXMgJiYgY2hhbmdlcy5sZW5ndGggJiYgc2VsZi50cmlnZ2VyKSB7XG4gICAgICBhdHRyID0gY2hhbmdlcy5zaGlmdCgpO1xuICAgICAgc2VsZi50cmlnZ2VyKCdjaGFuZ2U6JyArIGF0dHIsIHNlbGYsIGN1cnJlbnRbYXR0cl0sIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JTdGF0ZU1peGluO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgV0JNaXhpbiA9IHJlcXVpcmUoJy4uL1dCTWl4aW4nKTtcbnZhciBXQkRlZmVycmVkID0gcmVxdWlyZSgnLi4vV0JEZWZlcnJlZCcpO1xudmFyIHdoZW4gPSByZXF1aXJlKCcuLi9saWIvd2hlbicpO1xudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuLi9saWIvdG9BcnJheScpO1xudmFyIGZvckVhY2ggPSByZXF1aXJlKCcuLi9saWIvZm9yRWFjaCcpO1xudmFyIGRlbGF5ID0gcmVxdWlyZSgnLi4vbGliL2RlbGF5Jyk7XG52YXIgZGVmZXIgPSByZXF1aXJlKCcuLi9saWIvZGVmZXInKTtcbnZhciBmdW5jdGlvbnMgPSByZXF1aXJlKCcuLi9saWIvZnVuY3Rpb25zJyk7XG5cbnZhciBXQlV0aWxzTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ2RlZmVycmVkJzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFdCRGVmZXJyZWQoc2VsZik7XG4gIH0sXG5cbiAgJ3doZW4nOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB3aGVuLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gIH0sXG5cbiAgJ2RlZmVyJzogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgIC8vIGRlZmF1bHQgY29udGV4dCB0byBzZWxmXG4gICAgYXJnc1sxXSA9IGFyZ3NbMV0gfHwgdGhpcztcbiAgICAvLyBzdXBwb3J0IHN0cmluZyBuYW1lcyBvZiBmdW5jdGlvbnMgb24gc2VsZlxuICAgICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoYXJnc1swXSA9IHNlbGZbZm5dKTtcbiAgICByZXR1cm4gZGVmZXIuYXBwbHkobnVsbCwgYXJncyk7XG4gIH0sXG5cbiAgJ2RlbGF5JzogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgIC8vIGRlZmF1bHQgY29udGV4dCB0byBzZWxmXG4gICAgYXJnc1syXSA9IGFyZ3NbMl0gfHwgc2VsZjtcbiAgICAvLyBzdXBwb3J0IHN0cmluZyBuYW1lcyBvZiBmdW5jdGlvbnMgb24gc2VsZlxuICAgICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoYXJnc1swXSA9IHNlbGZbZm5dKTtcbiAgICByZXR1cm4gZGVsYXkuYXBwbHkobnVsbCwgYXJncyk7XG4gIH0sXG5cbiAgJ2ZvckVhY2gnOiBmdW5jdGlvbiAoY29sbGVjdGlvbiwgZm4sIGNvbnRleHQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gZGVmYXVsdCBjb250ZXh0IHRvIHNlbGZcbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuICAgIC8vIHN1cHBvcnQgc3RyaW5nIG5hbWVzIG9mIGZ1bmN0aW9ucyBvbiBzZWxmXG4gICAgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycpICYmIChmbiA9IHNlbGZbZm5dKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZuLCBjb250ZXh0KTtcbiAgfSxcblxuICAnZnVuY3Rpb25zJzogZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBmdW5jdGlvbnMob2JqIHx8IHRoaXMpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQlV0aWxzTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnQ29udHJvbGxhYmxlTWl4aW4nOiByZXF1aXJlKCcuL0NvbnRyb2xsYWJsZU1peGluJyksXG4gICdPYnNlcnZhYmxlSGFzaE1peGluJzogcmVxdWlyZSgnLi9PYnNlcnZhYmxlSGFzaE1peGluJyksXG4gICdXQkJpbmRhYmxlTWl4aW4nOiByZXF1aXJlKCcuL1dCQmluZGFibGVNaXhpbicpLFxuICAnV0JEZXN0cm95YWJsZU1peGluJzogcmVxdWlyZSgnLi9XQkRlc3Ryb3lhYmxlTWl4aW4nKSxcbiAgJ1dCRXZlbnRzTWl4aW4nOiByZXF1aXJlKCcuL1dCRXZlbnRzTWl4aW4nKSxcbiAgJ1dCU3RhdGVNaXhpbic6IHJlcXVpcmUoJy4vV0JTdGF0ZU1peGluJyksXG4gICdXQlV0aWxzTWl4aW4nOiByZXF1aXJlKCcuL1dCVXRpbHNNaXhpbicpXG59OyJdfQ==
(10)
});
