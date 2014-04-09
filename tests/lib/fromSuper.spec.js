describe('mergeFromSuper / concatFromSuper', function () {

  'use strict';

  var WBClass = require('WBClass');
  var fromSuper = require('lib/fromSuper');

  var mergeFromSuper = fromSuper.merge;
  var concatFromSuper = fromSuper.concat;

  var BaseClass, ChildClass, GrandChildClass;

  beforeEach(function () {
    BaseClass = WBClass.extend({
      'obj': {
        'a': 42
      },
      'arr': [1, 2, 3]
    });

    ChildClass = BaseClass.extend({
      'obj': {
        'b': 88
      }
    });

    GrandChildClass = ChildClass.extend({
      'arr': ['a', 'b']
    });
  });

  it('should merge', function () {

    var instance = new GrandChildClass();
    expect(instance.obj).to.deep.equal({ 'b': 88 });

    instance.obj = mergeFromSuper(instance, 'obj');
    expect(instance.obj).to.deep.equal({ 'a': 42, 'b': 88 });
  });

  it('should concatenate', function () {

    var instance = new GrandChildClass();
    expect(instance.arr).to.deep.equal(['a', 'b']);

    instance.arr = concatFromSuper(instance, 'arr');
    expect(instance.arr).to.deep.equal([1, 2, 3, 'a', 'b']);
  });
});