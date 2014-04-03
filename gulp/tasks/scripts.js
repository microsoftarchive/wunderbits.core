'use strict';

var path = require('path');

var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var streamify = require('gulp-streamify');

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var mold = require('mold-source-map');

var uglifier = uglify({
  'beautify': {
    'width': 80,
    'max-line-len': 80
  },
  'mangle': true,
  'outSourceMap': false
});

module.exports = function scripts (gulp) {

  var publicDir = path.resolve('public');
  gulp.task('scripts', function() {
    browserify({ 'basedir': publicDir })
      .require(require.resolve(publicDir), { 'entry': true })
      // dev version with sourcemaps
      .bundle({
        'standalone': 'wunderbits.core',
        'debug': true
      })
      .pipe(mold.transformSourcesRelativeTo(path.dirname(publicDir)))
      .pipe(source('wunderbits.core.js'))
      .pipe(gulp.dest('./dist/'))
      // minified version
      .pipe(streamify(uglifier))
      .pipe(rename({ 'suffix': '.min' }))
      .pipe(gulp.dest('./dist/'));
  });
};