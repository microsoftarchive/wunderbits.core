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

},{"./WBEventEmitter":5,"./mixins/ObservableHashMixin":30,"./mixins/WBDestroyableMixin":32,"./mixins/WBUtilsMixin":35}],2:[function(_dereq_,module,exports){
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

},{"./WBSingleton":8,"./mixins/ObservableHashMixin":30,"./mixins/WBBindableMixin":31,"./mixins/WBDestroyableMixin":32,"./mixins/WBEventsMixin":33,"./mixins/WBUtilsMixin":35}],3:[function(_dereq_,module,exports){
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

},{"./lib/clone":12,"./lib/createUID":13,"./lib/extend":17,"./lib/fromSuper":19,"./lib/inherits":22}],4:[function(_dereq_,module,exports){
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

},{"./WBClass":3,"./WBPromise":7,"./lib/assert":11,"./lib/toArray":26}],5:[function(_dereq_,module,exports){
'use strict';

var WBEventEmitter = _dereq_('./WBClass').extend({
  'mixins': [
    _dereq_('./mixins/WBBindableMixin'),
    _dereq_('./mixins/WBEventsMixin')
  ]
});

module.exports = WBEventEmitter;

},{"./WBClass":3,"./mixins/WBBindableMixin":31,"./mixins/WBEventsMixin":33}],6:[function(_dereq_,module,exports){
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

},{"./WBSingleton":8,"./lib/assert":11,"./lib/clone":12,"./lib/extend":17}],7:[function(_dereq_,module,exports){
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

},{"./lib/createUID":13,"./lib/extend":17}],9:[function(_dereq_,module,exports){
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

},{"./WBClass":3,"./mixins/WBBindableMixin":31,"./mixins/WBDestroyableMixin":32,"./mixins/WBEventsMixin":33,"./mixins/WBStateMixin":34}],10:[function(_dereq_,module,exports){
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

},{"./BaseEventEmitter":1,"./BaseSingleton":2,"./WBClass":3,"./WBDeferred":4,"./WBEventEmitter":5,"./WBMixin":6,"./WBSingleton":8,"./WBStateModel":9,"./lib":21,"./mixins":36}],11:[function(_dereq_,module,exports){
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

var toArray = _dereq_('./toArray');
var delay = _dereq_('./delay');

function defer (fn) {
  var args = toArray(arguments);
  args[0] = 1;
  args.unshift(fn);
  return delay.apply(null, args);
}

module.exports = defer;

},{"./delay":15,"./toArray":26}],15:[function(_dereq_,module,exports){
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

},{"./toArray":26}],16:[function(_dereq_,module,exports){
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

},{"./assert":11,"./clone":12,"./toArray":26}],17:[function(_dereq_,module,exports){
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

},{"./assert":11,"./merge":24,"./toArray":26}],18:[function(_dereq_,module,exports){
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

},{}],19:[function(_dereq_,module,exports){
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

},{"./extend":17,"./merge":24}],20:[function(_dereq_,module,exports){
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

},{}],21:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  'assert': _dereq_('./assert'),
  'clone': _dereq_('./clone'),
  'createUID': _dereq_('./createUID'),
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
},{"./assert":11,"./clone":12,"./createUID":13,"./defer":14,"./delay":15,"./events":16,"./extend":17,"./forEach":18,"./fromSuper":19,"./functions":20,"./inherits":22,"./isEqual":23,"./merge":24,"./size":25,"./toArray":26,"./when":27,"./where":28}],22:[function(_dereq_,module,exports){
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

},{"./extend":17}],23:[function(_dereq_,module,exports){
'use strict';

// TODO: implement deepEqual
function isEqual (a, b) {
  return a === b;
}

module.exports = isEqual;

},{}],24:[function(_dereq_,module,exports){
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

},{"./toArray":26}],25:[function(_dereq_,module,exports){
'use strict';

function size (collection) {
  !Array.isArray(collection) && (collection = Object.keys(collection));
  return collection.length;
}

module.exports = size;

},{}],26:[function(_dereq_,module,exports){
'use strict';

var slice = Array.prototype.slice;
function toArray (obj, skip) {
  return slice.call(obj, skip || 0);
}

module.exports = toArray;

},{}],27:[function(_dereq_,module,exports){
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

},{"../WBDeferred":4,"./toArray":26}],28:[function(_dereq_,module,exports){
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

},{"./forEach":18}],29:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var fromSuper = _dereq_('../lib/fromSuper');

var ControllerMixin = WBMixin.extend({

  'initialize': function () {

    var self = this;

    self.controllers = [];
    self.implemented = [];

    self.implements = fromSuper.concat(self, 'implements');
    self.createControllerInstances();

    self.bindTo(self, 'destroy', 'destroyControllers');
  },

  'createControllerInstances': function () {

    var self = this;
    var ControllerClass, controllerInstance, i;
    var Controllers = self.implements;

    for (i = Controllers.length; i--;) {
      ControllerClass = Controllers[i];

      // If we have already implemented a controller that inherits from
      // this controller, we don't need another one...
      if (self.implemented.indexOf(ControllerClass.toString()) < 0) {

        controllerInstance = new ControllerClass(self);
        self.controllers.push(controllerInstance);
        controllerInstance.parent = self;

        self.trackImplementedSuperConstructors(controllerInstance);
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

    for (var i = controllers.length; i--;) {

      // A controller can exist multiple times in the list,
      // since it's based on the event name,
      // so make sure to only destroy each one once
      controller = controllers[i];
      controller.destroyed || controller.destroy();
    }

    delete self.controllers;
  }
});

module.exports = ControllerMixin;

},{"../WBMixin":6,"../lib/fromSuper":19}],30:[function(_dereq_,module,exports){
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

},{"../WBMixin":6,"../lib/clone":12,"../lib/fromSuper":19}],31:[function(_dereq_,module,exports){
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

},{"../WBMixin":6,"../lib/createUID":13}],32:[function(_dereq_,module,exports){
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

    // clean up
    forEach(cleanupMethods, Call, self);

    self.trigger('destroy');

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

},{"../WBMixin":6,"../lib/forEach":18}],33:[function(_dereq_,module,exports){
'use strict';

var WBMixin = _dereq_('../WBMixin');
var events = _dereq_('../lib/events');

var WBEventsMixin = WBMixin.extend(events);

module.exports = WBEventsMixin;

},{"../WBMixin":6,"../lib/events":16}],34:[function(_dereq_,module,exports){
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

},{"../WBMixin":6,"../lib/clone":12,"../lib/extend":17,"../lib/isEqual":23,"../lib/merge":24}],35:[function(_dereq_,module,exports){
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

},{"../WBDeferred":4,"../WBMixin":6,"../lib/defer":14,"../lib/delay":15,"../lib/forEach":18,"../lib/functions":20,"../lib/toArray":26,"../lib/when":27}],36:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  'ControllerMixin': _dereq_('./ControllerMixin'),
  'ObservableHashMixin': _dereq_('./ObservableHashMixin'),
  'WBBindableMixin': _dereq_('./WBBindableMixin'),
  'WBDestroyableMixin': _dereq_('./WBDestroyableMixin'),
  'WBEventsMixin': _dereq_('./WBEventsMixin'),
  'WBStateMixin': _dereq_('./WBStateMixin'),
  'WBUtilsMixin': _dereq_('./WBUtilsMixin')
};
},{"./ControllerMixin":29,"./ObservableHashMixin":30,"./WBBindableMixin":31,"./WBDestroyableMixin":32,"./WBEventsMixin":33,"./WBStateMixin":34,"./WBUtilsMixin":35}]},{},[10])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwicHVibGljL0Jhc2VFdmVudEVtaXR0ZXIuanMiLCJwdWJsaWMvQmFzZVNpbmdsZXRvbi5qcyIsInB1YmxpYy9XQkNsYXNzLmpzIiwicHVibGljL1dCRGVmZXJyZWQuanMiLCJwdWJsaWMvV0JFdmVudEVtaXR0ZXIuanMiLCJwdWJsaWMvV0JNaXhpbi5qcyIsInB1YmxpYy9XQlByb21pc2UuanMiLCJwdWJsaWMvV0JTaW5nbGV0b24uanMiLCJwdWJsaWMvV0JTdGF0ZU1vZGVsLmpzIiwicHVibGljL2luZGV4LmpzIiwicHVibGljL2xpYi9hc3NlcnQuanMiLCJwdWJsaWMvbGliL2Nsb25lLmpzIiwicHVibGljL2xpYi9jcmVhdGVVSUQuanMiLCJwdWJsaWMvbGliL2RlZmVyLmpzIiwicHVibGljL2xpYi9kZWxheS5qcyIsInB1YmxpYy9saWIvZXZlbnRzLmpzIiwicHVibGljL2xpYi9leHRlbmQuanMiLCJwdWJsaWMvbGliL2ZvckVhY2guanMiLCJwdWJsaWMvbGliL2Zyb21TdXBlci5qcyIsInB1YmxpYy9saWIvZnVuY3Rpb25zLmpzIiwicHVibGljL2xpYi9pbmRleC5qcyIsInB1YmxpYy9saWIvaW5oZXJpdHMuanMiLCJwdWJsaWMvbGliL2lzRXF1YWwuanMiLCJwdWJsaWMvbGliL21lcmdlLmpzIiwicHVibGljL2xpYi9zaXplLmpzIiwicHVibGljL2xpYi90b0FycmF5LmpzIiwicHVibGljL2xpYi93aGVuLmpzIiwicHVibGljL2xpYi93aGVyZS5qcyIsInB1YmxpYy9taXhpbnMvQ29udHJvbGxlck1peGluLmpzIiwicHVibGljL21peGlucy9PYnNlcnZhYmxlSGFzaE1peGluLmpzIiwicHVibGljL21peGlucy9XQkJpbmRhYmxlTWl4aW4uanMiLCJwdWJsaWMvbWl4aW5zL1dCRGVzdHJveWFibGVNaXhpbi5qcyIsInB1YmxpYy9taXhpbnMvV0JFdmVudHNNaXhpbi5qcyIsInB1YmxpYy9taXhpbnMvV0JTdGF0ZU1peGluLmpzIiwicHVibGljL21peGlucy9XQlV0aWxzTWl4aW4uanMiLCJwdWJsaWMvbWl4aW5zL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQmFzZUVtaXR0ZXIgPSByZXF1aXJlKCcuL1dCRXZlbnRFbWl0dGVyJykuZXh0ZW5kKHtcbiAgJ21peGlucyc6IFtcbiAgICByZXF1aXJlKCcuL21peGlucy9XQkRlc3Ryb3lhYmxlTWl4aW4nKSxcbiAgICByZXF1aXJlKCcuL21peGlucy9XQlV0aWxzTWl4aW4nKSxcbiAgICByZXF1aXJlKCcuL21peGlucy9PYnNlcnZhYmxlSGFzaE1peGluJylcbiAgXVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUVtaXR0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBCYXNlU2luZ2xldG9uID0gcmVxdWlyZSgnLi9XQlNpbmdsZXRvbicpLmV4dGVuZCh7XG4gICdtaXhpbnMnOiBbXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JFdmVudHNNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCQmluZGFibGVNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCRGVzdHJveWFibGVNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCVXRpbHNNaXhpbicpLFxuICAgIHJlcXVpcmUoJy4vbWl4aW5zL09ic2VydmFibGVIYXNoTWl4aW4nKVxuICBdXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlU2luZ2xldG9uO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCcuL2xpYi9pbmhlcml0cycpO1xudmFyIGV4dGVuZCA9IHJlcXVpcmUoJy4vbGliL2V4dGVuZCcpO1xudmFyIGNsb25lID0gcmVxdWlyZSgnLi9saWIvY2xvbmUnKTtcbnZhciBjcmVhdGVVSUQgPSByZXF1aXJlKCcuL2xpYi9jcmVhdGVVSUQnKTtcbnZhciBmcm9tU3VwZXIgPSByZXF1aXJlKCcuL2xpYi9mcm9tU3VwZXInKTtcblxuLy8gU2VsZi1wcm9wYWdhdGluZyBleHRlbmQgZnVuY3Rpb24uXG4vLyBDcmVhdGUgYSBuZXcgY2xhc3MsXG4vLyB0aGF0IGluaGVyaXRzIGZyb20gdGhlIGNsYXNzIGZvdW5kIGluIHRoZSBgdGhpc2AgY29udGV4dCBvYmplY3QuXG4vLyBUaGlzIGZ1bmN0aW9uIGlzIG1lYW50IHRvIGJlIGNhbGxlZCxcbi8vIGluIHRoZSBjb250ZXh0IG9mIGEgY29uc3RydWN0b3IgZnVuY3Rpb24uXG5mdW5jdGlvbiBleHRlbmRTZWxmIChwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykge1xuICAvKiBqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cblxuICB2YXIgcGFyZW50ID0gdGhpcztcblxuICBwcm90b1Byb3BzID0gcHJvdG9Qcm9wcyB8fCB7fTtcblxuICAvLyBleHRyYWN0IG1peGlucywgaWYgYW55XG4gIHZhciBtaXhpbnMgPSBwcm90b1Byb3BzLm1peGlucyB8fCBbXTtcbiAgZGVsZXRlIHByb3RvUHJvcHMubWl4aW5zO1xuXG4gIC8vIGNyZWF0ZSB0aGUgZGVyaXZlZCBjbGFzc1xuICB2YXIgY2hpbGQgPSBpbmhlcml0cyhwYXJlbnQsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKTtcblxuICAvLyBhcHBseSBtaXhpbnMgdG8gdGhlIGRlcml2ZWQgY2xhc3NcbiAgdmFyIG1peGluO1xuICB3aGlsZSAobWl4aW5zLmxlbmd0aCkge1xuICAgIG1peGluID0gbWl4aW5zLnNoaWZ0KCk7XG4gICAgKHR5cGVvZiBtaXhpbi5hcHBseVRvQ2xhc3MgPT09ICdmdW5jdGlvbicpICYmXG4gICAgICBtaXhpbi5hcHBseVRvQ2xhc3MoY2hpbGQpO1xuICB9XG5cbiAgLy8gbWFrZSB0aGUgY2hpbGQgY2xhc3MgZXh0ZW5zaWJsZVxuICBjaGlsZC5leHRlbmQgPSBwYXJlbnQuZXh0ZW5kIHx8IGV4dGVuZFNlbGY7XG4gIHJldHVybiBjaGlsZDtcbn1cblxuZnVuY3Rpb24gV0JDbGFzcyAob3B0aW9ucykge1xuXG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBBc3NpZ24gYSB1bmlxdWUgaWRlbnRpZmllciB0byB0aGUgaW5zdGFuY2VcbiAgc2VsZi51aWQgPSBzZWxmLnVpZCB8fCBjcmVhdGVVSUQoKTtcblxuICAvLyBzYXZlIG9wdGlvbnMsIG1ha2Ugc3VyZSBpdCdzIGF0IGxlYXN0IGFuIGVtcHR5IG9iamVjdFxuICBzZWxmLm9wdGlvbnMgPSBvcHRpb25zIHx8IHNlbGYub3B0aW9ucztcblxuICAvLyBhdWdtZW50IHByb3BlcnRpZXMgZnJvbSBtaXhpbnNcbiAgc2VsZi5hdWdtZW50UHJvcGVydGllcygpO1xuXG4gIC8vIGluaXRpYWxpemUgdGhlIGluc3RhbmNlXG4gIHNlbGYuaW5pdGlhbGl6ZS5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuXG4gIC8vIGluaXRpYWxpemUgYWxsIHRoZSBtaXhpbnMsIGlmIG5lZWRlZFxuICAvLyBkb24ndCBrZWVwIHRoaXMgaW4gdGhlIGluaXRpYWxpemUsXG4gIC8vIGluaXRpYWxpemUgY2FuIGJlIG92ZXJ3cml0dGVuXG4gIHNlbGYuaW5pdE1peGlucy5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xufVxuXG52YXIgcHJvdG8gPSB7XG5cbiAgJ2luaXRpYWxpemUnOiBmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBSZXR1cm4gc2VsZiB0byBhbGxvdyBmb3Igc3ViY2xhc3MgdG8gYXNzaWduXG4gICAgLy8gc3VwZXIgaW5pdGlhbGl6ZXIgdmFsdWUgdG8gc2VsZlxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAvLyBJZiBhbnkgbWl4aW5zIHdlcmUgYXBwbGllZCB0byB0aGUgcHJvdG90eXBlLCBpbml0aWFsaXplIHRoZW1cbiAgJ2luaXRNaXhpbnMnOiBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGluaXRpYWxpemVycyA9IGZyb21TdXBlci5jb25jYXQoc2VsZiwgJ2luaXRpYWxpemVycycpO1xuXG4gICAgdmFyIGluaXRpYWxpemVyO1xuICAgIHdoaWxlIChpbml0aWFsaXplcnMubGVuZ3RoKSB7XG4gICAgICBpbml0aWFsaXplciA9IGluaXRpYWxpemVycy5zaGlmdCgpO1xuICAgICAgKHR5cGVvZiBpbml0aWFsaXplciA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICAgICAgaW5pdGlhbGl6ZXIuYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gSWYgYW55IHByb2VydGllcyB3ZXJlIGRlZmluZWQgaW4gdGhlIG1peGlucywgYXVnbWVudCB0aGVtIHRvIHRoZSBpbnN0YW5jZVxuICAnYXVnbWVudFByb3BlcnRpZXMnOiBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHByb3BlcnRpZXMgPSBmcm9tU3VwZXIubWVyZ2Uoc2VsZiwgJ3Byb3BlcnRpZXMnKTtcblxuICAgIGZ1bmN0aW9uIGF1Z21lbnRQcm9wZXJ0eSAocHJvcGVydHksIHZhbHVlKSB7XG5cbiAgICAgIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuXG4gICAgICBpZiAodHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBzZWxmW3Byb3BlcnR5XSA9IHZhbHVlLmNhbGwoc2VsZik7XG4gICAgICB9XG4gICAgICBlbHNlIGlmICh0eXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBzZWxmW3Byb3BlcnR5XSA9IGNsb25lKHZhbHVlLCB0cnVlKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBzZWxmW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGtleSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICBhdWdtZW50UHJvcGVydHkoa2V5LCBwcm9wZXJ0aWVzW2tleV0pO1xuICAgIH1cbiAgfVxufTtcblxuZXh0ZW5kKFdCQ2xhc3MucHJvdG90eXBlLCBwcm90byk7XG5XQkNsYXNzLmV4dGVuZCA9IGV4dGVuZFNlbGY7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JDbGFzcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFdCQ2xhc3MgPSByZXF1aXJlKCcuL1dCQ2xhc3MnKTtcbnZhciBXQlByb21pc2UgPSByZXF1aXJlKCcuL1dCUHJvbWlzZScpO1xudmFyIGFzc2VydCA9IHJlcXVpcmUoJy4vbGliL2Fzc2VydCcpO1xudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuL2xpYi90b0FycmF5Jyk7XG5cbnZhciBzdGF0ZXMgPSB7XG4gICdwZW5kaW5nJzogMCxcbiAgJ3Jlc29sdmVkJzogMixcbiAgJ3JlamVjdGVkJzogNFxufTtcblxudmFyIHN0YXRlTmFtZXMgPSB7XG4gIDA6IFsncGVuZGluZyddLFxuICAyOiBbJ3Jlc29sdmVkJywgJ3Jlc29sdmUnXSxcbiAgNDogWydyZWplY3RlZCcsICdyZWplY3QnXVxufTtcblxudmFyIHByb3RvID0ge1xuXG4gICdjb25zdHJ1Y3Rvcic6IGZ1bmN0aW9uIChjb250ZXh0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuX2NvbnRleHQgPSBjb250ZXh0O1xuICAgIHNlbGYuX3N0YXRlID0gc3RhdGVzLnBlbmRpbmc7XG4gICAgc2VsZi5fYXJncyA9IFtdO1xuICAgIHNlbGYuaGFuZGxlcnMgPSBbXTtcbiAgfSxcblxuICAnc3RhdGUnOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzdGF0ZU5hbWVzW3NlbGYuX3N0YXRlXVswXTtcbiAgfSxcblxuICAndHJpZ2dlcic6IGZ1bmN0aW9uICh3aXRoQ29udGV4dCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdGF0ZSA9PT0gc3RhdGVzLnBlbmRpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlcnMgPSBzZWxmLmhhbmRsZXJzLCBoYW5kbGU7XG4gICAgd2hpbGUgKGhhbmRsZXJzLmxlbmd0aCkge1xuICAgICAgaGFuZGxlID0gaGFuZGxlcnMuc2hpZnQoKTtcbiAgICAgIHNlbGYuaW52b2tlKGhhbmRsZSwgd2l0aENvbnRleHQgfHwgc2VsZi5fY29udGV4dCk7XG4gICAgfVxuICB9LFxuXG4gICdpbnZva2UnOiBmdW5jdGlvbiAoZGVmZXJyZWRSZXNwb25zZSwgd2l0aENvbnRleHQpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgc3RhdGUgPSBzZWxmLl9zdGF0ZTtcbiAgICB2YXIgY29udGV4dCA9IGRlZmVycmVkUmVzcG9uc2UuY29udGV4dCB8fCB3aXRoQ29udGV4dCB8fCBzZWxmO1xuICAgIHZhciBhcmdzID0gZGVmZXJyZWRSZXNwb25zZS5hcmdzO1xuXG4gICAgc2VsZi5fYXJncy5mb3JFYWNoKGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgIC8vIHNlbmQgc2luZ2xlIGFyZ3VtZW50cyBhcyB0aGUgaXRlbSwgb3RoZXJ3aXNlIHNlbmQgaXQgYXMgYW4gYXJyYXlcbiAgICAgIGFyZ3MucHVzaChhcmcpO1xuICAgIH0pO1xuXG4gICAgdmFyIHR5cGUgPSBkZWZlcnJlZFJlc3BvbnNlLnR5cGU7XG4gICAgdmFyIGlzQ29tcGxldGVkID0gKHR5cGUgPT09ICd0aGVuJykgfHxcbiAgICAgICh0eXBlID09PSAnZG9uZScgJiYgc3RhdGUgPT09IHN0YXRlcy5yZXNvbHZlZCkgfHxcbiAgICAgICh0eXBlID09PSAnZmFpbCcgJiYgc3RhdGUgPT09IHN0YXRlcy5yZWplY3RlZCk7XG5cbiAgICBpc0NvbXBsZXRlZCAmJiBkZWZlcnJlZFJlc3BvbnNlLmZuLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICB9LFxuXG4gICdwcm9taXNlJzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9wcm9taXNlID0gc2VsZi5fcHJvbWlzZSB8fCBuZXcgV0JQcm9taXNlKHRoaXMpO1xuICAgIHJldHVybiBzZWxmLl9wcm9taXNlO1xuICB9XG59O1xuXG5bJ3RoZW4nLCAnZG9uZScsICdmYWlsJ10uZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG4gIHByb3RvW21ldGhvZF0gPSBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBzdG9yZSByZWZlcmVuY2VzIHRvIHRoZSBjb250ZXh0LCBjYWxsYmFja3MsIGFuZCBhcmJpdHJhcnkgYXJndW1lbnRzXG4gICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gICAgdmFyIGZuID0gYXJncy5zaGlmdCgpO1xuICAgIHZhciBjb250ZXh0ID0gYXJncy5zaGlmdCgpO1xuXG4gICAgYXNzZXJ0LmZ1bmN0aW9uKGZuLCBtZXRob2QgKyAnIGFjY2VwdHMgb25seSBmdW5jdGlvbnMnKTtcblxuICAgIHNlbGYuaGFuZGxlcnMucHVzaCh7XG4gICAgICAndHlwZSc6IG1ldGhvZCxcbiAgICAgICdjb250ZXh0JzogY29udGV4dCxcbiAgICAgICdmbic6IGZuLFxuICAgICAgJ2FyZ3MnOiBhcmdzXG4gICAgfSk7XG5cbiAgICAvLyBpZiB0aGUgZGVmZXJlZCBpcyBub3QgcGVuZGluZyBhbnltb3JlLCBjYWxsIHRoZSBjYWxsYmFja3NcbiAgICBzZWxmLnRyaWdnZXIoKTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9O1xufSk7XG5cbi8vIEFsaWFzIGBhbHdheXNgIHRvIGB0aGVuYCBvbiBEZWZlcnJlZCdzIHByb3RvdHlwZVxucHJvdG8uYWx3YXlzID0gcHJvdG8udGhlbjtcblxuZnVuY3Rpb24gcmVzb2x2ZXIgKHN0YXRlLCBpc1dpdGgsIGZuTmFtZSkge1xuICByZXR1cm4gZnVuY3Rpb24gY29tcGxldGUgKCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCEoc2VsZiBpbnN0YW5jZW9mIFdCRGVmZXJyZWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZm5OYW1lICsgJyBpbnZva2VkIHdpdGggd3JvbmcgY29udGV4dCcpO1xuICAgIH1cblxuICAgIC8vIGNhbid0IGNoYW5nZSBzdGF0ZSBvbmNlIHJlc29sdmVkIG9yIHJlamVjdGVkXG4gICAgaWYgKHNlbGYuX3N0YXRlICE9PSBzdGF0ZXMucGVuZGluZykge1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfVxuXG4gICAgc2VsZi5fYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICB2YXIgY29udGV4dCA9IGlzV2l0aCA/IHNlbGYuX2FyZ3Muc2hpZnQoKSA6IHVuZGVmaW5lZDtcblxuICAgIHNlbGYuX3N0YXRlID0gc3RhdGU7XG4gICAgc2VsZi50cmlnZ2VyKGNvbnRleHQpO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH07XG59XG5cbltzdGF0ZXMucmVzb2x2ZWQsIHN0YXRlcy5yZWplY3RlZF0uZm9yRWFjaChmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIGZuTmFtZSA9IHN0YXRlTmFtZXNbc3RhdGVdWzFdO1xuICBwcm90b1tmbk5hbWVdID0gcmVzb2x2ZXIoc3RhdGUsIGZhbHNlLCBmbk5hbWUpO1xuICBwcm90b1tmbk5hbWUgKyAnV2l0aCddID0gcmVzb2x2ZXIoc3RhdGUsIHRydWUsIGZuTmFtZSk7XG59KTtcblxudmFyIFdCRGVmZXJyZWQgPSBXQkNsYXNzLmV4dGVuZChwcm90byk7XG5tb2R1bGUuZXhwb3J0cyA9IFdCRGVmZXJyZWQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQkV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJy4vV0JDbGFzcycpLmV4dGVuZCh7XG4gICdtaXhpbnMnOiBbXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JCaW5kYWJsZU1peGluJyksXG4gICAgcmVxdWlyZSgnLi9taXhpbnMvV0JFdmVudHNNaXhpbicpXG4gIF1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdCRXZlbnRFbWl0dGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi9saWIvZXh0ZW5kJyk7XG52YXIgY2xvbmUgPSByZXF1aXJlKCcuL2xpYi9jbG9uZScpO1xudmFyIGFzc2VydCA9IHJlcXVpcmUoJy4vbGliL2Fzc2VydCcpO1xudmFyIFdCU2luZ2xldG9uID0gcmVxdWlyZSgnLi9XQlNpbmdsZXRvbicpO1xuXG52YXIgV0JNaXhpbiA9IFdCU2luZ2xldG9uLmV4dGVuZCh7XG5cbiAgLy8gQXBwbHkgdGhlIG1peGluIHRvIGFuIGluc3RhbmNlIG9mIGEgY2xhc3NcbiAgJ2FwcGx5VG8nOiBmdW5jdGlvbiAoaW5zdGFuY2UpIHtcblxuICAgIHZhciBiZWhhdmlvciA9IGNsb25lKHRoaXMuQmVoYXZpb3IsIHRydWUpO1xuXG4gICAgLy8gYXBwbHkgbWl4aW4ncyBpbml0aWFsaXplICYgcmVtb3ZlIGl0IGZyb20gdGhlIGluc3RhbmNlXG4gICAgdmFyIGluaXRpYWxpemVyO1xuICAgIGlmICh0eXBlb2YgYmVoYXZpb3IuaW5pdGlhbGl6ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaW5pdGlhbGl6ZXIgPSBiZWhhdmlvci5pbml0aWFsaXplO1xuICAgICAgZGVsZXRlIGJlaGF2aW9yLmluaXRpYWxpemU7XG4gICAgfVxuXG4gICAgLy8gYXVnbWVudCBtaXhpbidzIHByb3BlcnRpZXMgb2JqZWN0IGludG8gdGhlIGluc3RhbmNlXG4gICAgdmFyIHByb3BlcnRpZXMgPSBiZWhhdmlvci5wcm9wZXJ0aWVzO1xuICAgIGRlbGV0ZSBiZWhhdmlvci5wcm9wZXJ0aWVzO1xuXG4gICAgLy8gbWl4aW4gdGhlIGJlaGF2aW9yXG4gICAgZXh0ZW5kKGluc3RhbmNlLCBiZWhhdmlvcik7XG5cbiAgICAvLyBhcHBseSB0aGUgaW5pdGlhbGl6ZXIsIGlmIGFueVxuICAgIGluaXRpYWxpemVyICYmIGluaXRpYWxpemVyLmFwcGx5KGluc3RhbmNlKTtcblxuICAgIC8vIGF1Z21lbnQgcHJvZXJ0aWVzIHRvIHRoZSBpbnN0YW5jZVxuICAgIHByb3BlcnRpZXMgJiYgZXh0ZW5kKGluc3RhbmNlLCBwcm9wZXJ0aWVzKTtcblxuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfSxcblxuICAvLyBBcHBseSB0aGUgbWl4aW4gdG8gdGhlIGNsYXNzIGRpcmVjdGx5XG4gICdhcHBseVRvQ2xhc3MnOiBmdW5jdGlvbiAoa2xhc3MpIHtcblxuICAgIC8vIHZhbGlkYXRlIGNsYXNzXG4gICAgYXNzZXJ0LmNsYXNzKGtsYXNzLCAnYXBwbHlUb0NsYXNzIGV4cGVjdHMgYSBjbGFzcycpO1xuXG4gICAgdmFyIHByb3RvID0ga2xhc3MucHJvdG90eXBlO1xuICAgIHZhciBiZWhhdmlvciA9IGNsb25lKHRoaXMuQmVoYXZpb3IsIHRydWUpO1xuXG4gICAgLy8gY2FjaGUgdGhlIG1peGluJ3MgaW5pdGlhbGl6ZXIsIHRvIGJlIGFwcGxpZWQgbGF0ZXJcbiAgICB2YXIgaW5pdGlhbGl6ZSA9IGJlaGF2aW9yLmluaXRpYWxpemU7XG4gICAgaWYgKHR5cGVvZiBpbml0aWFsaXplID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAoIXByb3RvLmhhc093blByb3BlcnR5KCdpbml0aWFsaXplcnMnKSkgJiYgKHByb3RvLmluaXRpYWxpemVycyA9IFtdKTtcbiAgICAgIHByb3RvLmluaXRpYWxpemVycy5wdXNoKGluaXRpYWxpemUpO1xuICAgICAgZGVsZXRlIGJlaGF2aW9yLmluaXRpYWxpemU7XG4gICAgfVxuXG4gICAgdmFyIHByb3BlcnRpZXMgPSBiZWhhdmlvci5wcm9wZXJ0aWVzO1xuICAgIGRlbGV0ZSBiZWhhdmlvci5wcm9wZXJ0aWVzO1xuXG4gICAgLy8gZXh0ZW5kIHRoZSBwcm90b3R5cGVcbiAgICBleHRlbmQocHJvdG8sIGJlaGF2aW9yKTtcblxuICAgIC8vIGNhY2hlIHRoZSBwcm9wZXJ0aWVzLCB0byBiZSBhcHBsaWVkIGxhdGVyXG4gICAgKCFwcm90by5oYXNPd25Qcm9wZXJ0eSgncHJvcGVydGllcycpKSAmJiAocHJvdG8ucHJvcGVydGllcyA9IHt9KTtcbiAgICBwcm9wZXJ0aWVzICYmIGV4dGVuZChwcm90by5wcm9wZXJ0aWVzLCBwcm9wZXJ0aWVzKTtcblxuICAgIHJldHVybiBrbGFzcztcbiAgfVxufSk7XG5cbi8vIFRoZSBvbmx5IHJlYWwgY2hhbmdlIGZyb20gYSBzaW1wbGUgc2luZ2xldG9uIGlzXG4vLyB0aGUgYWx0ZXJlZCBleHRlbmQgY2xhc3MgbWV0aG9kLCB3aGljaCB3aWxsIHNhdmVcbi8vIFwibWl4aW5Qcm9wc1wiIGludG8gYSBzcGVjaWZpYyBtZW1iZXIsIGZvciBlYXN5XG4vLyBhbmQgY2xlYW4gYXBwbGljYXRpb24gdXNpbmcgI2FwcGx5VG9cbldCTWl4aW4uZXh0ZW5kID0gZnVuY3Rpb24gKG1peGluUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG5cbiAgbWl4aW5Qcm9wcyB8fCAobWl4aW5Qcm9wcyA9IHt9KTtcbiAgc3RhdGljUHJvcHMgfHwgKHN0YXRpY1Byb3BzID0ge30pO1xuXG4gIHZhciBjdXJyZW50ID0gY2xvbmUodGhpcy5CZWhhdmlvciwgdHJ1ZSk7XG4gIHN0YXRpY1Byb3BzLkJlaGF2aW9yID0gZXh0ZW5kKGN1cnJlbnQsIG1peGluUHJvcHMpO1xuICB2YXIgbWl4aW4gPSBXQlNpbmdsZXRvbi5leHRlbmQuY2FsbCh0aGlzLCBzdGF0aWNQcm9wcyk7XG5cbiAgbWl4aW4uZXh0ZW5kID0gV0JNaXhpbi5leHRlbmQ7XG5cbiAgcmV0dXJuIG1peGluO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQk1peGluO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgV0JDbGFzcyA9IHJlcXVpcmUoJy4vV0JDbGFzcycpO1xuXG5mdW5jdGlvbiBwcm94eSAobmFtZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBkZWZlcnJlZCA9IHRoaXMuZGVmZXJyZWQ7XG4gICAgZGVmZXJyZWRbbmFtZV0uYXBwbHkoZGVmZXJyZWQsIGFyZ3VtZW50cyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG59XG5cbnZhciBwcm90byA9IHtcbiAgJ2NvbnN0cnVjdG9yJzogZnVuY3Rpb24gKGRlZmVycmVkKSB7XG4gICAgdGhpcy5kZWZlcnJlZCA9IGRlZmVycmVkO1xuICB9LFxuXG4gICdwcm9taXNlJzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gICdzdGF0ZSc6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5kZWZlcnJlZC5zdGF0ZSgpO1xuICB9XG59O1xuXG5bXG4gICdkb25lJyxcbiAgJ2ZhaWwnLFxuICAndGhlbidcbl0uZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICBwcm90b1tuYW1lXSA9IHByb3h5KG5hbWUpO1xufSk7XG5cbnByb3RvLmFsd2F5cyA9IHByb3RvLnRoZW47XG5cbm1vZHVsZS5leHBvcnRzID0gV0JDbGFzcy5leHRlbmQocHJvdG8pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi9saWIvZXh0ZW5kJyk7XG52YXIgY3JlYXRlVUlEID0gcmVxdWlyZSgnLi9saWIvY3JlYXRlVUlEJyk7XG5cbmZ1bmN0aW9uIGFwcGx5TWl4aW5zIChtaXhpbnMsIGluc3RhbmNlKSB7XG4gIHZhciBtaXhpbjtcbiAgd2hpbGUgKG1peGlucy5sZW5ndGgpIHtcbiAgICBtaXhpbiA9IG1peGlucy5zaGlmdCgpO1xuICAgICh0eXBlb2YgbWl4aW4uYXBwbHlUbyA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICAgIG1peGluLmFwcGx5VG8oaW5zdGFuY2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV4dGVuZFNlbGYgKHN0YXRpY1Byb3BzKSB7XG4gIC8qIGpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuXG4gIHN0YXRpY1Byb3BzID0gc3RhdGljUHJvcHMgfHwge307XG5cbiAgLy8gZXh0ZW5kIGZyb20gdGhlIGJhc2Ugc2luZ2xldG9uXG4gIHZhciBCYXNlU2luZ2xldG9uID0gdGhpcyB8fCBXQlNpbmdsZXRvbjtcblxuICAvLyBjcmVhdGUgYSBuZXcgaW5zdGFuY2VcbiAgQ3Rvci5wcm90b3R5cGUgPSBCYXNlU2luZ2xldG9uO1xuICB2YXIgc2luZ2xldG9uID0gbmV3IEN0b3IoKTtcblxuICAvLyBleHRyYWN0IG1peGluc1xuICB2YXIgbWl4aW5zID0gc3RhdGljUHJvcHMubWl4aW5zIHx8IFtdO1xuICBzdGF0aWNQcm9wcy5taXhpbnMgPSB1bmRlZmluZWQ7XG5cbiAgLy8gYXBwbHkgbWl4aW5zIHRvIHRoZSBpbnN0YW5jZVxuICBhcHBseU1peGlucyhtaXhpbnMsIHNpbmdsZXRvbik7XG5cbiAgLy8gYXBwZW5kIHRoZSBzdGF0aWMgcHJvcGVydGllcyB0byB0aGUgc2luZ2xldG9uXG4gIGV4dGVuZChzaW5nbGV0b24sIHN0YXRpY1Byb3BzKTtcblxuICAvLyBtYWtlIHRoZSBzaW5nbGV0b24gZXh0ZW5kYWJsZVxuICAvLyBEbyB0aGlzIGFmdGVyIGFwcGx5aW5nIG1peGlucyxcbiAgLy8gdG8gZW5zdXJlIHRoYXQgbm8gbWl4aW4gY2FuIG92ZXJyaWRlIGBleHRlbmRgIG1ldGhvZFxuICBzaW5nbGV0b24uZXh0ZW5kID0gZXh0ZW5kU2VsZjtcblxuICAvLyBldmVyeSBzaWdubGV0b24gZ2V0cyBhIFVJRFxuICBzaW5nbGV0b24udWlkID0gY3JlYXRlVUlEKCk7XG5cbiAgcmV0dXJuIHNpbmdsZXRvbjtcbn1cblxudmFyIEN0b3IgPSBmdW5jdGlvbiAoKSB7fTtcbkN0b3IucHJvdG90eXBlID0ge1xuICAnZXh0ZW5kJzogZXh0ZW5kU2VsZlxufTtcblxudmFyIFdCU2luZ2xldG9uID0gbmV3IEN0b3IoKTtcbm1vZHVsZS5leHBvcnRzID0gV0JTaW5nbGV0b247XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQkNsYXNzID0gcmVxdWlyZSgnLi9XQkNsYXNzJyk7XG5cbnZhciBXQkRlc3Ryb3lhYmxlTWl4aW4gPSByZXF1aXJlKCcuL21peGlucy9XQkRlc3Ryb3lhYmxlTWl4aW4nKTtcbnZhciBvcmlnaW5hbERlc3Ryb3kgPSBXQkRlc3Ryb3lhYmxlTWl4aW4uQmVoYXZpb3IuZGVzdHJveTtcblxudmFyIFdCU3RhdGVNb2RlbCA9IFdCQ2xhc3MuZXh0ZW5kKHtcblxuICAnbWl4aW5zJzogW1xuICAgIHJlcXVpcmUoJy4vbWl4aW5zL1dCRXZlbnRzTWl4aW4nKSxcbiAgICByZXF1aXJlKCcuL21peGlucy9XQlN0YXRlTWl4aW4nKSxcbiAgICByZXF1aXJlKCcuL21peGlucy9XQkJpbmRhYmxlTWl4aW4nKSxcbiAgICBXQkRlc3Ryb3lhYmxlTWl4aW5cbiAgXSxcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoYXR0cmlidXRlcykge1xuICAgICAgc2VsZi5hdHRyaWJ1dGVzID0gYXR0cmlidXRlcztcbiAgICB9XG4gIH0sXG5cbiAgJ3N5bmMnOiAgZnVuY3Rpb24gKG1ldGhvZCwgaW5zdGFuY2UsIG9wdGlvbnMpIHtcbiAgICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5zdWNjZXNzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBvcHRpb25zLnN1Y2Nlc3MoKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2ZldGNoJzogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHN1Y2Nlc3MgPSBvcHRpb25zLnN1Y2Nlc3M7XG4gICAgdmFyIG1vZGVsID0gdGhpcztcbiAgICBvcHRpb25zLnN1Y2Nlc3MgPSBmdW5jdGlvbiAocmVzcCkge1xuICAgICAgaWYgKCFtb2RlbC5zZXQocmVzcCwgb3B0aW9ucykpIHJldHVybiBmYWxzZTtcbiAgICAgIGlmIChzdWNjZXNzKSBzdWNjZXNzKG1vZGVsLCByZXNwLCBvcHRpb25zKTtcbiAgICAgIG1vZGVsLnRyaWdnZXIoJ3N5bmMnLCBtb2RlbCwgcmVzcCwgb3B0aW9ucyk7XG4gICAgfTtcbiAgICByZXR1cm4gc2VsZi5zeW5jKCdyZWFkJywgc2VsZiwgb3B0aW9ucyk7XG4gIH0sXG5cbiAgJ3NhdmUnOiBmdW5jdGlvbiAoa2V5LCB2YWwsIG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuZGVzdHJveWluZykge1xuICAgICAgLy8gc2V0IHRoZSBhdHRyaWJ1dGVzXG4gICAgICBzZWxmLnNldChrZXksIHZhbCwgb3B0aW9ucyk7XG4gICAgICAvLyBzeW5jXG4gICAgICAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpICYmIChvcHRpb25zID0gdmFsKTtcbiAgICAgIHNlbGYuc3luYygndXBkYXRlJywgc2VsZiwgb3B0aW9ucyk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICdkZXN0cm95JzogZnVuY3Rpb24gKG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuZGVzdHJveWluZykge1xuICAgICAgc2VsZi5kZXN0cm95aW5nID0gdHJ1ZTtcbiAgICAgIG9yaWdpbmFsRGVzdHJveS5jYWxsKHNlbGYsIG9wdGlvbnMpO1xuICAgICAgc2VsZi5hdHRyaWJ1dGVzID0ge307XG4gICAgICBzZWxmLnN5bmMoJ2RlbGV0ZScsIHNlbGYsIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JTdGF0ZU1vZGVsO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgJ2xpYic6IHJlcXVpcmUoJy4vbGliJyksXG4gICdCYXNlRXZlbnRFbWl0dGVyJzogcmVxdWlyZSgnLi9CYXNlRXZlbnRFbWl0dGVyJyksXG4gICdCYXNlU2luZ2xldG9uJzogcmVxdWlyZSgnLi9CYXNlU2luZ2xldG9uJyksXG4gICdXQkNsYXNzJzogcmVxdWlyZSgnLi9XQkNsYXNzJyksXG4gICdXQkRlZmVycmVkJzogcmVxdWlyZSgnLi9XQkRlZmVycmVkJyksXG4gICdXQkV2ZW50RW1pdHRlcic6IHJlcXVpcmUoJy4vV0JFdmVudEVtaXR0ZXInKSxcbiAgJ1dCTWl4aW4nOiByZXF1aXJlKCcuL1dCTWl4aW4nKSxcbiAgJ1dCU2luZ2xldG9uJzogcmVxdWlyZSgnLi9XQlNpbmdsZXRvbicpLFxuICAnV0JTdGF0ZU1vZGVsJzogcmVxdWlyZSgnLi9XQlN0YXRlTW9kZWwnKSxcbiAgJ21peGlucyc6IHJlcXVpcmUoJy4vbWl4aW5zJylcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGFzc2VydCAoY29uZGl0aW9uLCBtZXNzYWdlKSB7XG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UgfHwgJycpO1xuICB9XG59XG5cbnZhciBuYXRpdmVJc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbmFzc2VydC5lbXB0eSA9IGZ1bmN0aW9uIChvYmplY3QsIG1lc3NhZ2UpIHtcbiAgdmFyIGtleXMgPSBuYXRpdmVJc0FycmF5KG9iamVjdCkgPyBvYmplY3QgOiBPYmplY3Qua2V5cyhvYmplY3QpO1xuICBhc3NlcnQoa2V5cy5sZW5ndGggPT09IDAsIG1lc3NhZ2UpO1xufTtcblxuYXNzZXJ0LmFycmF5ID0gZnVuY3Rpb24gKGFycmF5LCBtZXNzYWdlKSB7XG4gIGFzc2VydChuYXRpdmVJc0FycmF5KGFycmF5KSwgbWVzc2FnZSk7XG59O1xuXG5hc3NlcnQuY2xhc3MgPSBmdW5jdGlvbiAoa2xhc3MsIG1lc3NhZ2UpIHtcbiAgdmFyIHByb3RvID0ga2xhc3MucHJvdG90eXBlO1xuICBhc3NlcnQocHJvdG8gJiYgcHJvdG8uY29uc3RydWN0b3IgPT09IGtsYXNzLCBtZXNzYWdlKTtcbn07XG5cbnZhciB0eXBlcyA9IFtcbiAgJ3VuZGVmaW5lZCcsXG4gICdib29sZWFuJyxcbiAgJ251bWJlcicsXG4gICdzdHJpbmcnLFxuICAnZnVuY3Rpb24nLFxuICAnb2JqZWN0J1xuXTtcblxuZnVuY3Rpb24gdHlwZWNoZWNrICh0eXBlKSB7XG4gIGFzc2VydFt0eXBlXSA9IGZ1bmN0aW9uIChvLCBtZXNzYWdlKSB7XG4gICAgYXNzZXJ0KHR5cGVvZiBvID09PSB0eXBlLCBtZXNzYWdlKTtcbiAgfTtcbn1cblxud2hpbGUgKHR5cGVzLmxlbmd0aCkge1xuICB0eXBlY2hlY2sodHlwZXMuc2hpZnQoKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYXNzZXJ0OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xuXG5mdW5jdGlvbiBjbG9uZUFycmF5IChhcnIsIGlzRGVlcCkge1xuICBhcnIgPSBhcnIuc2xpY2UoKTtcbiAgaWYgKGlzRGVlcCkge1xuICAgIHZhciBuZXdBcnIgPSBbXSwgdmFsdWU7XG4gICAgd2hpbGUgKGFyci5sZW5ndGgpIHtcbiAgICAgIHZhbHVlID0gYXJyLnNoaWZ0KCk7XG4gICAgICB2YWx1ZSA9ICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkgPyBjbG9uZSh2YWx1ZSwgaXNEZWVwKSA6IHZhbHVlO1xuICAgICAgbmV3QXJyLnB1c2godmFsdWUpO1xuICAgIH1cbiAgICBhcnIgPSBuZXdBcnI7XG4gIH1cbiAgcmV0dXJuIGFycjtcbn1cblxuZnVuY3Rpb24gY2xvbmVEYXRlIChkYXRlKSB7XG4gIHJldHVybiBuZXcgRGF0ZShkYXRlKTtcbn1cblxuZnVuY3Rpb24gY2xvbmVPYmplY3QgKHNvdXJjZSwgaXNEZWVwKSB7XG4gIHZhciBvYmplY3QgPSB7fTtcbiAgZm9yICh2YXIga2V5IGluIHNvdXJjZSkge1xuICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgdmFyIHZhbHVlID0gc291cmNlW2tleV07XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gY2xvbmVEYXRlKHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCAmJiBpc0RlZXApIHtcbiAgICAgICAgb2JqZWN0W2tleV0gPSBjbG9uZSh2YWx1ZSwgaXNEZWVwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9iamVjdFtrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBvYmplY3Q7XG59XG5cbmZ1bmN0aW9uIGNsb25lIChvYmosIGlzRGVlcCkge1xuXG4gIGlmIChuYXRpdmVJc0FycmF5KG9iaikpIHtcbiAgICByZXR1cm4gY2xvbmVBcnJheShvYmosIGlzRGVlcCk7XG4gIH1cblxuICByZXR1cm4gY2xvbmVPYmplY3Qob2JqLCBpc0RlZXApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNsb25lO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiByZXBsYWNlciAobWF0Y2gpIHtcbiAgdmFyIHJhbmQgPSBNYXRoLnJhbmRvbSgpICogMTYgfCAwO1xuICB2YXIgY2hyID0gKG1hdGNoID09PSAneCcpID8gcmFuZCA6IChyYW5kICYgMHgzIHwgMHg4KTtcbiAgcmV0dXJuIGNoci50b1N0cmluZygxNik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVVJRCAocHJlZml4KSB7XG4gIHZhciB1aWQgPSAneHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4Jy5yZXBsYWNlKC9beHldL2csIHJlcGxhY2VyKTtcbiAgcmV0dXJuIFN0cmluZyghcHJlZml4ID8gJycgOiBwcmVmaXgpICsgdWlkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVVJRDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuL3RvQXJyYXknKTtcbnZhciBkZWxheSA9IHJlcXVpcmUoJy4vZGVsYXknKTtcblxuZnVuY3Rpb24gZGVmZXIgKGZuKSB7XG4gIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICBhcmdzWzBdID0gMTtcbiAgYXJncy51bnNoaWZ0KGZuKTtcbiAgcmV0dXJuIGRlbGF5LmFwcGx5KG51bGwsIGFyZ3MpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdG9BcnJheSA9IHJlcXVpcmUoJy4vdG9BcnJheScpO1xuXG5mdW5jdGlvbiBkZWxheSAoZm4sIHRpbWUsIGNvbnRleHQpIHtcbiAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cywgMyk7XG4gIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBkZXN0cm95ZWQgPSBjb250ZXh0ICYmIGNvbnRleHQuZGVzdHJveWVkO1xuICAgICFkZXN0cm95ZWQgJiYgZm4uYXBwbHkoY29udGV4dCwgYXJncyk7XG4gIH0sIHRpbWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRlbGF5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXNzZXJ0ID0gcmVxdWlyZSgnLi9hc3NlcnQnKTtcbnZhciB0b0FycmF5ID0gcmVxdWlyZSgnLi90b0FycmF5Jyk7XG52YXIgY2xvbmUgPSByZXF1aXJlKCcuL2Nsb25lJyk7XG5cbnZhciBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG52YXIgdmFsaWRhdGlvbkVycm9ycyA9IHtcbiAgJ3RyaWdnZXInOiAnQ2Fubm90IHRyaWdnZXIgZXZlbnQocykgd2l0aG91dCBldmVudCBuYW1lKHMpJyxcbiAgJ2V2ZW50cyc6ICdDYW5ub3QgYmluZC91bmJpbmQgd2l0aG91dCB2YWxpZCBldmVudCBuYW1lKHMpJyxcbiAgJ2NhbGxiYWNrJzogJ0Nhbm5vdCBiaW5kL3VuYmluZCB0byBhbiBldmVudCB3aXRob3V0IHZhbGlkIGNhbGxiYWNrIGZ1bmN0aW9uJ1xufTtcblxudmFyIGV2ZW50cyA9IHtcblxuICAncHJvcGVydGllcyc6IHtcbiAgICAnX2V2ZW50cyc6IHt9LFxuICAgICdfY2FjaGUnOiB7fVxuICB9LFxuXG4gICdvbic6IGZ1bmN0aW9uIChldmVudHMsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyB2YWxpZGF0ZSBhcmd1bWVudHNcbiAgICBhc3NlcnQuc3RyaW5nKGV2ZW50cywgdmFsaWRhdGlvbkVycm9ycy5ldmVudHMpO1xuICAgIGFzc2VydC5mdW5jdGlvbihjYWxsYmFjaywgdmFsaWRhdGlvbkVycm9ycy5jYWxsYmFjayk7XG5cbiAgICAvLyBsb29wIHRocm91Z2ggdGhlIGV2ZW50cyAmIGJpbmQgdGhlbVxuICAgIHNlbGYuaXRlcmF0ZShldmVudHMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAvLyBrZWVwIHRoZSBiaW5kaW5nXG4gICAgICBzZWxmLmJpbmQobmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpO1xuXG4gICAgICAvLyBpZiB0aGlzIHdhcyBhIHB1Ymxpc2hlZCBldmVudCwgZG8gYW4gaW1tZWRpYXRlIHRyaWdnZXJcbiAgICAgIHZhciBjYWNoZSA9IHNlbGYuX2NhY2hlO1xuICAgICAgaWYgKGNhY2hlW25hbWVdKSB7XG4gICAgICAgIGNhbGxiYWNrLmFwcGx5KGNvbnRleHQgfHwgc2VsZiwgY2FjaGVbbmFtZV0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ29mZic6IGZ1bmN0aW9uIChldmVudHMsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyB2YWxpZGF0ZSBldmVudHMgb25seSBpZiBhIHRydXRoeSB2YWx1ZSBpcyBwYXNzZWRcbiAgICBldmVudHMgJiYgYXNzZXJ0LnN0cmluZyhldmVudHMsIHZhbGlkYXRpb25FcnJvcnMuZXZlbnRzKTtcblxuICAgIC8vIGlmIG5vIGFyZ3VtZW50cyB3ZXJlIHBhc3NlZCwgdW5iaW5kIGV2ZXJ5dGhpbmdcbiAgICBpZiAoIWV2ZW50cyAmJiAhY2FsbGJhY2sgJiYgIWNvbnRleHQpIHtcbiAgICAgIHNlbGYuX2V2ZW50cyA9IHt9O1xuICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfVxuXG4gICAgLy8gaWYgbm8gZXZlbnRzIGFyZSBwYXNzZWQsIHVuYmluZCBhbGwgZXZlbnRzIHdpdGggdGhpcyBjYWxsYmFja1xuICAgIGV2ZW50cyA9IGV2ZW50cyB8fCBPYmplY3Qua2V5cyhzZWxmLl9ldmVudHMpO1xuXG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBldmVudHMgJiBiaW5kIHRoZW1cbiAgICBzZWxmLml0ZXJhdGUoZXZlbnRzLCBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgc2VsZi51bmJpbmQobmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ29uY2UnOiBmdW5jdGlvbiAoZXZlbnRzLCBjYWxsYmFjaywgY29udGV4dCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuXG4gICAgLy8gY3JlYXRlIGEgb25lIHRpbWUgYmluZGluZ1xuICAgIGFyZ3NbMV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9mZi5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KGNvbnRleHQgfHwgc2VsZiwgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgc2VsZi5vbi5hcHBseShzZWxmLCBhcmdzKTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICdwdWJsaXNoJzogZnVuY3Rpb24gKGV2ZW50cykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuXG4gICAgLy8gdmFsaWRhdGUgZXZlbnRzXG4gICAgYXNzZXJ0LnN0cmluZyhldmVudHMsIHZhbGlkYXRpb25FcnJvcnMuZXZlbnRzKTtcblxuICAgIHNlbGYuaXRlcmF0ZShldmVudHMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICB2YXIgY2FjaGUgPSBzZWxmLl9jYWNoZTtcbiAgICAgIGlmICghY2FjaGVbbmFtZV0pIHtcbiAgICAgICAgY2FjaGVbbmFtZV0gPSBhcmdzLnNsaWNlKDEpO1xuICAgICAgICBhcmdzWzBdID0gbmFtZTtcbiAgICAgICAgc2VsZi50cmlnZ2VyLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ3VucHVibGlzaCc6IGZ1bmN0aW9uIChldmVudHMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHZhbGlkYXRlIGV2ZW50c1xuICAgIGFzc2VydC5zdHJpbmcoZXZlbnRzLCB2YWxpZGF0aW9uRXJyb3JzLmV2ZW50cyk7XG5cbiAgICAvLyByZW1vdmUgdGhlIGNhY2hlIGZvciB0aGUgZXZlbnRzXG4gICAgc2VsZi5pdGVyYXRlKGV2ZW50cywgZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgIHNlbGYuX2NhY2hlW25hbWVdID0gdW5kZWZpbmVkO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ3VucHVibGlzaEFsbCc6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fY2FjaGUgPSB7fTtcbiAgICByZXR1cm4gc2VsZjtcbiAgfSxcblxuICAndHJpZ2dlcic6IGZ1bmN0aW9uIChldmVudHMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIHZhbGlkYXRlIGFyZ3VtZW50c1xuICAgIGFzc2VydC5zdHJpbmcoZXZlbnRzLCB2YWxpZGF0aW9uRXJyb3JzLnRyaWdnZXIpO1xuXG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBldmVudHMgJiB0cmlnZ2VyIHRoZW1cbiAgICB2YXIgcGFyYW1zID0gdG9BcnJheShhcmd1bWVudHMsIDEpO1xuICAgIHNlbGYuaXRlcmF0ZShldmVudHMsIGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICBzZWxmLnRyaWdnZXJFdmVudChuYW1lLCBwYXJhbXMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNlbGY7XG4gIH0sXG5cbiAgJ3RyaWdnZXJFdmVudCc6IGZ1bmN0aW9uIChuYW1lLCBwYXJhbXMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZXZlbnRzID0gc2VsZi5fZXZlbnRzIHx8IHt9O1xuXG4gICAgLy8gY2FsbCBzdWItZXZlbnQgaGFuZGxlcnNcbiAgICB2YXIgY3VycmVudCA9IFtdO1xuICAgIHZhciBmcmFnbWVudHMgPSBuYW1lLnNwbGl0KCc6Jyk7XG4gICAgd2hpbGUgKGZyYWdtZW50cy5sZW5ndGgpIHtcbiAgICAgIGN1cnJlbnQucHVzaChmcmFnbWVudHMuc2hpZnQoKSk7XG4gICAgICBuYW1lID0gY3VycmVudC5qb2luKCc6Jyk7XG4gICAgICBpZiAobmFtZSBpbiBldmVudHMpIHtcbiAgICAgICAgc2VsZi50cmlnZ2VyU2VjdGlvbihuYW1lLCBmcmFnbWVudHMsIHBhcmFtcyk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gICd0cmlnZ2VyU2VjdGlvbic6IGZ1bmN0aW9uIChuYW1lLCBmcmFnbWVudHMsIHBhcmFtcykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBldmVudHMgPSBzZWxmLl9ldmVudHMgfHwge307XG4gICAgdmFyIGJ1Y2tldCA9IGV2ZW50c1tuYW1lXSB8fCBbXTtcblxuICAgIGJ1Y2tldC5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICB2YXIgYXJncztcbiAgICAgIGlmIChmcmFnbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIGFyZ3MgPSBjbG9uZShwYXJhbXMpO1xuICAgICAgICBhcmdzLnVuc2hpZnQoZnJhZ21lbnRzKTtcbiAgICAgIH1cbiAgICAgIGl0ZW0uY2FsbGJhY2suYXBwbHkoaXRlbS5jb250ZXh0IHx8IHNlbGYsIGFyZ3MgfHwgcGFyYW1zKTtcbiAgICB9KTtcbiAgfSxcblxuICAnaXRlcmF0ZSc6IGZ1bmN0aW9uIChldmVudHMsIGl0ZXJhdG9yKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAodHlwZW9mIGV2ZW50cyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGV2ZW50cyA9IGV2ZW50cy5zcGxpdChldmVudFNwbGl0dGVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYXNzZXJ0LmFycmF5KGV2ZW50cyk7XG4gICAgfVxuXG4gICAgd2hpbGUgKGV2ZW50cy5sZW5ndGgpIHtcbiAgICAgIGl0ZXJhdG9yLmNhbGwoc2VsZiwgZXZlbnRzLnNoaWZ0KCkpO1xuICAgIH1cbiAgfSxcblxuICAnYmluZCc6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gc3RvcmUgdGhlIHJlZmVyZW5jZSB0byB0aGUgY2FsbGJhY2sgKyBjb250ZXh0XG4gICAgdmFyIGV2ZW50cyA9IHNlbGYuX2V2ZW50cyB8fCB7fTtcbiAgICB2YXIgYnVja2V0ID0gZXZlbnRzW25hbWVdIHx8IChldmVudHNbbmFtZV0gPSBbXSk7XG4gICAgYnVja2V0LnB1c2goe1xuICAgICAgJ2NhbGxiYWNrJzogY2FsbGJhY2ssXG4gICAgICAnY29udGV4dCc6IGNvbnRleHRcbiAgICB9KTtcblxuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICd1bmJpbmQnOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIGxvb2t1cCB0aGUgcmVmZXJlbmNlIHRvIGhhbmRsZXIgJiByZW1vdmUgaXRcbiAgICB2YXIgZXZlbnRzID0gc2VsZi5fZXZlbnRzO1xuICAgIHZhciBidWNrZXQgPSBldmVudHNbbmFtZV0gfHwgW107XG4gICAgdmFyIHJldGFpbiA9IFtdO1xuXG4gICAgLy8gbG9vcCB0aHJvdWdoIHRoZSBoYW5kbGVyc1xuICAgIHZhciBpID0gLTEsIGwgPSBidWNrZXQubGVuZ3RoLCBpdGVtO1xuICAgIHdoaWxlICgrK2kgPCBsKSB7XG4gICAgICBpdGVtID0gYnVja2V0W2ldO1xuICAgICAgaWYgKChjYWxsYmFjayAmJiBjYWxsYmFjayAhPT0gaXRlbS5jYWxsYmFjaykgfHxcbiAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBpdGVtLmNvbnRleHQpKSB7XG4gICAgICAgIHJldGFpbi5wdXNoKGl0ZW0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGZsdXNoIG91dCBkZXRhY2hlZCBoYW5kbGVyc1xuICAgIGV2ZW50c1tuYW1lXSA9IHJldGFpbjtcblxuICAgIHJldHVybiBzZWxmO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50cztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuL3RvQXJyYXknKTtcbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbWVyZ2UnKTtcbnZhciBhc3NlcnQgPSByZXF1aXJlKCcuL2Fzc2VydCcpO1xuXG5mdW5jdGlvbiBleHRlbmQgKCkge1xuXG4gIC8vIGNvbnZlcnQgdGhlIGFyZ3VtZW50IGxpc3QgaW50byBhbiBhcnJheVxuICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcblxuICAvLyB2YWxpZGF0ZSBpbnB1dFxuICBhc3NlcnQoYXJncy5sZW5ndGggPiAwLCAnZXh0ZW5kIGV4cGVjdCBvbmUgb3IgbW9yZSBvYmplY3RzJyk7XG5cbiAgLy8gbG9vcCB0aHJvdWdoIHRoZSBhcmd1bWVudHNcbiAgLy8gJiBtZXJnaW5nIHRoZW0gcmVjdXJzaXZlbHlcbiAgdmFyIG9iamVjdCA9IGFyZ3Muc2hpZnQoKTtcbiAgd2hpbGUgKGFyZ3MubGVuZ3RoKSB7XG4gICAgbWVyZ2Uob2JqZWN0LCBhcmdzLnNoaWZ0KCkpO1xuICB9XG5cbiAgcmV0dXJuIG9iamVjdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZvckFycmF5IChhcnJheSwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcnJheS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBpZiAoaXRlcmF0b3IuY2FsbChjb250ZXh0LCBhcnJheVtpXSwgaSwgYXJyYXkpID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JPYmplY3QgKG9iamVjdCwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgIGlmIChvYmplY3QuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgaWYgKGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqZWN0W2tleV0sIGtleSkgPT09IGZhbHNlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoY29sbGVjdGlvbiwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgdmFyIGhhbmRsZXIgPSBBcnJheS5pc0FycmF5KGNvbGxlY3Rpb24pID8gZm9yQXJyYXkgOiBmb3JPYmplY3Q7XG4gIGhhbmRsZXIoY29sbGVjdGlvbiwgaXRlcmF0b3IsIGNvbnRleHQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZvckVhY2g7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtZXJnZSA9IHJlcXVpcmUoJy4vbWVyZ2UnKTtcbnZhciBleHRlbmQgPSByZXF1aXJlKCcuL2V4dGVuZCcpO1xuXG5mdW5jdGlvbiBtZXJnZUZyb21TdXBlciAoaW5zdGFuY2UsIGtleSkge1xuXG4gIHZhciBjb25zdHJ1Y3RvciA9IGluc3RhbmNlLmNvbnN0cnVjdG9yO1xuICB2YXIgcHJvdG8gPSBjb25zdHJ1Y3Rvci5wcm90b3R5cGU7XG5cbiAgdmFyIGJhc2VEYXRhID0ge307XG4gIGlmIChpbnN0YW5jZS5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgYmFzZURhdGEgPSBpbnN0YW5jZVtrZXldO1xuICB9IGVsc2UgaWYgKHByb3RvLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICBiYXNlRGF0YSA9IHByb3RvW2tleV07XG4gIH1cblxuICB2YXIgX3N1cGVyID0gY29uc3RydWN0b3IgJiYgY29uc3RydWN0b3IuX19zdXBlcl9fO1xuICBpZiAoX3N1cGVyKSB7XG4gICAgYmFzZURhdGEgPSBtZXJnZShtZXJnZUZyb21TdXBlcihfc3VwZXIsIGtleSksIGJhc2VEYXRhKTtcbiAgfVxuXG4gIHJldHVybiBleHRlbmQoe30sIGJhc2VEYXRhKTtcbn1cblxuZnVuY3Rpb24gY29uY2F0RnJvbVN1cGVyIChpbnN0YW5jZSwga2V5KSB7XG5cbiAgdmFyIGNvbnN0cnVjdG9yID0gaW5zdGFuY2UuY29uc3RydWN0b3I7XG4gIHZhciBwcm90byA9IGNvbnN0cnVjdG9yLnByb3RvdHlwZTtcblxuICB2YXIgYmFzZURhdGEgPSBbXTtcbiAgaWYgKGluc3RhbmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICBiYXNlRGF0YSA9IGluc3RhbmNlW2tleV07XG4gIH0gZWxzZSBpZiAocHJvdG8uaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgIGJhc2VEYXRhID0gcHJvdG9ba2V5XTtcbiAgfVxuXG4gIHZhciBfc3VwZXIgPSBjb25zdHJ1Y3RvciAmJiBjb25zdHJ1Y3Rvci5fX3N1cGVyX187XG4gIGlmIChfc3VwZXIpIHtcbiAgICBiYXNlRGF0YSA9IFtdLmNvbmNhdChjb25jYXRGcm9tU3VwZXIoX3N1cGVyLCBrZXkpLCBiYXNlRGF0YSk7XG4gIH1cblxuICByZXR1cm4gW10uY29uY2F0KGJhc2VEYXRhKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdtZXJnZSc6IG1lcmdlRnJvbVN1cGVyLFxuICAnY29uY2F0JzogY29uY2F0RnJvbVN1cGVyXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmdW5jdGlvbnMgKG9iaikge1xuICB2YXIgZnVuY3MgPSBbXTtcbiAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgIGlmICh0eXBlb2Ygb2JqW2tleV0gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZ1bmNzLnB1c2goa2V5KTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZ1bmNzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9ucztcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdhc3NlcnQnOiByZXF1aXJlKCcuL2Fzc2VydCcpLFxuICAnY2xvbmUnOiByZXF1aXJlKCcuL2Nsb25lJyksXG4gICdjcmVhdGVVSUQnOiByZXF1aXJlKCcuL2NyZWF0ZVVJRCcpLFxuICAnZGVmZXInOiByZXF1aXJlKCcuL2RlZmVyJyksXG4gICdkZWxheSc6IHJlcXVpcmUoJy4vZGVsYXknKSxcbiAgJ2V2ZW50cyc6IHJlcXVpcmUoJy4vZXZlbnRzJyksXG4gICdleHRlbmQnOiByZXF1aXJlKCcuL2V4dGVuZCcpLFxuICAnZm9yRWFjaCc6IHJlcXVpcmUoJy4vZm9yRWFjaCcpLFxuICAnZnJvbVN1cGVyJzogcmVxdWlyZSgnLi9mcm9tU3VwZXInKSxcbiAgJ2Z1bmN0aW9ucyc6IHJlcXVpcmUoJy4vZnVuY3Rpb25zJyksXG4gICdpbmhlcml0cyc6IHJlcXVpcmUoJy4vaW5oZXJpdHMnKSxcbiAgJ2lzRXF1YWwnOiByZXF1aXJlKCcuL2lzRXF1YWwnKSxcbiAgJ21lcmdlJzogcmVxdWlyZSgnLi9tZXJnZScpLFxuICAnc2l6ZSc6IHJlcXVpcmUoJy4vc2l6ZScpLFxuICAndG9BcnJheSc6IHJlcXVpcmUoJy4vdG9BcnJheScpLFxuICAnd2hlbic6IHJlcXVpcmUoJy4vd2hlbicpLFxuICAnd2hlcmUnOiByZXF1aXJlKCcuL3doZXJlJylcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi9leHRlbmQnKTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uIHRvIGNvcnJlY3RseSBzZXQgdXAgdGhlIHByb3RvdHlwZSBjaGFpbiwgZm9yIHN1YmNsYXNzZXMuXG4vLyBTaW1pbGFyIHRvIGBnb29nLmluaGVyaXRzYCwgYnV0IHVzZXMgYSBoYXNoIG9mIHByb3RvdHlwZSBwcm9wZXJ0aWVzIGFuZFxuLy8gY2xhc3MgcHJvcGVydGllcyB0byBiZSBleHRlbmRlZC5cbmZ1bmN0aW9uIGluaGVyaXRzIChwYXJlbnQsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7XG5cbiAgdmFyIGNoaWxkO1xuXG4gIC8vIFRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiBmb3IgdGhlIG5ldyBzdWJjbGFzcyBpcyBlaXRoZXIgZGVmaW5lZCBieSB5b3VcbiAgLy8gKHRoZSBcImNvbnN0cnVjdG9yXCIgcHJvcGVydHkgaW4geW91ciBgZXh0ZW5kYCBkZWZpbml0aW9uKSwgb3IgZGVmYXVsdGVkXG4gIC8vIGJ5IHVzIHRvIHNpbXBseSBjYWxsIGBzdXBlcigpYC5cbiAgaWYgKHByb3RvUHJvcHMgJiYgcHJvdG9Qcm9wcy5oYXNPd25Qcm9wZXJ0eSgnY29uc3RydWN0b3InKSkge1xuICAgIGNoaWxkID0gcHJvdG9Qcm9wcy5jb25zdHJ1Y3RvcjtcbiAgfVxuICBlbHNlIHtcbiAgICBjaGlsZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG5cbiAgLy8gSW5oZXJpdCBjbGFzcyAoc3RhdGljKSBwcm9wZXJ0aWVzIGZyb20gcGFyZW50LlxuICBleHRlbmQoY2hpbGQsIHBhcmVudCk7XG5cbiAgLy8gU2V0IHRoZSBwcm90b3R5cGUgY2hhaW4gdG8gaW5oZXJpdCBmcm9tIGBwYXJlbnRgLCB3aXRob3V0IGNhbGxpbmdcbiAgLy8gYHBhcmVudGAncyBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbiAgY2hpbGQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShwYXJlbnQucHJvdG90eXBlKTtcblxuICAvLyBBZGQgcHJvdG90eXBlIHByb3BlcnRpZXMgKGluc3RhbmNlIHByb3BlcnRpZXMpIHRvIHRoZSBzdWJjbGFzcyxcbiAgLy8gaWYgc3VwcGxpZWQuXG4gIGV4dGVuZChjaGlsZC5wcm90b3R5cGUsIHByb3RvUHJvcHMpO1xuXG4gIC8vIENvcnJlY3RseSBzZXQgY2hpbGQncyBgcHJvdG90eXBlLmNvbnN0cnVjdG9yYC5cbiAgY2hpbGQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gY2hpbGQ7XG5cbiAgLy8gQWRkIHN0YXRpYyBwcm9wZXJ0aWVzIHRvIHRoZSBjb25zdHJ1Y3RvciBmdW5jdGlvbiwgaWYgc3VwcGxpZWQuXG4gIGV4dGVuZChjaGlsZCwgc3RhdGljUHJvcHMpO1xuXG4gIC8vIFNldCBhIGNvbnZlbmllbmNlIHByb3BlcnR5XG4gIC8vIGluIGNhc2UgdGhlIHBhcmVudCdzIHByb3RvdHlwZSBpcyBuZWVkZWQgbGF0ZXIuXG4gIGNoaWxkLl9fc3VwZXJfXyA9IHBhcmVudC5wcm90b3R5cGU7XG5cbiAgcmV0dXJuIGNoaWxkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGluaGVyaXRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBUT0RPOiBpbXBsZW1lbnQgZGVlcEVxdWFsXG5mdW5jdGlvbiBpc0VxdWFsIChhLCBiKSB7XG4gIHJldHVybiBhID09PSBiO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzRXF1YWw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0b0FycmF5ID0gcmVxdWlyZSgnLi90b0FycmF5Jyk7XG5cbmZ1bmN0aW9uIG1lcmdlIChvYmplY3QsIHNvdXJjZSkge1xuICB2YXIgc291cmNlcyA9IHRvQXJyYXkoYXJndW1lbnRzLCAxKTtcbiAgd2hpbGUgKHNvdXJjZXMubGVuZ3RoKSB7XG4gICAgc291cmNlID0gc291cmNlcy5zaGlmdCgpO1xuICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBvYmplY3Rba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gb2JqZWN0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1lcmdlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBzaXplIChjb2xsZWN0aW9uKSB7XG4gICFBcnJheS5pc0FycmF5KGNvbGxlY3Rpb24pICYmIChjb2xsZWN0aW9uID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbikpO1xuICByZXR1cm4gY29sbGVjdGlvbi5sZW5ndGg7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2l6ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuZnVuY3Rpb24gdG9BcnJheSAob2JqLCBza2lwKSB7XG4gIHJldHVybiBzbGljZS5jYWxsKG9iaiwgc2tpcCB8fCAwKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0b0FycmF5O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgV0JEZWZlcnJlZCA9IHJlcXVpcmUoJy4uL1dCRGVmZXJyZWQnKTtcbnZhciB0b0FycmF5ID0gcmVxdWlyZSgnLi90b0FycmF5Jyk7XG5cbmZ1bmN0aW9uIFdoZW4gKCkge1xuXG4gIHZhciBjb250ZXh0ID0gdGhpcztcbiAgdmFyIG1haW4gPSBuZXcgV0JEZWZlcnJlZChjb250ZXh0KTtcbiAgdmFyIGRlZmVycmVkcyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcblxuICAvLyBzdXBwb3J0IHBhc3NpbmcgYW4gYXJyYXkgb2YgZGVmZXJyZWRzLCB0byBhdm9pZCBgYXBwbHlgXG4gIGlmIChkZWZlcnJlZHMubGVuZ3RoID09PSAxICYmIEFycmF5LmlzQXJyYXkoZGVmZXJyZWRzWzBdKSkge1xuICAgIGRlZmVycmVkcyA9IGRlZmVycmVkc1swXTtcbiAgfVxuXG4gIHZhciBjb3VudCA9IGRlZmVycmVkcy5sZW5ndGg7XG4gIHZhciBhcmdzID0gbmV3IEFycmF5KGNvdW50KTtcblxuICBmdW5jdGlvbiBGYWlsICgpIHtcbiAgICBtYWluLnJlamVjdFdpdGgodGhpcyk7XG4gIH1cblxuICBmdW5jdGlvbiBEb25lICgpIHtcblxuICAgIGlmIChtYWluLnN0YXRlKCkgPT09ICdyZWplY3RlZCcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaW5kZXggPSBjb3VudCAtIGRlZmVycmVkcy5sZW5ndGggLSAxO1xuICAgIGFyZ3NbaW5kZXhdID0gdG9BcnJheShhcmd1bWVudHMpO1xuXG4gICAgaWYgKGRlZmVycmVkcy5sZW5ndGgpIHtcbiAgICAgIHZhciBuZXh0ID0gZGVmZXJyZWRzLnNoaWZ0KCk7XG4gICAgICBuZXh0LmRvbmUoRG9uZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICAgIG1haW4ucmVzb2x2ZVdpdGguYXBwbHkobWFpbiwgYXJncyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGRlZmVycmVkcy5sZW5ndGgpIHtcblxuICAgIGRlZmVycmVkcy5mb3JFYWNoKGZ1bmN0aW9uIChkZWZlcnJlZCkge1xuICAgICAgZGVmZXJyZWQuZmFpbChGYWlsKTtcbiAgICB9KTtcblxuICAgIHZhciBjdXJyZW50ID0gZGVmZXJyZWRzLnNoaWZ0KCk7XG4gICAgY3VycmVudC5kb25lKERvbmUpO1xuICB9IGVsc2Uge1xuICAgIG1haW4ucmVzb2x2ZSgpO1xuICB9XG5cbiAgcmV0dXJuIG1haW4ucHJvbWlzZSgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFdoZW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBmb3JFYWNoID0gcmVxdWlyZSgnLi9mb3JFYWNoJyk7XG5cbmZ1bmN0aW9uIHdoZXJlIChjb2xsZWN0aW9uLCBwcm9wZXJ0aWVzKSB7XG4gIHZhciBtYXRjaGVzID0gW107XG4gIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBmb3IgKHZhciBrZXkgaW4gcHJvcGVydGllcykge1xuICAgICAgaWYgKGl0ZW1ba2V5XSAhPT0gcHJvcGVydGllc1trZXldKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIG1hdGNoZXMucHVzaChpdGVtKTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gbWF0Y2hlcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3aGVyZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIFdCTWl4aW4gPSByZXF1aXJlKCcuLi9XQk1peGluJyk7XG52YXIgZnJvbVN1cGVyID0gcmVxdWlyZSgnLi4vbGliL2Zyb21TdXBlcicpO1xuXG52YXIgQ29udHJvbGxlck1peGluID0gV0JNaXhpbi5leHRlbmQoe1xuXG4gICdpbml0aWFsaXplJzogZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5jb250cm9sbGVycyA9IFtdO1xuICAgIHNlbGYuaW1wbGVtZW50ZWQgPSBbXTtcblxuICAgIHNlbGYuaW1wbGVtZW50cyA9IGZyb21TdXBlci5jb25jYXQoc2VsZiwgJ2ltcGxlbWVudHMnKTtcbiAgICBzZWxmLmNyZWF0ZUNvbnRyb2xsZXJJbnN0YW5jZXMoKTtcblxuICAgIHNlbGYuYmluZFRvKHNlbGYsICdkZXN0cm95JywgJ2Rlc3Ryb3lDb250cm9sbGVycycpO1xuICB9LFxuXG4gICdjcmVhdGVDb250cm9sbGVySW5zdGFuY2VzJzogZnVuY3Rpb24gKCkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBDb250cm9sbGVyQ2xhc3MsIGNvbnRyb2xsZXJJbnN0YW5jZSwgaTtcbiAgICB2YXIgQ29udHJvbGxlcnMgPSBzZWxmLmltcGxlbWVudHM7XG5cbiAgICBmb3IgKGkgPSBDb250cm9sbGVycy5sZW5ndGg7IGktLTspIHtcbiAgICAgIENvbnRyb2xsZXJDbGFzcyA9IENvbnRyb2xsZXJzW2ldO1xuXG4gICAgICAvLyBJZiB3ZSBoYXZlIGFscmVhZHkgaW1wbGVtZW50ZWQgYSBjb250cm9sbGVyIHRoYXQgaW5oZXJpdHMgZnJvbVxuICAgICAgLy8gdGhpcyBjb250cm9sbGVyLCB3ZSBkb24ndCBuZWVkIGFub3RoZXIgb25lLi4uXG4gICAgICBpZiAoc2VsZi5pbXBsZW1lbnRlZC5pbmRleE9mKENvbnRyb2xsZXJDbGFzcy50b1N0cmluZygpKSA8IDApIHtcblxuICAgICAgICBjb250cm9sbGVySW5zdGFuY2UgPSBuZXcgQ29udHJvbGxlckNsYXNzKHNlbGYpO1xuICAgICAgICBzZWxmLmNvbnRyb2xsZXJzLnB1c2goY29udHJvbGxlckluc3RhbmNlKTtcbiAgICAgICAgY29udHJvbGxlckluc3RhbmNlLnBhcmVudCA9IHNlbGY7XG5cbiAgICAgICAgc2VsZi50cmFja0ltcGxlbWVudGVkU3VwZXJDb25zdHJ1Y3RvcnMoY29udHJvbGxlckluc3RhbmNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gc2VsZi5pbXBsZW1lbnRlZDtcbiAgfSxcblxuICAndHJhY2tJbXBsZW1lbnRlZFN1cGVyQ29uc3RydWN0b3JzJzogZnVuY3Rpb24gKENvbnRyb2xsZXIpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgX3N1cGVyID0gQ29udHJvbGxlci5fX3N1cGVyX187XG4gICAgdmFyIHN1cGVyQ29uc3RydWN0b3IgPSBfc3VwZXIgJiYgX3N1cGVyLmNvbnN0cnVjdG9yO1xuXG4gICAgaWYgKHN1cGVyQ29uc3RydWN0b3IpIHtcbiAgICAgIHNlbGYuaW1wbGVtZW50ZWQucHVzaChzdXBlckNvbnN0cnVjdG9yLnRvU3RyaW5nKCkpO1xuICAgICAgc2VsZi50cmFja0ltcGxlbWVudGVkU3VwZXJDb25zdHJ1Y3RvcnMoc3VwZXJDb25zdHJ1Y3Rvcik7XG4gICAgfVxuICB9LFxuXG4gICdkZXN0cm95Q29udHJvbGxlcnMnOiBmdW5jdGlvbiAoKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBMb29wIGFuZCBkZXN0cm95XG4gICAgdmFyIGNvbnRyb2xsZXI7XG4gICAgdmFyIGNvbnRyb2xsZXJzID0gc2VsZi5jb250cm9sbGVycztcblxuICAgIGZvciAodmFyIGkgPSBjb250cm9sbGVycy5sZW5ndGg7IGktLTspIHtcblxuICAgICAgLy8gQSBjb250cm9sbGVyIGNhbiBleGlzdCBtdWx0aXBsZSB0aW1lcyBpbiB0aGUgbGlzdCxcbiAgICAgIC8vIHNpbmNlIGl0J3MgYmFzZWQgb24gdGhlIGV2ZW50IG5hbWUsXG4gICAgICAvLyBzbyBtYWtlIHN1cmUgdG8gb25seSBkZXN0cm95IGVhY2ggb25lIG9uY2VcbiAgICAgIGNvbnRyb2xsZXIgPSBjb250cm9sbGVyc1tpXTtcbiAgICAgIGNvbnRyb2xsZXIuZGVzdHJveWVkIHx8IGNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGRlbGV0ZSBzZWxmLmNvbnRyb2xsZXJzO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb250cm9sbGVyTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xudmFyIGZyb21TdXBlciA9IHJlcXVpcmUoJy4uL2xpYi9mcm9tU3VwZXInKTtcbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4uL2xpYi9jbG9uZScpO1xuXG52YXIgT2JzZXJ2YWJsZUhhc2hNaXhpbiA9IFdCTWl4aW4uZXh0ZW5kKHtcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBvYnNlcnZlc0hhc2ggPSBmcm9tU3VwZXIubWVyZ2Uoc2VsZiwgJ29ic2VydmVzJyk7XG4gICAgZm9yICh2YXIgdGFyZ2V0IGluIG9ic2VydmVzSGFzaCkge1xuICAgICAgc2VsZi5iaW5kVG9UYXJnZXQoc2VsZi5yZXNvbHZlVGFyZ2V0KHRhcmdldCksIG9ic2VydmVzSGFzaFt0YXJnZXRdKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2JpbmRUb1RhcmdldCc6IGZ1bmN0aW9uICh0YXJnZXQsIGV2ZW50cykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZm9yICh2YXIgZXZlbnRTdHJpbmcgaW4gZXZlbnRzKSB7XG4gICAgICBzZWxmLmJpbmRIYW5kbGVycyh0YXJnZXQsIGV2ZW50U3RyaW5nLCBldmVudHNbZXZlbnRTdHJpbmddKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2JpbmRIYW5kbGVycyc6IGZ1bmN0aW9uICh0YXJnZXQsIGV2ZW50U3RyaW5nLCBoYW5kbGVycykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVycyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGhhbmRsZXJzID0gW2hhbmRsZXJzXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFuZGxlcnMgPSBjbG9uZShoYW5kbGVycyk7XG4gICAgfVxuXG4gICAgd2hpbGUgKGhhbmRsZXJzLmxlbmd0aCkge1xuICAgICAgc2VsZi5iaW5kVG8odGFyZ2V0LCBldmVudFN0cmluZywgaGFuZGxlcnMuc2hpZnQoKSk7XG4gICAgfVxuICB9LFxuXG4gICdyZXNvbHZlVGFyZ2V0JzogZnVuY3Rpb24gKGtleSkge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gYWxsb3cgb2JzZXJ2aW5nIHNlbGZcbiAgICBpZiAoa2V5ID09PSAnc2VsZicpIHtcbiAgICAgIHJldHVybiBzZWxmO1xuICAgIH1cblxuICAgIHZhciB0YXJnZXQgPSBzZWxmW2tleV07XG4gICAgaWYgKCF0YXJnZXQgJiYgdHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYga2V5LmluZGV4T2YoJy4nKSA+IC0xKSB7XG4gICAgICBrZXkgPSBrZXkuc3BsaXQoJy4nKTtcbiAgICAgIHRhcmdldCA9IHNlbGY7XG4gICAgICB3aGlsZSAoa2V5Lmxlbmd0aCAmJiB0YXJnZXQpIHtcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0W2tleS5zaGlmdCgpXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9ic2VydmFibGVIYXNoTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xuLy8gdmFyIGFzc2VydCA9IHJlcXVpcmUoJy4uL2xpYi9hc3NlcnQnKTtcbnZhciBjcmVhdGVVSUQgPSByZXF1aXJlKCcuLi9saWIvY3JlYXRlVUlEJyk7XG5cbnZhciBXQkJpbmRhYmxlTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ3Byb3BlcnRpZXMnOiB7XG4gICAgJ19iaW5kaW5ncyc6IHt9LFxuICAgICdfbmFtZWRFdmVudHMnOiB7fVxuICB9LFxuXG4gIC8vIGtlZXBzIGNhbGxiYWNrIGNsb3N1cmUgaW4gb3duIGV4ZWN1dGlvbiBjb250ZXh0IHdpdGhcbiAgLy8gb25seSBjYWxsYmFjayBhbmQgY29udGV4dFxuICAnY2FsbGJhY2tGYWN0b3J5JzogZnVuY3Rpb24gIChjYWxsYmFjaywgY29udGV4dCkge1xuXG4gICAgdmFyIGJpbmRDYWxsYmFjaztcblxuICAgIHZhciBmb3JTdHJpbmcgPSBmdW5jdGlvbiBzdHJpbmdDYWxsYmFjayAoKSB7XG4gICAgICBjb250ZXh0W2NhbGxiYWNrXS5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICAgIH07XG5cbiAgICB2YXIgZm9yRnVuY3Rpb24gPSBmdW5jdGlvbiBmdW5jdGlvbkNhbGxiYWNrICgpIHtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSB7XG4gICAgICBiaW5kQ2FsbGJhY2sgPSBmb3JTdHJpbmc7XG4gICAgICAvLyBjYW5jZWwgYWx0ZXJuYXRlIGNsb3N1cmUgaW1tZWRpYXRlbHlcbiAgICAgIGZvckZ1bmN0aW9uID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBiaW5kQ2FsbGJhY2sgPSBmb3JGdW5jdGlvbjtcbiAgICAgIGZvclN0cmluZyA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJpbmRDYWxsYmFjaztcbiAgfSxcblxuICAnYmluZFRvJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jaGVja0JpbmRpbmdBcmdzLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG5cbiAgICAvLyBkZWZhdWx0IHRvIHNlbGYgaWYgY29udGV4dCBub3QgcHJvdmlkZWRcbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuXG4gICAgLy8gaWYgdGhpcyBiaW5kaW5nIGFscmVhZHkgbWFkZSwgcmV0dXJuIGl0XG4gICAgdmFyIGJvdW5kID0gc2VsZi5pc0FscmVhZHlCb3VuZCh0YXJnZXQsIGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgaWYgKGJvdW5kKSB7XG4gICAgICByZXR1cm4gYm91bmQ7XG4gICAgfVxuXG5cbiAgICB2YXIgY2FsbGJhY2tGdW5jLCBhcmdzO1xuXG4gICAgLy8gaWYgYSBqcXVlcnkgb2JqZWN0XG4gICAgaWYgKHRhcmdldC5jb25zdHJ1Y3RvciAmJiB0YXJnZXQuY29uc3RydWN0b3IuZm4gJiYgdGFyZ2V0LmNvbnN0cnVjdG9yLmZuLm9uID09PSB0YXJnZXQub24pIHtcbiAgICAgIC8vIGpxdWVyeSBkb2VzIG5vdCB0YWtlIGNvbnRleHQgaW4gLm9uKClcbiAgICAgIC8vIGNhbm5vdCBhc3N1bWUgb24gdGFrZXMgY29udGV4dCBhcyBhIHBhcmFtIGZvciBiaW5kYWJsZSBvYmplY3RcbiAgICAgIC8vIGNyZWF0ZSBhIGNhbGxiYWNrIHdoaWNoIHdpbGwgYXBwbHkgdGhlIG9yaWdpbmFsIGNhbGxiYWNrIGluIHRoZSBjb3JyZWN0IGNvbnRleHRcbiAgICAgIGNhbGxiYWNrRnVuYyA9IHNlbGYuY2FsbGJhY2tGYWN0b3J5KGNhbGxiYWNrLCBjb250ZXh0KTtcbiAgICAgIGFyZ3MgPSBbZXZlbnQsIGNhbGxiYWNrRnVuY107XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEJhY2tib25lIGFjY2VwdHMgY29udGV4dCB3aGVuIGJpbmRpbmcsIHNpbXBseSBwYXNzIGl0IG9uXG4gICAgICBjYWxsYmFja0Z1bmMgPSAodHlwZW9mIGNhbGxiYWNrID09PSAnc3RyaW5nJykgPyBjb250ZXh0W2NhbGxiYWNrXSA6IGNhbGxiYWNrO1xuICAgICAgYXJncyA9IFtldmVudCwgY2FsbGJhY2tGdW5jLCBjb250ZXh0XTtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYmluZGluZyBvbiB0YXJnZXRcbiAgICB0YXJnZXQub24uYXBwbHkodGFyZ2V0LCBhcmdzKTtcblxuICAgIHZhciBiaW5kaW5nID0ge1xuICAgICAgJ3VpZCc6IGNyZWF0ZVVJRCgpLFxuICAgICAgJ3RhcmdldCc6IHRhcmdldCxcbiAgICAgICdldmVudCc6IGV2ZW50LFxuICAgICAgJ29yaWdpbmFsQ2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjYWxsYmFjayc6IGNhbGxiYWNrRnVuYyxcbiAgICAgICdjb250ZXh0JzogY29udGV4dFxuICAgIH07XG5cbiAgICBzZWxmLl9iaW5kaW5nc1tiaW5kaW5nLnVpZF0gPSBiaW5kaW5nO1xuICAgIHNlbGYuYWRkVG9OYW1lZEJpbmRpbmdzKGV2ZW50LCBiaW5kaW5nKTtcblxuICAgIHJldHVybiBiaW5kaW5nO1xuICB9LFxuXG4gICdiaW5kT25jZVRvJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5jaGVja0JpbmRpbmdBcmdzLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG5cbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuXG4gICAgLy8gaWYgdGhpcyBiaW5kaW5nIGFscmVhZHkgbWFkZSwgcmV0dXJuIGl0XG4gICAgdmFyIGJvdW5kID0gc2VsZi5pc0FscmVhZHlCb3VuZCh0YXJnZXQsIGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG4gICAgaWYgKGJvdW5kKSB7XG4gICAgICByZXR1cm4gYm91bmQ7XG4gICAgfVxuXG5cbiAgICAvLyB0aGlzIGlzIGEgd3JhcHBlclxuICAgIHZhciBvbmNlQmluZGluZyA9IGZ1bmN0aW9uICgpIHtcblxuICAgICAgKCh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSA/IGNvbnRleHRbY2FsbGJhY2tdIDogY2FsbGJhY2spLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgICBzZWxmLnVuYmluZEZyb20oYmluZGluZyk7XG4gICAgfTtcblxuICAgIHZhciBiaW5kaW5nID0ge1xuICAgICAgJ3VpZCc6IGNyZWF0ZVVJRCgpLFxuICAgICAgJ3RhcmdldCc6IHRhcmdldCxcbiAgICAgICdldmVudCc6IGV2ZW50LFxuICAgICAgJ29yaWdpbmFsQ2FsbGJhY2snOiBjYWxsYmFjayxcbiAgICAgICdjYWxsYmFjayc6IG9uY2VCaW5kaW5nLFxuICAgICAgJ2NvbnRleHQnOiBjb250ZXh0XG4gICAgfTtcblxuICAgIHRhcmdldC5vbihldmVudCwgb25jZUJpbmRpbmcsIGNvbnRleHQpO1xuXG4gICAgc2VsZi5fYmluZGluZ3NbYmluZGluZy51aWRdID0gYmluZGluZztcbiAgICBzZWxmLmFkZFRvTmFtZWRCaW5kaW5ncyhldmVudCwgYmluZGluZyk7XG5cbiAgICByZXR1cm4gYmluZGluZztcbiAgfSxcblxuICAndW5iaW5kRnJvbSc6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIgdWlkID0gYmluZGluZyAmJiBiaW5kaW5nLnVpZDtcbiAgICBpZiAoIWJpbmRpbmcgfHwgKHR5cGVvZiB1aWQgIT09ICdzdHJpbmcnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdW5iaW5kIGZyb20gdW5kZWZpbmVkIG9yIGludmFsaWQgYmluZGluZycpO1xuICAgIH1cblxuICAgIHZhciBldmVudCA9IGJpbmRpbmcuZXZlbnQ7XG4gICAgdmFyIGNvbnRleHQgPSBiaW5kaW5nLmNvbnRleHQ7XG4gICAgdmFyIGNhbGxiYWNrID0gYmluZGluZy5jYWxsYmFjaztcbiAgICB2YXIgdGFyZ2V0ID0gYmluZGluZy50YXJnZXQ7XG5cbiAgICAvLyBhIGJpbmRpbmcgb2JqZWN0IHdpdGggb25seSB1aWQsIGkuZS4gYSBkZXN0cm95ZWQvdW5ib3VuZFxuICAgIC8vIGJpbmRpbmcgb2JqZWN0IGhhcyBiZWVuIHBhc3NlZCAtIGp1c3QgZG8gbm90aGluZ1xuICAgIGlmICghZXZlbnQgfHwgIWNhbGxiYWNrIHx8ICF0YXJnZXQgfHwgIWNvbnRleHQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0YXJnZXQub2ZmKGV2ZW50LCBjYWxsYmFjaywgY29udGV4dCk7XG5cbiAgICAvLyBjbGVhbiB1cCBiaW5kaW5nIG9iamVjdCwgYnV0IGtlZXAgdWlkIHRvXG4gICAgLy8gbWFrZSBzdXJlIG9sZCBiaW5kaW5ncywgdGhhdCBoYXZlIGFscmVhZHkgYmVlblxuICAgIC8vIGNsZWFuZWQsIGFyZSBzdGlsbCByZWNvZ25pemVkIGFzIGJpbmRpbmdzXG4gICAgZm9yICh2YXIga2V5IGluIGJpbmRpbmcpIHtcbiAgICAgIGlmIChrZXkgIT09ICd1aWQnKSB7XG4gICAgICAgIGRlbGV0ZSBiaW5kaW5nW2tleV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgZGVsZXRlIHNlbGYuX2JpbmRpbmdzW3VpZF07XG5cbiAgICB2YXIgbmFtZWRFdmVudHMgPSBzZWxmLl9uYW1lZEV2ZW50cztcbiAgICB2YXIgZXZlbnRzID0gbmFtZWRFdmVudHNbZXZlbnRdO1xuXG4gICAgaWYgKGV2ZW50cykge1xuICAgICAgdmFyIGNsb25lZCA9IGV2ZW50cyAmJiBldmVudHMuc2xpY2UoMCk7XG4gICAgICBmb3IgKHZhciBpID0gZXZlbnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIGlmIChldmVudHNbaV0udWlkID09PSB1aWQpIHtcbiAgICAgICAgICBjbG9uZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIG5hbWVkRXZlbnRzW2V2ZW50XSA9IGNsb25lZDtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH0sXG5cbiAgJ3VuYmluZEZyb21UYXJnZXQnOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoIXRhcmdldCB8fCAodHlwZW9mIHRhcmdldC5vbiAhPT0gJ2Z1bmN0aW9uJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVuYmluZCBmcm9tIHVuZGVmaW5lZCBvciBpbnZhbGlkIGJpbmRpbmcgdGFyZ2V0Jyk7XG4gICAgfVxuXG4gICAgdmFyIGJpbmRpbmc7XG4gICAgZm9yICh2YXIga2V5IGluIHNlbGYuX2JpbmRpbmdzKSB7XG4gICAgICBiaW5kaW5nID0gc2VsZi5fYmluZGluZ3Nba2V5XTtcbiAgICAgIGlmIChiaW5kaW5nLnRhcmdldCA9PT0gdGFyZ2V0KSB7XG4gICAgICAgIHNlbGYudW5iaW5kRnJvbShiaW5kaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgJ3VuYmluZEFsbCc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBiaW5kaW5nO1xuICAgIGZvciAodmFyIGtleSBpbiBzZWxmLl9iaW5kaW5ncykge1xuICAgICAgYmluZGluZyA9IHNlbGYuX2JpbmRpbmdzW2tleV07XG4gICAgICBzZWxmLnVuYmluZEZyb20oYmluZGluZyk7XG4gICAgfVxuICB9LFxuXG4gICdjaGVja0JpbmRpbmdBcmdzJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCB0aGlzO1xuXG4gICAgLy8gZG8gbm90IGNoYW5nZSB0aGVzZSBtZXNzYWdlcyB3aXRob3V0IHVwZGF0aW5nIHRoZSBzcGVjc1xuICAgIGlmICghdGFyZ2V0IHx8ICh0eXBlb2YgdGFyZ2V0Lm9uICE9PSAnZnVuY3Rpb24nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB1bmRlZmluZWQgdGFyZ2V0IG9yIHRhcmdldCB3aXRob3V0ICNvbiBtZXRob2QnKTtcbiAgICB9XG5cbiAgICBpZiAoIWV2ZW50IHx8ICh0eXBlb2YgZXZlbnQgIT09ICdzdHJpbmcnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB0YXJnZXQgZXZlbnQgd2l0aG91dCBldmVudCBuYW1lJyk7XG4gICAgfVxuXG4gICAgaWYgKCFjYWxsYmFjayB8fCAoKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJykgJiYgKHR5cGVvZiBjYWxsYmFjayAhPT0gJ3N0cmluZycpKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgYmluZCB0byB0YXJnZXQgZXZlbnQgd2l0aG91dCBhIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIGFzIGNhbGxiYWNrJyk7XG4gICAgfVxuXG4gICAgaWYgKCh0eXBlb2YgY2FsbGJhY2sgPT09ICdzdHJpbmcnKSAmJiAhY29udGV4dFtjYWxsYmFja10pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGJpbmQgdG8gdGFyZ2V0IHVzaW5nIGEgbWV0aG9kIG5hbWUgdGhhdCBkb2VzIG5vdCBleGlzdCBmb3IgdGhlIGNvbnRleHQnKTtcbiAgICB9XG4gIH0sXG5cbiAgJ2lzQWxyZWFkeUJvdW5kJzogZnVuY3Rpb24gKHRhcmdldCwgZXZlbnQsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gY2hlY2sgZm9yIHNhbWUgY2FsbGJhY2sgb24gdGhlIHNhbWUgdGFyZ2V0IGluc3RhbmNlXG4gICAgLy8gcmV0dXJuIGVhcmx5IHdpdGh0aGUgZXZlbnQgYmluZGluZ1xuICAgIHZhciBldmVudHMgPSBzZWxmLl9uYW1lZEV2ZW50c1tldmVudF07XG4gICAgaWYgKGV2ZW50cykge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIG1heCA9IGV2ZW50cy5sZW5ndGg7IGkgPCBtYXg7IGkrKykge1xuXG4gICAgICAgIHZhciBjdXJyZW50ID0gZXZlbnRzW2ldIHx8IHt9O1xuXG4gICAgICAgIC8vIHRoZSBiZWxvdyAhYm91bmRUYXJnZXQgY2hlY2sgc2VlbXMgdW5yZWFjaGFibGVcbiAgICAgICAgLy8gd2FzIGFkZGVkIGluIHRoaXMgY29tbWl0IG9mIHRoZSB3ZWIgYXBwOiBjNzVkNTA3N2MwYTg2MjliNjBjYjZkZDFjZDc4ZDNiYzc3ZmNhYzQ4XG4gICAgICAgIC8vIG5lZWQgdG8gYXNrIEFkYW0gdW5kZXIgd2hhdCBjb25kaXRpb25zIHRoaXMgd291bGQgYmUgcG9zc2libGVcbiAgICAgICAgdmFyIGJvdW5kVGFyZ2V0ID0gY3VycmVudC50YXJnZXQ7XG4gICAgICAgIGlmICghYm91bmRUYXJnZXQpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdGFyZ2V0Qm91bmQgPSB0YXJnZXQudWlkID8gdGFyZ2V0LnVpZCA9PT0gYm91bmRUYXJnZXQudWlkIDogZmFsc2U7XG4gICAgICAgIGlmIChjdXJyZW50Lm9yaWdpbmFsQ2FsbGJhY2sgPT09IGNhbGxiYWNrICYmXG4gICAgICAgICAgICBjdXJyZW50LmNvbnRleHQgPT09IGNvbnRleHQgJiYgdGFyZ2V0Qm91bmQpIHtcbiAgICAgICAgICByZXR1cm4gY3VycmVudDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICAnYWRkVG9OYW1lZEJpbmRpbmdzJzogZnVuY3Rpb24gKGV2ZW50LCBiaW5kaW5nKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9uYW1lZEV2ZW50c1tldmVudF0pIHtcbiAgICAgIHNlbGYuX25hbWVkRXZlbnRzW2V2ZW50XSA9IFtdO1xuICAgIH1cbiAgICBzZWxmLl9uYW1lZEV2ZW50c1tldmVudF0ucHVzaChiaW5kaW5nKTtcbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JCaW5kYWJsZU1peGluO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZm9yRWFjaCA9IHJlcXVpcmUoJy4uL2xpYi9mb3JFYWNoJyk7XG52YXIgV0JNaXhpbiA9IHJlcXVpcmUoJy4uL1dCTWl4aW4nKTtcblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBDYWxsIChmbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoZm4gPSBzZWxmW2ZuXSk7XG4gICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpICYmIGZuLmNhbGwoc2VsZik7XG59XG5cbnZhciBjbGVhbnVwTWV0aG9kcyA9IFsndW5iaW5kJywgJ3VuYmluZEFsbCcsICdvbkRlc3Ryb3knXTtcblxudmFyIFdCRGVzdHJveWFibGVNaXhpbiA9IFdCTWl4aW4uZXh0ZW5kKHtcblxuICAnZGVzdHJveSc6IGZ1bmN0aW9uICgpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIGNsZWFuIHVwXG4gICAgZm9yRWFjaChjbGVhbnVwTWV0aG9kcywgQ2FsbCwgc2VsZik7XG5cbiAgICBzZWxmLnRyaWdnZXIoJ2Rlc3Ryb3knKTtcblxuICAgIHNlbGYuZGVzdHJveU9iamVjdChzZWxmKTtcblxuICAgIHNlbGYuZGVzdHJveWVkID0gdHJ1ZTtcbiAgfSxcblxuICAnZGVzdHJveU9iamVjdCc6IGZ1bmN0aW9uIChvYmplY3QpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqZWN0KSB7XG4gICAgICBzZWxmLmRlc3Ryb3lLZXkoa2V5LCBvYmplY3QpO1xuICAgIH1cbiAgfSxcblxuICAnZGVzdHJveUtleSc6IGZ1bmN0aW9uIChrZXksIGNvbnRleHQpIHtcblxuICAgIGlmIChjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkgJiYga2V5ICE9PSAndWlkJyAmJiBrZXkgIT09ICdjaWQnKSB7XG4gICAgICAvLyBtYWtlIGZ1bmN0aW9ucyBub29wXG4gICAgICBpZiAodHlwZW9mIGNvbnRleHRba2V5XSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjb250ZXh0W2tleV0gPSBub29wO1xuICAgICAgfVxuICAgICAgLy8gYW5kIG90aGVycyB1bmRlZmluZWRcbiAgICAgIGVsc2Uge1xuICAgICAgICBjb250ZXh0W2tleV0gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfVxuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQkRlc3Ryb3lhYmxlTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBXQk1peGluID0gcmVxdWlyZSgnLi4vV0JNaXhpbicpO1xudmFyIGV2ZW50cyA9IHJlcXVpcmUoJy4uL2xpYi9ldmVudHMnKTtcblxudmFyIFdCRXZlbnRzTWl4aW4gPSBXQk1peGluLmV4dGVuZChldmVudHMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdCRXZlbnRzTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjbG9uZSA9IHJlcXVpcmUoJy4uL2xpYi9jbG9uZScpO1xudmFyIG1lcmdlID0gcmVxdWlyZSgnLi4vbGliL21lcmdlJyk7XG52YXIgZXh0ZW5kID0gcmVxdWlyZSgnLi4vbGliL2V4dGVuZCcpO1xudmFyIGlzRXF1YWwgPSByZXF1aXJlKCcuLi9saWIvaXNFcXVhbCcpO1xudmFyIFdCTWl4aW4gPSByZXF1aXJlKCcuLi9XQk1peGluJyk7XG5cbnZhciBXQlN0YXRlTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ2F0dHJpYnV0ZXMnOiB7fSxcbiAgJ29wdGlvbnMnOiB7fSxcblxuICAnaW5pdGlhbGl6ZSc6IGZ1bmN0aW9uIChhdHRyaWJ1dGVzLCBvcHRpb25zKSB7XG5cbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5hdHRyaWJ1dGVzID0gZXh0ZW5kKHt9LCBzZWxmLmRlZmF1bHRzLCBhdHRyaWJ1dGVzKTtcbiAgICBzZWxmLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHNlbGYuY2hhbmdlZCA9IHt9O1xuICB9LFxuXG4gICdnZXQnOiBmdW5jdGlvbiAoa2V5KSB7XG4gICAgY29uc29sZS53YXJuKCdnZXR0ZXJzIGFyZSBkZXByZWNhdGVkJyk7XG4gICAgcmV0dXJuIHRoaXMuYXR0cmlidXRlc1trZXldO1xuICB9LFxuXG4gICdzZXQnOiBmdW5jdGlvbiAoa2V5LCB2YWwsIG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoa2V5ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gc2VsZjtcbiAgICB9XG5cbiAgICB2YXIgYXR0cnMsIGF0dHI7XG4gICAgLy8gSGFuZGxlIGJvdGggYFwia2V5XCIsIHZhbHVlYCBhbmQgYHtrZXk6IHZhbHVlfWAgLXN0eWxlIGFyZ3VtZW50cy5cbiAgICBpZiAodHlwZW9mIGtleSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGF0dHJzID0ga2V5O1xuICAgICAgb3B0aW9ucyA9IHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgYXR0cnMgPSB7fTtcbiAgICAgIGF0dHJzW2tleV0gPSB2YWw7XG4gICAgfVxuXG4gICAgLy8gZGVmYXVsdCBvcHRpb25zIGFyZSBlbXB0eVxuICAgIG9wdGlvbnMgfHwgKG9wdGlvbnMgPSB7fSk7XG5cbiAgICAvLyBubyBuZWVkIHRvIHRyYWNrIGNoYW5nZXMgb24gb3B0aW9ucy5zaWxlbnRcbiAgICBpZiAob3B0aW9ucy5zaWxlbnQpIHtcbiAgICAgIG1lcmdlKHNlbGYuYXR0cmlidXRlcywgYXR0cik7XG4gICAgfVxuICAgIC8vIEZvciBlYWNoIGBzZXRgIGF0dHJpYnV0ZSwgdXBkYXRlIG9yIGRlbGV0ZSB0aGUgY3VycmVudCB2YWx1ZS5cbiAgICBlbHNlIHtcbiAgICAgIHZhciBjaGFuZ2VzID0gc2VsZi5jaGFuZ2VzKGF0dHJzLCBvcHRpb25zKTtcbiAgICAgIHNlbGYuX3RyaWdnZXIoYXR0cnMsIGNoYW5nZXMsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWxmO1xuICB9LFxuXG4gICd1bnNldCc6IGZ1bmN0aW9uIChhdHRyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuc2V0KGF0dHIsIHVuZGVmaW5lZCwgZXh0ZW5kKHt9LCBvcHRpb25zLCB7ICd1bnNldCc6IHRydWUgfSkpO1xuICB9LFxuXG4gICdjbGVhcic6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLnNldChzZWxmLmRlZmF1bHRzLCBvcHRpb25zKTtcbiAgfSxcblxuICAnY2hhbmdlcyc6IGZ1bmN0aW9uIChhdHRycywgb3B0aW9ucykge1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBrZXksIHZhbDtcbiAgICB2YXIgY2hhbmdlcyA9IFtdO1xuXG4gICAgdmFyIHByZXYgPSBjbG9uZShzZWxmLmF0dHJpYnV0ZXMsIHRydWUpO1xuICAgIHZhciBjdXJyZW50ID0gc2VsZi5hdHRyaWJ1dGVzO1xuICAgIHNlbGYuY2hhbmdlZCA9IHt9O1xuXG4gICAgZm9yIChrZXkgaW4gYXR0cnMpIHtcbiAgICAgIHZhbCA9IGF0dHJzW2tleV07XG4gICAgICBpZiAoIWlzRXF1YWwoY3VycmVudFtrZXldLCB2YWwpKSB7XG4gICAgICAgIGNoYW5nZXMucHVzaChrZXkpO1xuICAgICAgfVxuICAgICAgaWYgKCFpc0VxdWFsKHByZXZba2V5XSwgdmFsKSkge1xuICAgICAgICBzZWxmLmNoYW5nZWRba2V5XSA9IHZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSBzZWxmLmNoYW5nZWRba2V5XTtcbiAgICAgIH1cblxuICAgICAgY3VycmVudFtrZXldID0gb3B0aW9ucy51bnNldCA/IHVuZGVmaW5lZCA6IHZhbDtcbiAgICB9XG5cbiAgICByZXR1cm4gY2hhbmdlcztcbiAgfSxcblxuICAnX3RyaWdnZXInOiBmdW5jdGlvbiAoYXR0cnMsIGNoYW5nZXMsIG9wdGlvbnMpIHtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudCA9IHNlbGYuYXR0cmlidXRlcztcblxuICAgIC8vIGlmIGFueSBjaGFuZ2VzIGZvdW5kXG4gICAgLy8gJiBpZiB0aGlzIGlzIGFuIEV2ZW50RW1pdHRlcixcbiAgICAvLyB0cmlnZ2VyIHRoZSBjaGFuZ2UgZXZlbnRzXG4gICAgdmFyIGF0dHI7XG4gICAgd2hpbGUgKGNoYW5nZXMgJiYgY2hhbmdlcy5sZW5ndGggJiYgc2VsZi50cmlnZ2VyKSB7XG4gICAgICBhdHRyID0gY2hhbmdlcy5zaGlmdCgpO1xuICAgICAgc2VsZi50cmlnZ2VyKCdjaGFuZ2U6JyArIGF0dHIsIHNlbGYsIGN1cnJlbnRbYXR0cl0sIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV0JTdGF0ZU1peGluO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgV0JNaXhpbiA9IHJlcXVpcmUoJy4uL1dCTWl4aW4nKTtcbnZhciBXQkRlZmVycmVkID0gcmVxdWlyZSgnLi4vV0JEZWZlcnJlZCcpO1xudmFyIHdoZW4gPSByZXF1aXJlKCcuLi9saWIvd2hlbicpO1xudmFyIHRvQXJyYXkgPSByZXF1aXJlKCcuLi9saWIvdG9BcnJheScpO1xudmFyIGZvckVhY2ggPSByZXF1aXJlKCcuLi9saWIvZm9yRWFjaCcpO1xudmFyIGRlbGF5ID0gcmVxdWlyZSgnLi4vbGliL2RlbGF5Jyk7XG52YXIgZGVmZXIgPSByZXF1aXJlKCcuLi9saWIvZGVmZXInKTtcbnZhciBmdW5jdGlvbnMgPSByZXF1aXJlKCcuLi9saWIvZnVuY3Rpb25zJyk7XG5cbnZhciBXQlV0aWxzTWl4aW4gPSBXQk1peGluLmV4dGVuZCh7XG5cbiAgJ2RlZmVycmVkJzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gbmV3IFdCRGVmZXJyZWQoc2VsZik7XG4gIH0sXG5cbiAgJ3doZW4nOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiB3aGVuLmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gIH0sXG5cbiAgJ2RlZmVyJzogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgIC8vIGRlZmF1bHQgY29udGV4dCB0byBzZWxmXG4gICAgYXJnc1sxXSA9IGFyZ3NbMV0gfHwgdGhpcztcbiAgICAvLyBzdXBwb3J0IHN0cmluZyBuYW1lcyBvZiBmdW5jdGlvbnMgb24gc2VsZlxuICAgICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoYXJnc1swXSA9IHNlbGZbZm5dKTtcbiAgICByZXR1cm4gZGVmZXIuYXBwbHkobnVsbCwgYXJncyk7XG4gIH0sXG5cbiAgJ2RlbGF5JzogZnVuY3Rpb24gKGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgIC8vIGRlZmF1bHQgY29udGV4dCB0byBzZWxmXG4gICAgYXJnc1syXSA9IGFyZ3NbMl0gfHwgc2VsZjtcbiAgICAvLyBzdXBwb3J0IHN0cmluZyBuYW1lcyBvZiBmdW5jdGlvbnMgb24gc2VsZlxuICAgICh0eXBlb2YgZm4gPT09ICdzdHJpbmcnKSAmJiAoYXJnc1swXSA9IHNlbGZbZm5dKTtcbiAgICByZXR1cm4gZGVsYXkuYXBwbHkobnVsbCwgYXJncyk7XG4gIH0sXG5cbiAgJ2ZvckVhY2gnOiBmdW5jdGlvbiAoY29sbGVjdGlvbiwgZm4sIGNvbnRleHQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gZGVmYXVsdCBjb250ZXh0IHRvIHNlbGZcbiAgICBjb250ZXh0ID0gY29udGV4dCB8fCBzZWxmO1xuICAgIC8vIHN1cHBvcnQgc3RyaW5nIG5hbWVzIG9mIGZ1bmN0aW9ucyBvbiBzZWxmXG4gICAgKHR5cGVvZiBmbiA9PT0gJ3N0cmluZycpICYmIChmbiA9IHNlbGZbZm5dKTtcbiAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZuLCBjb250ZXh0KTtcbiAgfSxcblxuICAnZnVuY3Rpb25zJzogZnVuY3Rpb24gKG9iaikge1xuICAgIHJldHVybiBmdW5jdGlvbnMob2JqIHx8IHRoaXMpO1xuICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXQlV0aWxzTWl4aW47XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnQ29udHJvbGxlck1peGluJzogcmVxdWlyZSgnLi9Db250cm9sbGVyTWl4aW4nKSxcbiAgJ09ic2VydmFibGVIYXNoTWl4aW4nOiByZXF1aXJlKCcuL09ic2VydmFibGVIYXNoTWl4aW4nKSxcbiAgJ1dCQmluZGFibGVNaXhpbic6IHJlcXVpcmUoJy4vV0JCaW5kYWJsZU1peGluJyksXG4gICdXQkRlc3Ryb3lhYmxlTWl4aW4nOiByZXF1aXJlKCcuL1dCRGVzdHJveWFibGVNaXhpbicpLFxuICAnV0JFdmVudHNNaXhpbic6IHJlcXVpcmUoJy4vV0JFdmVudHNNaXhpbicpLFxuICAnV0JTdGF0ZU1peGluJzogcmVxdWlyZSgnLi9XQlN0YXRlTWl4aW4nKSxcbiAgJ1dCVXRpbHNNaXhpbic6IHJlcXVpcmUoJy4vV0JVdGlsc01peGluJylcbn07Il19
(10)
});
