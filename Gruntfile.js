module.exports = function (grunt) {

  'use strict';

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-complexity');

  function config (name) {
    return grunt.file.readJSON('grunt/configs/' + name + '.json');
  }

  grunt.initConfig({
    'jshint': config('jshint'),
    'complexity': config('complexity')
  });

  grunt.registerTask('lint', ['jshint', 'complexity']);
  grunt.registerTask('default', ['lint']);
};