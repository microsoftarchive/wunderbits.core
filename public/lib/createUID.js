define(function () {

  'use strict';

  function replacer (match) {
    var rand = Math.random() * 16 | 0;
    var chr = (match === 'x') ? rand : (rand & 0x3 | 0x8);
    return chr.toString(16);
  }

  return function createUID (prefix) {
    var uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, replacer);
    return String(!prefix ? '' : prefix) + uid;
  };
});