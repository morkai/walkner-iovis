// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-xiconf project <http://lukasz.walukiewicz.eu/p/walkner-xiconf>

'use strict';

var lodash = require('lodash');
var rql = null;

try
{
  rql = require('h5.rql');
}
catch (err) {}

module.exports = function createRqlMiddleware()
{
  return function rqlMiddleware(req, res, next)
  {
    if (rql === null)
    {
      req.rql = {};

      return next();
    }

    var rqlQuery = null;

    Object.defineProperty(req, 'rql', {
      configurable: false,
      enumerable: false,
      get: function()
      {
        if (rqlQuery === null)
        {
          rqlQuery = rql.parse(getQueryString(req));
        }

        return rqlQuery;
      }
    });

    return next();
  };
};

function getQueryString(req)
{
  if (lodash.isObject(req._parsedUrl) && lodash.isString(req._parsedUrl.query))
  {
    return req._parsedUrl.query;
  }

  if (lodash.isString(req.url))
  {
    var queryPos = req.url.indexOf('?');

    if (queryPos !== -1)
    {
      return req.url.substr(queryPos + 1);
    }
  }

  return '';
}
