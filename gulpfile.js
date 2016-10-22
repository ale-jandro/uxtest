var gulp = require('gulp');

var autoprefixer = require('gulp-autoprefixer');
var minifyCSS = require('gulp-minify-css');
var uglify = require('gulp-uglify'); //este proseso lo realice por consola
var uglifycss = require('gulp-uglifycss'); //este proseso lo realice por consola
 


gulp.task('watch', function () {
   gulp.watch('source/stylus/*.styl', ['css']);
});