'use strict';

const fs = require('fs');
const os = require('os');
const expect = require('chai').expect;
const path = require('path');
const Babel = require('../');
const helpers = require('broccoli-test-helpers');
const makeTestHelper = helpers.makeTestHelper;
const cleanupBuilders = helpers.cleanupBuilders;
const RSVP = require('rsvp');
const Promise = RSVP.Promise;
const moduleResolve = require(fixtureFullPath('amd-name-resolver-parallel')).moduleResolve;
const terminateWorkerPool = require('./utils/terminate-workers');

const inputPath = path.join(__dirname, 'fixtures');
const expectations = path.join(__dirname, 'expectations');

let ParallelApi = require('../lib/parallel-api');

moduleResolve.baseDir = () => `${__dirname}/..`;

function moduleResolveParallel() { }

moduleResolveParallel._parallelBabel = {
  requireFile: fixtureFullPath('amd-name-resolver-parallel'),
  useMethod: 'moduleResolve',
};

function getModuleIdParallel () { }

getModuleIdParallel._parallelBabel = {
  requireFile: fixtureFullPath('get-module-id-parallel'),
  buildUsing: 'build',
  params: { name: 'testModule' },
};

function shouldPrintCommentParallel () { }

shouldPrintCommentParallel._parallelBabel = {
  requireFile: fixtureFullPath('print-comment-parallel'),
  buildUsing: 'buildMe',
  params: { contents: 'comment 1' },
};

let babel;

function fixtureFullPath(filename) {
  return path.join(__dirname, 'fixtures', filename);
}

describe('options', function() {
  let options;
  this.timeout(10000);

  before(function() {
    options = {
      babel: {
        foo: 1,
        bar: {
          baz: 1
        },
      },
      filterExtensions: ['es6'],
      targetExtension: 'js'
    };

    babel = new Babel('foo', options);
  });

  afterEach(function() {
    delete process.env.THROW_UNLESS_PARALLELIZABLE;
  });

  describe('humanizePlugin', function() {
    const humanizePlugin = ParallelApi.humanizePlugin;

    it('works', function() {
      expect(humanizePlugin({})).to.eql('name: unknown, location: unknown');
      expect(humanizePlugin({ name: '' })).to.eql('name: unknown, location: unknown');
      expect(humanizePlugin({ name: false })).to.eql('name: unknown, location: unknown');
      expect(humanizePlugin({ name: true })).to.eql('name: unknown, location: unknown');
      expect(humanizePlugin({ name: 'foo' })).to.eql('name: foo, location: unknown');
      expect(humanizePlugin({ name: 'foo', baseDir() { return '/a/b/c/'; } })).to.eql('name: foo, location: /a/b/c/');
      expect(humanizePlugin(function Foo() { })).to.eql('name: Foo, location: unknown');
      function Bar() { }
      Bar.baseDir = function() { return 'orange'; };
      expect(humanizePlugin(Bar)).to.eql('name: Bar, location: orange');
      expect(humanizePlugin(() => {})).to.eql('name: unknown, location: unknown,\n↓ function source ↓ \n() => {}\n \n');
      expect(humanizePlugin([function Apple() {}])).to.eql('name: Apple, location: unknown');
      expect(humanizePlugin([Bar])).to.eql('name: Bar, location: orange');
    });
  });

  describe('throwUnlessParallelizable', function() {
    const EXPECTED_PARALLEL_ERROR = /\[Babel\] was configured to `throwUnlessParallelizable` and was unable to parallelize a plugin/;

    it('should throw if throwUnlessParallelizable: true, and one or more plugins could not be parallelized', function() {
      const options = {
        babel: {
          plugins: [function() { }],
        },
        throwUnlessParallelizable: true,
      };

      expect(() => new Babel('foo', options)).to.throw(EXPECTED_PARALLEL_ERROR);
    });

    it('should NOT throw if throwUnlessParallelizable: true, and all plugins can be parallelized', function() {
      const options = {
        babel: {
          plugins: [ { foo: 1 }],
        },
        throwUnlessParallelizable: true,
      };

      expect(() => new Babel('foo', options)).to.not.throw();
    });

    it('should throw if throwUnlessParallelizable: true, and one or more plugins could not be parallelized', function() {
      process.env.THROW_UNLESS_PARALLELIZABLE = true;
      const options = {
        babel: {
          plugins: [function() { }],
        },
      };

      expect(() => new Babel('foo', options)).to.throw(EXPECTED_PARALLEL_ERROR);
    });

    it('should NOT throw if throwUnlessParallelizable: true, and all plugins can be parallelized', function() {
      process.env.THROW_UNLESS_PARALLELIZABLE = true;
      const options = {
        babel: {
          plugins: [ { foo: 1 }],
        },
        throwUnlessParallelizable: true,
      };

      expect(() => new Babel('foo', options)).to.not.throw(EXPECTED_PARALLEL_ERROR);
    });

    it('should NOT throw if throwUnlessParallelizable: false, and one or more plugins could not be parallelized', function() {
      const options = {
        babel: {
          plugins: [function() { }],
        },
        throwUnlessParallelizable: false,
      };

      expect(() => new Babel('foo', options)).to.not.throw();
    });

    it('should NOT throw if throwUnlessParallelizable: true, and plugin annotates how to serialize', function() {
      function Foo() {

      }

      Foo._parallelBabel = {
        requireFile: '/someFile'
      };

      const options = {
        throwUnlessParallelizable: true,
        babel: {
          plugins: [
            Foo,
            [Foo, { arg: 1 }]
          ],
        }
      };

      expect(() => new Babel('foo', options)).to.not.throw();
    });
    it('should NOT throw if throwUnlessParallelizable is unset, and one or more plugins could not be parallelized', function() {
      expect(() => {
        return new Babel('foo', {
          babel: {
            plugins: [function() {}]
          },
          throwUnlessParallelizable: undefined
        })}).to.not.throw();
      expect(() => {
        return new Babel('foo', {
          babel: {
            plugins: [function() {}]
          }
        })}).to.not.throw();
    });
  });

  it('are cloned', function() {
    let transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpileroptions.foo).to.eql(1);
    expect(transpileroptions.bar.baz).to.eql(1);

    options.foo = 2;
    options.bar.baz = 2;

    expect(transpileroptions.foo).to.eql(1);
    expect(transpileroptions.bar.baz).to.eql(1);
  });

  it('correct fileName, sourceMapTarget, sourceFileName', function() {
    let transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpileroptions.moduleId).to.eql(undefined);
    expect(transpileroptions.filename).to.eql('relativePath');
    expect(transpileroptions.sourceFileName).to.eql('relativePath');
  });

  it('includes moduleId if options.moduleId is true', function() {
    babel.options.moduleId = true;
    babel.options.filename = 'relativePath.es6';

    let transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpileroptions.moduleId).to.eql('relativePath');
  });

  it('does not propagate filterExtensions', function () {
    let transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.filterExtensions).to.eql(undefined);
  });

  it('does not propagate targetExtension', function () {
    let transpilerOptions;

    babel.transform = function(string, options) {
      transpilerOptions = options;
      return Promise.resolve({ code: {} });
    };

    expect(transpilerOptions).to.eql(undefined);
    babel.processString('path', 'relativePath');

    expect(transpilerOptions.targetExtension).to.eql(undefined);
  });
});

describe('transpile ES6 to ES5', function() {
  this.timeout(5*1000); // some of these are slow in CI

  before(function() {
    babel = makeTestHelper({
      subject() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders()
      .then(terminateWorkerPool);
  });

  it('basic', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic - parallel API', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          {
            _parallelBabel: {
              requireFile: fixtureFullPath('transform-strict-mode-parallel'),
            }
          },
          {
            _parallelBabel: {
              requireFile: fixtureFullPath('transform-block-scoping-parallel'),
              buildUsing: 'build',
            }
          }
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic - parallel API (in main process)', function () {
    let pluginFunction = require('@babel/plugin-transform-block-scoping').default;
    pluginFunction.baseDir = function() {
      return path.join(__dirname, '../node_modules', '@babel/plugin-transform-block-scoping');
    };
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          {
            _parallelBabel: {
              requireFile: fixtureFullPath('transform-strict-mode-parallel'),
            }
          },
          pluginFunction,
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('basic (in main process)', function () {
    let pluginFunction = require('@babel/plugin-transform-strict-mode').default;
    pluginFunction.baseDir = function() {
      return path.join(__dirname, '../node_modules', '@babel/plugin-transform-strict-mode');
    };
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        // cannot parallelize if any of the plugins are functions
        plugins: [
          pluginFunction,
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('inline source maps', function () {
    return babel('files', {
      babel: {
        sourceMap: 'inline',
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected-inline-source-maps.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('modules (in main process)', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping',
          ['module-resolver', { resolvePath: moduleResolve }],
        ],
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'imports.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('modules - parallel API', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping',
          ['module-resolver', { resolvePath: moduleResolve }],
        ],
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'imports.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('module IDs (in main process)', function () {
    return babel('files', {
      babel: {
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-modules-amd'
        ],
        moduleIds: true,
        getModuleId() { return 'testModule'; },
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'imports-getModuleId.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('module IDs - parallel API', function () {
    return babel('files', {
      babel: {
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-modules-amd'
        ],
        moduleIds: true,
        getModuleId: getModuleIdParallel,
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures-imports.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'imports-getModuleId.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('shouldPrintComment (in main process)', function () {
    return babel('files', {
      babel: {
        shouldPrintComment(comment) { return comment === 'comment 1'; },
      }
    }).then(results => {
      let outputPath = results.directory;
      let output = fs.readFileSync(path.join(outputPath, 'fixtures-comments.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'comments.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  it('shouldPrintComment - parallel API', function () {
    return babel('files', {
      babel: {
        shouldPrintComment: shouldPrintCommentParallel,
      }
    }).then(results => {
      let outputPath = results.directory;
      let output = fs.readFileSync(path.join(outputPath, 'fixtures-comments.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'comments.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });
});

describe('filters files to transform', function() {
  this.timeout(5 * 1000); // some of these are slow in CI

  before(function() {
    babel = makeTestHelper({
      subject() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders()
      .then(terminateWorkerPool);
  });

  it('default', function () {
    return babel('files', {
      babel: {
        inputSourceMap:false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.be.ok;
    });
  });

  it('uses specified filter', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      },
      filterExtensions: ['es6'],
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'fixtures-es6.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(output).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.not.be.ok;
    });
  });

  it('uses multiple specified filters', function() {
    return babel('files', {
      filterExtensions: ['js', 'es6'],
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let es6ExtOutput = fs.readFileSync(path.join(outputPath, 'fixtures-es6.js'), 'utf8');
      let jsExtOutput = fs.readFileSync(path.join(outputPath, 'fixtures.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'expected.js'), 'utf8');

      expect(es6ExtOutput).to.eql(input);
      expect(jsExtOutput).to.eql(input);
      // Verify that .es6 file was not transformed
      expect(fs.existsSync(path.join(outputPath, 'fixtures-es6.es6'))).to.not.be.ok;
    });
  });

  it('named module', function() {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        moduleId: "foo",
        plugins: [
          '@babel/transform-modules-amd',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'named-module-fixture.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'named-module.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });


  it('moduleId === true', function() {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        moduleId: true,
        plugins: [
          '@babel/transform-modules-amd',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(results => {
      let outputPath = results.directory;

      let output = fs.readFileSync(path.join(outputPath, 'true-module-fixture.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'true-module.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });

  // `metadata.usedHelpers` no longer exists in Babel 7...
  it.skip('throws if a single helper is not whitelisted', function() {
    return babel('file', {
      helperWhiteList: ['classCallCheck', 'possibleConstructorReturn'],
      babel: {
        plugins: ['@babel/transform-classes'],
      }
    }).catch(err => {
      console.log(err);
      expect(err.message).to.match(/^fixtures.js was transformed and relies on `inherits`, which was not included in the helper whitelist. Either add this helper to the whitelist or refactor to not be dependent on this runtime helper.$/);
    });
  });

  it.skip('throws if multiple helpers are not whitelisted', function() {
    return babel('file', {
      helperWhiteList: [],
      babel: {
        plugins: ['@babel/transform-classes'],
      }
    }).catch(err => {
      expect(err.message).to.match(/^fixtures.js was transformed and relies on `[a-zA-Z]+`, `[a-zA-Z]+`, & `[a-zA-z]+`, which were not included in the helper whitelist. Either add these helpers to the whitelist or refactor to not be dependent on these runtime helpers.$/);
    });
  });

  it.skip('does not throw if helpers are specified', function() {
    return babel('files', {
      helperWhiteList: ['classCallCheck', 'possibleConstructorReturn', 'inherits'],
      babel: {
        plugins: ['@babel/transform-classes'],
      }
    }).then(results => {
      let outputPath = results.directory;
      let output = fs.readFileSync(path.join(outputPath, 'fixtures-classes.js'), 'utf8');
      let input = fs.readFileSync(path.join(expectations, 'classes.js'), 'utf8');

      expect(output).to.eql(input);
    });
  });
});

describe('when options change', function() {
  let originalHash, options, fakeConsole, consoleMessages;

  beforeEach(function() {
    fakeConsole = {
      warn: function(message) { consoleMessages.push(message); }
    };
    consoleMessages = [];

    options = {
      bar: 1,
      baz: function() {},
      console: fakeConsole,
      babel: {
        plugins: []
      }
    };

    let babel = new Babel('foo', options);

    originalHash = babel.optionsHash();
  });

  it('clears cache for added properties', function() {
    options.foo = 1;
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes object plugins cacheKey result in hash', function() {
    options.plugins = [
      { cacheKey: function() { return 'hi!'; }}
    ];
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes function plugins cacheKey result in hash', function() {
    function fakePlugin() {}
    fakePlugin.cacheKey = function() { return 'Hi!'; };

    options.plugins = [
      fakePlugin
    ];
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes string plugins in hash calculation', function() {
    options.plugins = [
      'foo'
    ];
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('includes plugins specified with options in hash calculation when cacheable', function() {
    let pluginOptions = { foo: 'bar' };
    options.plugins = [
      ['foo', pluginOptions]
    ];
    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();
    expect(firstOptions).to.eql(secondOptions);

    pluginOptions.qux = 'huzzah';
    options.console = fakeConsole;
    let third = new Babel('foo', options);
    let thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('invalidates plugins specified with options when not-cacheable', function() {
    function thing() { }
    let pluginOptions = { foo: 'bar', thing: thing };
    options.plugins = [
      ['foo', pluginOptions]
    ];
    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();
    expect(firstOptions).to.not.eql(secondOptions);
  });

  it('plugins specified with options can have functions with `baseDir`', function() {
    let dir = path.join(inputPath, 'plugin-a');
    function thing() { }
    thing.baseDir = function() { return dir; };
    let pluginOptions = { foo: 'bar', thing: thing };
    options.plugins = [
      ['foo', pluginOptions]
    ];

    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();
    expect(firstOptions).to.eql(secondOptions);

    dir = path.join(inputPath, 'plugin-b');
    options.console = fakeConsole;
    let third = new Babel('foo', options);
    let thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('plugins can be objects with `baseDir`', function() {
    let dir = path.join(inputPath, 'plugin-a');
    let pluginObject = { foo: 'foo' };
    pluginObject.baseDir = function() { return dir; };
    options.plugins = [ pluginObject ];

    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();

    expect(firstOptions).to.eql(secondOptions);

    dir = path.join(inputPath, 'plugin-b');
    options.console = fakeConsole;
    let third = new Babel('foo', options);
    let thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('plugins can be objects with `cacheKey`', function() {
    let dir = path.join(inputPath, 'plugin-a');
    let key = 'cacheKey1';
    let pluginObject = { foo: 'foo' };
    pluginObject.baseDir = function() { return dir; };
    pluginObject.cacheKey = function() { return key; };
    options.plugins = [ pluginObject ];

    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();

    expect(firstOptions).to.eql(secondOptions);

    options.console = fakeConsole;
    key = 'cacheKey3';
    let third = new Babel('foo', options);
    let thirdOptions = third.optionsHash();

    expect(firstOptions).to.not.eql(thirdOptions);
  });

  it('a plugins `baseDir` method is used for hash generation', function() {
    let dir = path.join(inputPath, 'plugin-a');

    function plugin() {}
    plugin.baseDir = function() {
      return dir;
    };
    options.plugins = [ plugin ];

    options.console = fakeConsole;
    let first = new Babel('foo', options);
    let firstOptions = first.optionsHash();

    dir = path.join(inputPath, 'plugin-b');
    options.console = fakeConsole;
    let second = new Babel('foo', options);
    let secondOptions = second.optionsHash();

    expect(firstOptions).to.not.eql(secondOptions);
  });

  it('a plugin without a baseDir invalidates the cache every time', function() {
    function plugin() {}
    plugin.toString = function() { return '<derp plugin>'; };
    options.plugins = [ plugin ];

    options.console = fakeConsole;
    let babel1 = new Babel('foo', options);
    options.console = fakeConsole;
    let babel2 = new Babel('foo', options);

    expect(babel1.optionsHash()).to.not.eql(babel2.optionsHash());
    expect(consoleMessages).to.eql([
      'broccoli-babel-transpiler is opting out of caching due to a plugin that does not provide a caching strategy: `<derp plugin>`.',
      'broccoli-babel-transpiler is opting out of caching due to a plugin that does not provide a caching strategy: `<derp plugin>`.'
    ]);
  });

  it('clears cache for updated properties', function() {
    options.bar = 2;
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('clears cache for added methods', function() {
    options.foo = function() {};
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });

  it('clears cache for updated methods', function() {
    options.baz = function() { return 1; };
    options.console = fakeConsole;
    let babelNew = new Babel('foo', options);

    expect(babelNew.optionsHash()).to.not.eql(originalHash);
  });
});

describe('on error', function() {
  this.timeout(5000);

  before(function() {
    babel = makeTestHelper({
      subject: function() {
        return new Babel(arguments[0], arguments[1]);
      },
      fixturePath: inputPath
    });
  });

  afterEach(function () {
    return cleanupBuilders()
      .then(terminateWorkerPool);
  });

  it('returns error from the main process', function () {
    let pluginFunction = require('@babel/plugin-transform-strict-mode').default;
    pluginFunction.baseDir = function() {
      return path.join(__dirname, '../node_modules', '@babel/plugin-transform-strict-mode');
    };
    return babel('errors', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        highlightCode: false,
        plugins: [
          pluginFunction,
          '@babel/transform-block-scoping'
        ]
      }
    }).then(
      function onSuccess(results) {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.match(/fixtures.js: Unexpected token (1:9)\n\n> 1 | const foo;\n    |          \^\n  2 | $/);
      }
    );
  });

  it('returns error from a worker process', function () {
    return babel('errors', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        highlightCode: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      }
    }).then(
      function onSuccess(results) {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.match(/fixtures.js: Unexpected token (1:9)\n\n> 1 | const foo;\n    |          \^\n  2 | $/);
      }
    );
  });

  it('fails if worker process is terminated', function () {
    return babel('files', {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          {
            _parallelBabel: {
              requireFile: fixtureFullPath('transform-strict-mode-process-exit'),
              buildUsing: 'buildMeAFunction',
            }
          },
          '@babel/transform-block-scoping'
        ]
      }
    }).then(
      function onSuccess() {
        expect.fail('', '', 'babel should throw an error');
      },
      function onFailure(err) {
        expect(err.message).to.match(/Worker terminated unexpectedly/i);
      }
    );
  });
});

describe('deserialize()', function() {

  afterEach(function() {
    return terminateWorkerPool();
  });

  it('passes other options through', function () {
    let options = {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
      },
    };
    expect(ParallelApi.deserialize(options)).to.eql({
      inputSourceMap: false,
      sourceMap: false,
    });
  });

  it('builds plugins using the parallel API', function () {
    let options = {
      babel: {
        plugins: [
          {
            _parallelBabel: {
              requireFile: fixtureFullPath('transform-strict-mode-parallel'),
            }
          },
          '@babel/transform-block-scoping'
        ]
      }
    };
    expect(ParallelApi.deserialize(options)).to.eql({
      plugins: [
        '@babel/transform-strict-mode',
        '@babel/transform-block-scoping'
      ]
    });
  });

  it('leaves callback functions alone', function () {
    let moduleNameFunc = function(moduleName) {};
    let commentFunc = function(comment) {};
    let options = {
      babel: {
        resolveModuleSource: moduleResolve,
        getModuleId: moduleNameFunc,
        shouldPrintComment: commentFunc,
      }
    };

    expect(ParallelApi.deserialize(options).resolveModuleSource).to.eql(moduleResolve);
    expect(ParallelApi.deserialize(options).getModuleId).to.eql(moduleNameFunc);
    expect(ParallelApi.deserialize(options).shouldPrintComment).to.eql(commentFunc);
  });

  it('builds getModuleId using the parallel API', function () {
    let options = {
      babel: {
        getModuleId: getModuleIdParallel
      }
    };
    expect(ParallelApi.deserialize(options).getModuleId).to.be.a('function');
  });

  it('builds shouldPrintComment using the parallel API', function () {
    let options = {
      babel: {
        shouldPrintComment: shouldPrintCommentParallel
      }
    };
    expect(ParallelApi.deserialize(options).shouldPrintComment).to.be.a('function');
  });
});

describe('implementsParallelAPI()', function() {
  it('string - no', function () {
    expect(ParallelApi.implementsParallelAPI('transform-es2025')).to.eql(false);
  });

  it('function - no', function () {
    expect(ParallelApi.implementsParallelAPI(function() {})).to.eql(false);
  });

  it('[] - no', function () {
    expect(ParallelApi.implementsParallelAPI([])).to.eql(false);
  });

  it('["plugin-name", { options }] - no', function () {
    expect(ParallelApi.implementsParallelAPI(['plugin-name', {foo: 'bar'}])).to.eql(false);
  });

  it('[{ object }, { options }] - no', function () {
    expect(ParallelApi.implementsParallelAPI([{some: 'object'}, {foo: 'bar'}])).to.eql(false);
  });

  it('{ requireFile: "some/file" } - no', function () {
    expect(ParallelApi.implementsParallelAPI({ requireFile: 'some/file' })).to.eql(false);
  });

  it('{ _parallelBabel: { some: "stuff" } } - no', function () {
    expect(ParallelApi.implementsParallelAPI({ _parallelBabel: { some: 'stuff' } })).to.eql(false);
  });

  it('{ _parallelBabel: { requireFile: "a/file" } } - yes', function () {
    expect(ParallelApi.implementsParallelAPI({ _parallelBabel: { requireFile: 'a/file' } })).to.eql(true);
  });
});

describe('isSerializable()', function() {
  it('string - yes', function () {
    expect(ParallelApi.isSerializable('transform-es2025')).to.eql(true);
  });

  it('function - no', function () {
    expect(ParallelApi.isSerializable(function() {})).to.eql(false);
  });

  it('[] - yes', function () {
    expect(ParallelApi.isSerializable([])).to.eql(true);
  });

  it('[null, "plugin-name", 12, {foo: "bar"}, ["one",2], true, false] - yes', function () {
    let plugin = [null, "plugin-name", 12, {foo: "bar"}, ["one",2], true, false];
    expect(ParallelApi.isSerializable(plugin)).to.eql(true);
  });

  it('["plugin-name", x => x + 1] - no', function () {
    expect(ParallelApi.isSerializable(['plugin-name', x => x + 1])).to.eql(false);
  });

  it('{ _parallelBabel: { requireFile: "a/file" } } - yes', function () {
    function Foo() {

    }

    Foo._parallelBabel = { requireFile: 'a/file' };
    expect(ParallelApi.isSerializable([Foo])).to.eql(true);
  });

  it('[SerializeableFn, SerializeableFn]', function () {
    function Foo() {

    }

    Foo._parallelBabel = { requireFile: 'a/file' };
    expect(ParallelApi.isSerializable([Foo, Foo])).to.eql(true);
  });

  it('[SerializeableFn, NonSerializeableFn]', function () {
    function Foo() {

    }

    Foo._parallelBabel = { requireFile: 'a/file' };
    expect(ParallelApi.isSerializable([Foo, () => {}])).to.eql(false);
  });
});

describe('pluginsAreParallelizable()', function() {
  it('undefined - yes', function () {
    expect(ParallelApi.pluginsAreParallelizable(undefined)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('[] - yes', function () {
    expect(ParallelApi.pluginsAreParallelizable([])).to.eql({ isParallelizable: true, errors: []});
  });

  it('array of plugins that are parllelizable - yes', function () {
    let plugins = [
      'some-plugin',
      'some-other-plugin',
      { _parallelBabel: { requireFile: "a/file" } },
    ];

    expect(ParallelApi.pluginsAreParallelizable(plugins)).to.eql({ isParallelizable: true, errors: []});
  });

  it('one plugin is not parallelizable - no', function () {
    let plugins = [
      'some-plugin',
      'some-other-plugin',
      { requireFile: "another/file", options: {} },
      function() {},
    ];

    expect(ParallelApi.pluginsAreParallelizable(plugins)).to.eql({
      isParallelizable: false,
      errors: [
        `name: unknown, location: unknown,\n↓ function source ↓ \n${function() {}.toString()}\n \n`
      ]
    });
  });
});

describe('callbacksAreParallelizable()', function() {
  it('no callback functions - yes', function () {
    let babelOptions = {
      inputSourceMap: false,
      plugins: [
        'some-plugin',
      ],
    };
    expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: []});
  });

  it('function - no', function () {
    let babelOptions = {
      inputSourceMap: false,
      plugins: [
        'some-plugin'
      ],
      resolveModuleSource: function() {},
    };

    if (babelOptions.resolveModuleSource.name === '') {
      // old nodes don't create a good name here.
      expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: [`name: unknown, location: unknown,\n↓ function source ↓ \nfunction () {}\n \n`] });
    } else {
      expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: [`name: resolveModuleSource, location: unknown`] });
    }
  });

  it('function with correct _parallelBabel property - yes', function () {
    let babelOptions = {
      inputSourceMap: false,
      plugins: [
        {
          _parallelBabel: {
            requireFile: 'a/file'
          }
        },
        'some-plugin'
      ]
    };
    expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('function with correct _parallelBabel property - yes (but with sneaky second function)', function () {
    let someFunc = function() {};
    someFunc._parallelBabel = { requireFile: 'a/file' };
    let babelOptions = {
      inputSourceMap: false,
      plugins: [
        'some-plugin'
      ],
      keyDontMatter: someFunc,
    };

    expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({
      isParallelizable: true,
      errors: [ ]
    });
  });

  it('_parallelBabel set incorrectly - no', function () {
    let someFunc = function() {};
    someFunc._parallelBabel = { no: 'wrong' };
    let babelOptions = {
      inputSourceMap: false,
      plugins: [
        'some-plugin'
      ],
      keyDontMatter: someFunc,
    };

    if (someFunc.name === '') {
      // older nodes don't correctly assign the name
      expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: ['name: unknown, location: unknown,\n↓ function source ↓ \nfunction () {}\n \n']});
    } else {
      expect(ParallelApi.callbacksAreParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: ['name: someFunc, location: unknown']});
    }
  });
});

describe('transformIsParallelizable()', function() {
  it('no plugins or resolveModule - yes', function () {
    let babelOptions = {};
    expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('plugins are parallelizable - yes', function () {
    let babelOptions = {
      plugins: [ 'some-plugin' ],
    };
    expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('resolveModule is parallelizable - yes', function () {
    let babelOptions = {
      plugins: [['module-resolver', { resolvePath: require('amd-name-resolver').moduleResolve }]],
    };
    expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('both are parallelizable - yes', function () {
    let babelOptions = {
      plugins: ['some-plugin', ['module-resolver', { resolvePath: require('amd-name-resolver').moduleResolve }]],
    };
    expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: true, errors: [] });
  });

  it('plugins not parallelizable - no', function () {
    let babelOptions = {
      plugins: [ function() {} ],
    };
    expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({
      isParallelizable: false,
      errors: [ `name: unknown, location: unknown,\n↓ function source ↓ \n${(function() {}.toString())}\n \n`]
    });
  });


  it('resolveModuleSource not parallelizable - no', function () {
    let babelOptions = {
      plugins: [ 'some-plugin' ],
      resolveModuleSource: function() {},
    };

    if (babelOptions.resolveModuleSource.name === '') {
      expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: ['name: unknown, location: unknown,\n↓ function source ↓ \nfunction () {}\n \n']});
    } else {
      expect(ParallelApi.transformIsParallelizable(babelOptions)).to.eql({ isParallelizable: false, errors: ['name: resolveModuleSource, location: unknown'] });
    }
  });
});

describe('serialize()', function() {
  it('empty options', function() {
    expect(ParallelApi.serialize({})).to.eql({});
  });

  it('passes through non-function options', function() {
    let options = {
      babel: {
        inputSourceMap: false,
        plugins: [ 'some-plugin' ],
      }
    };
    expect(ParallelApi.serialize(options)).to.eql(options);
  });

  it('does not crash for null', function() {
    expect(ParallelApi.serialize(null)).to.eql(null);
  });

  it('does not crash for nested null', function() {
    let options = {
      foo: 'bar',
      baz: null,
    };
    expect(ParallelApi.serialize(options)).to.eql(options);
  });

  it('transforms all functions', function() {
    let serialized = ParallelApi.serialize({
      getModuleId: getModuleIdParallel,
      shouldPrintComment: shouldPrintCommentParallel,
    });

    expect(serialized).to.eql({
      getModuleId: {
        _parallelBabel: {
          requireFile: fixtureFullPath('get-module-id-parallel'),
          buildUsing: "build",
          params: {
            name: "testModule"
          }
        }
      },

      shouldPrintComment: {
        _parallelBabel: {
          requireFile: fixtureFullPath('print-comment-parallel'),
          buildUsing: "buildMe",
          params: {
            contents: "comment 1"
          },
        }
      }
    });
  });
});

describe('buildFromParallelApiInfo()', function() {
  it('requireFile', function() {
    let filePath = fixtureFullPath('transform-strict-mode-parallel');
    let builtPlugin = ParallelApi.buildFromParallelApiInfo({ requireFile: filePath });

    expect(builtPlugin).to.eql(require(filePath));
  });

  it('throws error if requireFile path does not exist', function() {
    let filePath = 'some/file/that/does/not/exist';
    try {
      ParallelApi.buildFromParallelApiInfo({ requireFile: filePath });
      expect.fail('', '', 'should have thrown an error');
    }
    catch (err) {
      expect(err.message).to.match(/Cannot find module 'some\/file\/that\/does\/not\/exist'/);
    }
  });

  it('useMethod', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    let builtPlugin = ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, useMethod: 'pluginFunction' });
    expect(builtPlugin).to.eql(require('@babel/plugin-transform-block-scoping'));
  });

  it('throws error if useMethod does not exist', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    try {
      ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, useMethod: 'doesNotExist' });
      expect.fail('', '', 'should have thrown an error');
    }
    catch (err) {
      expect(err.message).to.eql("method 'doesNotExist' does not exist in file " + filePath);
    }
  });

  it('buildUsing, no params', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    let builtPlugin = ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, buildUsing: 'build' });
    expect(builtPlugin).to.eql(require(filePath).build());
  });

  it('buildUsing, with params', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    let builtPlugin = ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, buildUsing: 'buildTwo', params: { text: 'OK' } });
    expect(builtPlugin).to.eql('for-testingOK');
  });

  it('throws error if buildUsing method does not exist', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    try {
      ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, buildUsing: 'doesNotExist' });
      expect.fail('', '', 'should have thrown an error');
    }
    catch (err) {
      expect(err.message).to.eql("'doesNotExist' is not a function in file " + filePath);
    }
  });

  it('useMethod and buildUsing', function() {
    let filePath = fixtureFullPath('transform-block-scoping-parallel');
    let builtPlugin = ParallelApi.buildFromParallelApiInfo({ requireFile: filePath, useMethod: 'pluginFunction', buildUsing: 'buildTwo', params: { text: 'OK' } });
    expect(builtPlugin).to.eql(require('@babel/plugin-transform-block-scoping'));
  });
});

describe('concurrency', function() {
  let PATH = '../lib/parallel-api';
  let parallelApiPath = require.resolve(PATH);

  afterEach(function() {
    delete require.cache[parallelApiPath];
    delete process.env.JOBS;
    ParallelApi = require(PATH);
    return terminateWorkerPool();
  });

  it('sets jobs automatically using detected cpus', function() {
    expect(ParallelApi.jobs).to.equal(os.cpus().length);
  });

  it('sets jobs using environment variable', function() {
    delete require.cache[parallelApiPath];
    process.env.JOBS = '17';
    ParallelApi = require(PATH);
    expect(ParallelApi.jobs).to.equal(17);
  });
});

describe('getBabelVersion()', function() {
  it ('returns the correct version', function() {
    let expectedVersion = require('@babel/core/package.json').version;

    expect(ParallelApi.getBabelVersion()).to.equal(expectedVersion);
  });
});

describe('workerpool', function() {
  const PATH = '../lib/parallel-api';
  let parallelApiPath = require.resolve(PATH);

  let stringToTransform = "const x = 0;";
  let options;

  beforeEach(function() {
    options = {
      babel: {
        inputSourceMap: false,
        sourceMap: false,
        plugins: [
          '@babel/transform-strict-mode',
          '@babel/transform-block-scoping'
        ]
      },
      cacheKey : "cache-key"
    };

  });

  afterEach(function() {
    delete process.env.JOBS;
    return terminateWorkerPool();
  });

  it('should limit to one pool per babel version', function() {
    this.timeout(5*1000);
    delete require.cache[parallelApiPath];
    process.env.JOBS = '2';
    let ParallelApiOne = require(PATH);
    delete require.cache[parallelApiPath];
    let ParallelApiTwo = require(PATH);

    return Promise.all([
      ParallelApiOne.transformString(stringToTransform, options),
      ParallelApiOne.transformString(stringToTransform, options),
      ParallelApiTwo.transformString(stringToTransform, options),
      ParallelApiTwo.transformString(stringToTransform, options),
    ]).then(() => {
      const pool = ParallelApi.getWorkerPool();
      expect(pool).to.eql(ParallelApiTwo.getWorkerPool());
      expect(pool.workers.length).to.eql(2);
    });
  });

  it('if available should use workerThreads', function() {
    this.timeout(5*1000);

    return Promise.all([
      ParallelApi.transformString(stringToTransform, options),
      ParallelApi.transformString(stringToTransform, options),
    ]).then(() => {
      const pool = ParallelApi.getWorkerPool();
      let hasWorkerThreads = false;
      try {
        require('worker_threads');
        hasWorkerThreads = true;
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND') {
          hasWorkerThreads = false;
        } else {
          throw e;
        }
      }

      expect(pool.workers.length).to.eql(2);
      if (hasWorkerThreads) {
        pool.workers.forEach(worker => expect(worker.worker.isWorkerThread).to.eql(true));
      } else {
        pool.workers.forEach(worker => expect(worker.worker.isChildProcess).to.eql(true));
      }
    });
  });
});
