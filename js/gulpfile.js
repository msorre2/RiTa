// NEXT:
// gulp tests
// gulp tests --nolex (a few tests still fail without lexicon)
// gulp test --name=RiString -nolex
//
// npm: gulp test
//
// npm: test & publish
//

/**
 * USAGE:
 * 	gulp (build | lint | watch | clean | help)
 *  gulp test        # test all without loading RiLexicon
 *  gulp test.full     # test all
 *  gulp test --name RiString  # test one
 *  gulp test --name RiLexicon # test one
 */

var del = require('del'),
  gulp = require('gulp'),
  gulpif = require('gulp-if')
  argv = require('yargs').argv,
  concat = require('gulp-concat'),
  size = require('gulp-size'),
  uglify = require('gulp-uglify'),
  replace = require('gulp-replace'),
  jshint = require('gulp-jshint'),
  tasks = require('gulp-task-listing'),
  sourcemaps = require('gulp-sourcemaps'),
  pjson = require('./package.json'),
  rename = require('gulp-rename'),
  exec = require('child_process').exec,
  version = pjson.version;

var testDir = 'test',
  destDir = 'dist',
  nodeDir = destDir+'/node/rita',
  tmpDir = '/tmp',
  srcDir = 'src',
  output = 'rita',
  testFile = 'rita',
  minimize = false,
  sourceMaps = false;

// do npm pack on whatever is already in the dist dir
gulp.task('npm.build', ['setup-npm'], function(done) {
  exec('cd '+destDir+' && npm pack ../'+nodeDir, function (err, stdout, stderr) {
    log("Packing "+nodeDir+'/'+stdout);
    stderr && console.error(stderr);
    done(err);
  });
});

// build everything, then do npm pack
gulp.task('make.lib', ['build.full'], function(done) {
  gulp.start('npm.build');
});

function npmpack(done) {
  exec('cd '+destDir+' && npm pack ../'+nodeDir, function (err, stdout, stderr) {
    log("Packing "+nodeDir+'/'+stdout);
    stderr && console.error(stderr);
    done(err);
  });
}

gulp.task('setup-npm', [ 'clean-node' ], function(done) {

  //console.log(getTests(),testFiles());
  // copy in the node readme
  gulp.src('../README.node.md')
    .pipe(rename('README.md'))
    .pipe(gulp.dest(nodeDir));

  // copy in other loose files
  gulp.src(['../LICENSE', './package.json', './gulpfile.js'])
    .pipe(gulp.dest(nodeDir));

  // copy in the tests
  gulp.src(testFiles())
    .pipe(gulp.dest(nodeDir + '/test'));

  // copy in the code
  gulp.src(destDir + '/rita-full.min.js')
    .pipe(rename('rita.js'))
    .pipe(gulp.dest(nodeDir + '/lib'));

  done();
});

// list all the defined tasks
gulp.task('help', tasks);

// clean out the build-dir
gulp.task('clean', function(f) { del(destDir, f); });

gulp.task('clean-node', function(f) { del(nodeDir, f); });

// run lint on the non-uglified output (no lexicon)
gulp.task('lint', ['build'], function() {

  log('Linting '+destDir+'/rita.js');

  return gulp.src(destDir+'/rita.js')
    .pipe(jshint({ expr: 1, laxbreak: 1 }))
    .pipe(jshint.reporter('default'));
});

// run lint on the non-uglified output (with lexicon)
gulp.task('lint.full', ['build'], function() {

  log('Linting '+destDir+'/rita-full.js');

  return gulp.src(destDir+'/rita-full.js')
    .pipe(jshint({ expr: 1, laxbreak: 1 }))
    .pipe(jshint.reporter('default'));
});

// watch the src-dir for changes, then build
gulp.task('watch.full', function() {

  log('Watching ' + srcDir + '/*.js');
  gulp.watch(srcDir + '/*.js', [ 'build.full' ]);
});

gulp.task('watch', function() {

  log('Watching ' + srcDir + '/*.js');
  gulp.watch(srcDir + '/*.js', [ 'build' ]);
});

// concatenate sources to 'dist' folder
gulp.task('build-lex', ['clean'], function() {

  return gulp.src(sourceFiles(true))
    .pipe(replace('##version##', version))
    .pipe(concat(output+'-full.js'))
    .pipe(size({showFiles:true}))
    .pipe(gulp.dest(destDir));
});

gulp.task('build-nolex', ['clean'], function() {

  return gulp.src(sourceFiles(false))
    .pipe(replace('##version##', version))
    .pipe(concat(output+'.js'))
    .pipe(size({showFiles:true}))
    .pipe(gulp.dest(destDir));
});

// concatenate/minify sources to 'dist' folder
gulp.task('build-minify-lex', ['build-lex'], function() {

  return gulp.src(destDir+'/'+output+'-full.js')
    .pipe(gulpif(sourceMaps, sourcemaps.init()))
    .pipe(uglify())
    .pipe(gulpif(sourceMaps, sourcemaps.write('./')))
    .pipe(rename(output+'-full.min.js'))
    .pipe(size({showFiles:true}))
    .pipe(gulp.dest(destDir));
});

// concatenate/minify sources to 'dist' folder
gulp.task('build-minify-nolex', ['build-nolex'], function() {

  return gulp.src(destDir+'/'+output+'.js')
    .pipe(gulpif(sourceMaps, sourcemaps.init()))
    .pipe(uglify())
    .pipe(gulpif(sourceMaps, sourcemaps.write('./')))
    .pipe(rename(output+'.min.js'))
    .pipe(size({showFiles:true}))
    .pipe(gulp.dest(destDir));
});

// runs tests without loading lexicon
// usage: gulp test
//        gulp test --name RiString
gulp.task('test', ['build'], function() {
  return gulp.start('test-only');
});

// runs tests with lexicon loaded
gulp.task('test.full', function (done) {

  testFile = 'rita-full';
  return gulp.start('test');
});

// runs tests without building first
gulp.task('test-only', function (done) {

  var testrunner = require("qunit"),
    tests = testFiles();

  if (argv.name) {
    if (argv.name === 'RiLexicon')
      testFile = 'rita-full'
    tests = [ testDir + '/' + argv.name + '-tests.js' ];
    log('Testing: ' + tests[0]);
  }

  testrunner.setup({
    maxBlockDuration: 50000,
    coverage: true,
    log: {
      globalSummary: true,
      errors: true
    }
  });

  var testSrc = destDir + '/' + testFile + '.js';
  log('Source: ' + testSrc);

  testrunner.run({
      deps: [ testDir + '/qunit-helpers.js' ],
      code: testSrc,
      tests: tests
    },
    function (err, report) {
      if (err) {
        done(err);
        done(report);
      }
      testFile = 'rita'
      done();
    });
});

// Helper functions --------------------------------------

function testFiles(includeLex) {

  var tests = [
    testDir + '/LibStructure-tests.js',
    testDir + '/RiTaEvent-tests.js',
    testDir + '/RiString-tests.js',
    testDir + '/RiTa-tests.js',
    testDir + '/RiGrammar-tests.js',
    testDir + '/RiMarkov-tests.js',
    testDir + '/UrlLoading-tests.js',
    testDir + '/RiLexicon-tests.js'
  ];

  return tests;
}

function sourceFiles(includeLex) {

  var src = [ srcDir + '/header.js', srcDir + '/rita.js' ];

  if (includeLex) {
    src.push(srcDir + '/rita_lts.js');
    src.push(srcDir + '/rita_dict.js');
    src.push(srcDir + '/rilexicon.js');
  }

  src.push(srcDir + '/footer.js');

  return src;
}

function log(msg) { console.log('[INFO] '+ msg); }

// ----------------------------------------------------

// task composition
gulp.task('build', ['build-nolex', 'build-lex']);
gulp.task('build.full', [ 'build', 'build-minify' ]);
gulp.task('build-minify', ['build-minify-nolex', 'build-minify-lex']);

// help is the default task
gulp.task('default', ['help']);