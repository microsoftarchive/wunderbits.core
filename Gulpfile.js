'use strict';

var gulp = require('gulp');
var rename = require('gulp-rename');
var jshint = require('gulp-jshint');
var browserify = require('gulp-browserify');
var uglify = require('gulp-uglify');
// var mold = require('mold-source-map');

gulp.task('scripts', function() {
  var browserifier = browserify({
    'standalone': 'core',
    'debug': true
  });
  var uglifier = uglify({
    'beautify': {
      'width': 80,
      'max-line-len': 80
    },
    'mangle': true,
    'outSourceMap': false
  });
  gulp.src('public/index.js')
    .pipe(jshint())
    .pipe(browserifier)
    // .pipe(mold.transformSourcesRelativeTo('/'))
    .pipe(gulp.dest('./build/'))
    .pipe(rename({ 'suffix': '.min' }))
    .pipe(uglifier)
    .pipe(gulp.dest('./build/'));
});