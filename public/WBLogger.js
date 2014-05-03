'use strict';

var Console = global.console;
var WBClass = require('./WBClass');
var assert = require('./lib/assert');

var WBLoggerPrototype = {

  'constructor': function (namespace) {

    var self = this;

    // assert(self.constructor !== WBLogger, 'can\'t initialize WBLogger');
    assert.string(namespace, 'WBLogger namespace must be a string');

    var namespaceMap = WBLogger.namespaces;

    // if the namespaced logger already exists, use it
    if (namespaceMap[namespace] instanceof WBLogger) {
      return namespaceMap[namespace];
    }

    // save the namespace
    self.namespace = namespace;

    // cache the instance
    namespaceMap[namespace] = self;

    // call the base constructor
    WBClass.call(self);

    // force GC ?
    namespaceMap = null;
  },

  'shouldRun': function () {

    var self = this;

    var shouldRun = WBLogger.pattern && WBLogger.pattern.test(self.namespace);

    return !!(shouldRun && Console);
  }
};

// this matches the list of chrome console methods
// https://developers.google.com/chrome-developer-tools/docs/console-api
var consoleMethods = [
  'assert',
  'clear',
  'count',
  'debug',
  'dir',
  'dirxml',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'profile',
  'profileEnd',
  'time',
  'timeEnd',
  'timeStamp',
  'trace',
  'warn'
];

consoleMethods.forEach(function (method) {

  WBLoggerPrototype[method] = function () {

    this.shouldRun() && Console[method].apply(Console, arguments);
  };
});

// Extend WBClass
var WBLogger = WBClass.extend(WBLoggerPrototype);

// cache all the namespaced instances for better memory management
WBLogger.namespaces = {};

// allow flushing of this cache
WBLogger.release = function () {

  WBLogger.namespaces = {};
};

// changes current regex test pattern for enabling loggers
WBLogger.log = function (regexPattern) {

  WBLogger.pattern = new RegExp(regexPattern);
};

module.exports = global.WBLogger = WBLogger;