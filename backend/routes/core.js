// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-xiconf project <http://lukasz.walukiewicz.eu/p/walkner-xiconf>

'use strict';

var _ = require('lodash');

module.exports = function startCoreRoutes(app, express)
{
  express.get('/', showIndex);

  express.get('/time', sendTime);

  function showIndex(req, res)
  {
    var local = req.ip === '127.0.0.1';

    res.render('index', {
      appCache: false,
      appData: {
        LOCAL: local,
        APP_VERSION: JSON.stringify(app.options.version),
        TIME: JSON.stringify(Date.now())
      }
    });
  }

  function sendTime(req, res)
  {
    res.send(Date.now().toString());
  }
};
