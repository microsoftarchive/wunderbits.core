describe('createUID', function () {

  'use strict';

  var topic = require('lib/createUID');

  it('should be a function', function () {
    expect(topic).to.be.a('function');
  });

  it('should generate unique uuids', function () {

    var ids = [];

    var id;
    for (var i=0, len=10000; i <= len; i++) {
      id = topic();
      expect(ids.indexOf(id)).to.equal(-1);
      ids.push(id);
    }
  });

  it ('should generate a uuid with a prefix', function () {

    var str = 'foobar';
    var regex = new RegExp('^' + str);

    var uuid = topic(str);
    expect(regex.test(uuid)).to.be.true;
  });
});