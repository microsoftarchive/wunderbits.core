(function () {

  'use strict';

  var root = (typeof module !== 'undefined') ? module.exports : window;
  var define = root.define;

  function lookup (name) {
    var node = root;
    var sections = name;
    if (typeof name === 'string') {
      sections = name.split('/');
    }

    var next, blah;
    while (sections.length) {
      blah = sections.shift();
      next = node[blah];
      if (!next) {
        next = node[blah] = {};
      }
      node = next;
    }

    return node;
  }

  function resolve (base, path) {
    var fragments = base.split('/');
    var remaining = path.split('/');
    var section;

    fragments.pop();

    while (remaining.length) {
      section = remaining.shift();
      if (section === '..') {
        fragments.pop();
      } else if (section !== '.') {
        fragments.push(section);
      }
    }

    return lookup(fragments);
  }

  function fakeDefine (name, deps, fn) {

    if (typeof deps === 'function' && !fn) {
      fn = deps;
      deps = [];
    } else {
      deps = deps.map(function (depName) {
        return (depName[0] === '.') ? resolve(name, depName) : lookup(depName);
      });
    }

    var path = name.split('/');
    name = path.pop();
    var node = lookup(path);
    node[name] = fn.apply(null, deps);
  }

  if (typeof define !== 'function' || !define.amd) {
    global.define = root.define = fakeDefine;
  }
}).call(this);