var gulp = require('gulp');
var runSequence = require('run-sequence');
var conventionalChangelog = require('gulp-conventional-changelog');
var conventionalGithubReleaser = require('conventional-github-releaser');
var bump = require('gulp-bump');
var gutil = require('gulp-util');
var git = require('gulp-git');
var fs = require('fs');
var jsdoc = require('gulp-jsdoc3');

var clean = require('gulp-clean');
var size = require('gulp-size');
var manifest = require('gulp-manifest');
var replace = require('gulp-replace');
var header = require('gulp-header');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');

var package = require('./package.json');
var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @license <%= pkg.license %>',
  ' * @author <%= pkg.author %>',
  ' */',
  ''].join('\n');


//https://github.com/gulpjs/gulp/blob/master/docs/recipes/automate-release-workflow.md
function getPackageJsonVersion() {
  // We parse the json file instead of using require because require caches
  // multiple calls so the version number won't be updated
  return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version;
}
function getPackageJsonName() {
  // We parse the json file instead of using require because require caches
  // multiple calls so the version number won't be updated
  return JSON.parse(fs.readFileSync('./package.json', 'utf8')).name;
}

var pass = require('./secrets.json');

/**
 * Clean all distribuion path
 */
gulp.task('clean', function () {
  return gulp.src(['.tmp', './dist', './site/docs'], { read: false })
    .pipe(clean())
    .pipe(size({ title: 'clean'}));
});


/**
 * Create a distribuition files
 */
gulp.task('dist', function () {
  return gulp.src(['./src/*.js'], { dot: true })
    .pipe(concat('async-http.js'))
    .pipe(replace("@@version", getPackageJsonVersion()))
    .pipe(header(banner, { pkg: package }))
    .pipe(gulp.dest('./dist'))
    .pipe(size({ showFiles: true }))
    .pipe(rename('async-http.min.js'))
    .pipe(uglify({ preserveComments: 'some' }))
    .pipe(gulp.dest('./dist'))
    .pipe(size({ showFiles: true }));
});

/**
 * Generate a changelog
 */
gulp.task('changelog', function () {
  return gulp.src('CHANGELOG.md', {
    read: false
  })
    .pipe(conventionalChangelog({
      // conventional-changelog options go here 
      preset: 'angular'
    }, {
        // context goes here
      }, {
        // git-raw-commits options go here
      }, {
        // conventional-commits-parser options go here
      }, {
        // conventional-changelog-writer options go here
      }))
    .pipe(gulp.dest('./'));
});

/**
 * Generate a github release
 */
gulp.task('github-release', function (done) {
  conventionalGithubReleaser({
    type: "oauth",
    token: pass.github
  }, {
      preset: 'angular' // Or to any other commit message convention you use.
    }, done);
});

/**
 * Bump version
 */
gulp.task('bump-version', function () {
  // We hardcode the version change type to 'patch' but it may be a good idea to
  // use minimist (https://www.npmjs.com/package/minimist) to determine with a
  // command argument whether you are doing a 'major', 'minor' or a 'patch' change.
  //major: 1.0.0 | minor: 0.1.0 | patch: 0.0.2 | prerelease: 0.0.1-2
  return gulp.src(['./bower.json', './package.json', './src/site/manifest.webapp', './src/site/manifest.json'])    
    .pipe(bump({ type: "patch" }).on('error', gutil.log))
    .pipe(gulp.dest('./'));
});

/**
 * Commit changes local
 */
gulp.task('commit-changes', function () {
  return gulp.src('.')
    .pipe(git.add())
    .pipe(git.commit('Inital release'));
});

/**
 * Push changes to github
 */
gulp.task('push-changes', function (cb) {
  git.push('origin', 'master', cb);
});

/**
 * Create a new tag 
 */
gulp.task('create-new-tag', function (cb) {
  var version = getPackageJsonVersion();
  git.tag(version, 'Created Tag for version: ' + version, function (error) {
    if (error) {
      return cb(error);
    }
    git.push('origin', 'master', { args: '--tags' }, cb);
  });
});

/**
 * Generating a pretty HTML documentation site
 */
gulp.task('generate-docs', function (cb) {
  var config = require('./jsdoc.json');
  gulp.src(['./*.md', './src/**/*.js'], { read: false })
    .pipe(jsdoc(config, cb));
});

gulp.task('build', function (callback) {
  runSequence(
    'clean',
    'generate-docs',
    'dist',
    function (error) {
      if (error) {
        console.log('Build error: ' + error.message);
      } else {
        console.log('Buil complete');
      }
      callback(error);
    }
  );
});

/**
 * Release a new version
 */
gulp.task('release', function (callback) {
  runSequence(
    'bump-version',
    'build',
    'changelog',
    'commit-changes',
    'push-changes',
    'create-new-tag',
    'github-release',
    function (error) {
      if (error) {
        console.log(error.message);
      } else {
        console.log('RELEASE FINISHED SUCCESSFULLY');
      }
      callback(error);
    });
});
