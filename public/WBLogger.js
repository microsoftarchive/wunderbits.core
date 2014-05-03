'use strict';

var Console = global.console;
var WBClass = require('./WBClass');
var assert = require('./lib/assert');
var functions = require('./lib/functions');

var WBLoggerPrototype = {

  'constructor': function (namespace) {

    var self = this;

    // assert(self.constructor !== WBLogger, 'can\'t initialize WBLogger');
    assert.string(namespace, 'WBLogger namespace must be a string');

    var namespaceMap = WBLogger.namespaces;
    // if a cached namespaced logger already exists, simply return it
    if (namespaceMap[namespace] instanceof WBLogger) {
      return namespaceMap[namespace];
    }

    self.namespace = namespace;
    namespaceMap[namespace] = self;

    WBClass.call(self);

    // forces GC of potentially large object immediately
    namespaceMap = null;
  },

  'shouldRun': function () {

    var shouldRun = WBLogger.pattern && WBLogger.pattern.test(this.namespace);
    return !!(shouldRun && Console);
  }
};

functions(Console).forEach(function (method) {

  WBLoggerPrototype[method] = function () {

    this.shouldRun() && Console[method].apply(Console, arguments);
  };
});

var WBLogger = WBClass.extend(WBLoggerPrototype);

WBLogger.namespaces = {};

WBLogger.release = function () {

  WBLogger.namespaces = {};
};

WBLogger.log = function (regexPatternString) {

  regexPatternString = regexPatternString === '*' ? '.?' : regexPatternString;
  WBLogger.pattern = new RegExp(regexPatternString);
};

module.exports = global.WBLogger = WBLogger;