'use strict';

var WBMixin = require('../WBMixin');
var events = require('../lib/events');

var WBEventsMixin = WBMixin.extend(events);

module.exports = WBEventsMixin;
