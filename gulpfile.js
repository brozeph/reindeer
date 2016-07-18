'use strict';

var
	coveralls = require('gulp-coveralls'),
	del = require('del'),
	eslint = require('gulp-eslint'),
	gulp = require('gulp'),
	istanbul = require('gulp-istanbul'),
	mocha = require('gulp-mocha'),
	sequence = require('run-sequence');


gulp.task('clean', function (callback) {
	return del(['reports'], callback);
});


gulp.task('coveralls', ['test-coverage'], function () {
	return gulp
		.src('reports/lcov.info')
		.pipe(coveralls());
});


gulp.task('lint', () => {
	return gulp
		.src(['**/*.js', '!node_modules/**', '!reports/**'])
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});


gulp.task('test-coverage', ['clean'], function () {
	return gulp
		.src(['./lib/**/*.js'])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire())
		.on('finish', function () {
			gulp
				.src(['./test/lib/**/*.js'])
				.pipe(mocha({
					reporter : 'spec'
				}))
				.pipe(istanbul.writeReports('./reports'));
		});
});


gulp.task('test-integration', function () {
	return gulp
		.src(['./test/integration/**/*.js'], { read : false })
		.pipe(mocha({
			checkLeaks : false,
			reporter : 'spec',
			ui : 'bdd'
		}));
});


gulp.task('test-unit', function () {
	return gulp
		.src(['./test/lib/**/*.js'], { read : false })
		.pipe(mocha({
			checkLeaks : true,
			reporter : 'spec',
			ui : 'bdd'
		}));
});
