describe('lib/debounce', function () {

  'use strict';

  var topic = require('lib/debounce');
  var fn = function () {
    count++;
  };

  var debounced, count;
  beforeEach(function () {
    count = 0;
    debounced = topic(fn, 50);
  });

  it('should debounce a function', function (done) {

    var l = 10;
    while (--l) {
      debounced();
    }

    expect(count).to.equal(0);
    setTimeout(function () {
      expect(count).to.equal(1);
      done();
    }, 60);
  });
});
