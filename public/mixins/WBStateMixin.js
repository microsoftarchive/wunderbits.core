define([
  '../lib/clone',
  '../lib/merge',
  '../lib/isEqual',

  '../WBMixin'
], function (
  clone, merge, isEqual,
  WBMixin,
  undefined
) {

  'use strict';

  return WBMixin.extend({

    'attributes': {},
    'options': {},

    'initialize': function (attributes, options) {

      var self = this;
      self.attributes = attributes || {};
      self.options = options || {};
      self.changed = {};
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
    },

    'changes': function (attrs, options) {

      var self = this;
      var key, val;
      var changes = [];

      var prev = clone(self.attributes);
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

        options.unset ? delete current[key] : current[key] = val;
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

});