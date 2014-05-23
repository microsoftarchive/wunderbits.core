// http://stackoverflow.com/a/21963136/933653
'use strict';

var ff = 0xff;
var lut = [];
for (var i = 0; i < 256; i++) {
  lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
}

var random = Math.random;
function randHex() {
  return (random() * 0xffffffff | 0);
}

function section0 () {
  var d0 = randHex();
  return lut[d0 & ff] + lut[d0 >> 8 & ff] +
           lut[d0 >> 16 & ff] + lut[d0 >> 24 & ff];
}

function section1 () {
  var d1 = randHex();
  return lut[d1 & ff] + lut[d1 >> 8 & ff] + '-' +
         lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & ff];
}

function section2 () {
  var d2 = randHex();
  return lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & ff] + '-' +
       lut[d2 >> 16 & ff] + lut[d2 >> 24 & ff];
}

function section3 () {
  var d3 = randHex();
  return lut[d3 & ff] + lut[d3 >> 8 & ff] +
       lut[d3 >> 16 & ff] + lut[d3 >> 24 & ff];
}

function createUID (prefix) {
  var uid = [section0(), section1(), section2(), section3()].join('-');
  return (!prefix ? '' : prefix).toString() + uid;
}

module.exports = createUID;
