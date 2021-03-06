// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-xiconf project <http://lukasz.walukiewicz.eu/p/walkner-xiconf>

'use strict';

var startTime = Date.now();

if (!process.env.NODE_ENV)
{
  process.env.NODE_ENV = 'development';
}

require('./extensions');

var fs = require('fs');
var requireCache = require('./requireCache');

if (process.env.NODE_ENV === 'production')
{
  requireCache.path = __dirname + '/../require-cache.json';

  try
  {
    requireCache.cache = JSON.parse(fs.readFileSync(requireCache.path, 'utf8'));
    requireCache.use();
  }
  catch (err)
  {
    requireCache.built = true;
    requireCache.build();
  }
}

var _ = require('lodash');
var main = require('h5.main');
var config = require(process.argv[2]);

var modules = (config.modules || []).map(function(module)
{
  if (typeof module === 'string')
  {
    module = {id: module};
  }

  if (typeof module !== 'object' || module === null)
  {
    console.error("Invalid module:", module);
    process.exit(1);
  }

  if (typeof module.id !== 'string')
  {
    console.error("Module ID is required:", module);
    process.exit(1);
  }

  if (typeof module.name !== 'string')
  {
    module.name = module.id;
  }

  if (typeof module.path !== 'string')
  {
    module.path = './modules/' + module.id;
  }

  module.config = config[module.name];

  return module;
});

var app = {
  options: _.merge({}, config, {
    version: require('../package.json').version,
    startTime: startTime,
    env: process.env.NODE_ENV,
    rootPath: __dirname,
    moduleStartTimeout: process.env.NODE_ENV === 'production' ? 10000 : 3000
  }),
  exit: function(code, err)
  {
    app.error(err.message);

    if (app.options.env !== 'production' || code !== 'MODULE_START_FAILURE' || !/port.*?already/.test(err.message))
    {
      process.exit(1);
    }
  }
};

main(app, modules);

app.broker.subscribe('app.started').setLimit(1).on('message', function()
{
  if (requireCache.built)
  {
    requireCache.save();
  }
});
