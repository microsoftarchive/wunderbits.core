module.exports = function (grunt) {

  'use strict';

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-complexity');
  grunt.loadNpmTasks('bilder-requirejs');
  grunt.loadNpmTasks('kaapi');

  function config (name) {
    return grunt.file.readJSON('grunt/configs/' + name + '.json');
  }

  grunt.initConfig({

    // Linting
    'jshint': config('jshint'),
    'complexity': config('complexity'),

    // JS Build
    'requirejs': config('requirejs'),

    // Specs
    'kaapi/node': config('kaapi'),
    'kaapi/phantom': config('kaapi')
  });

  grunt.registerTask('lint', ['jshint', 'complexity']);
  grunt.registerTask('specs', ['kaapi/node', 'kaapi/phantom']);
  grunt.registerTask('build', ['requirejs']);

  grunt.registerTask('default', ['lint', 'specs', 'build']);
};