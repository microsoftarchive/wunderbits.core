'use strict';

var gulp = require('gulp');
var cjs = require('gulp-cjs');

// load tasks
gulp.task('scripts', cjs.scripts(gulp, {
  'sourceDir': 'public',
  'destDir': 'dist',
  'name': 'wunderbits.core'
}));

// require('./gulp/tasks/specs')(gulp);
