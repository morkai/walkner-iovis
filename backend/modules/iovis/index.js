// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-xiconf project <http://lukasz.walukiewicz.eu/p/walkner-xiconf>

'use strict';

var _ = require('lodash');
var coap = require('h5.coap');

exports.DEFAULT_CONFIG = {
  sioId: 'sio'
};

exports.start = function startIovisModule(app, module)
{
  var client = new coap.Client({
    socket4: true,
    socket6: true,
    maxRetransmit: 1,
    ackTimeout: 150
  });

  client.on('error', prettyEvent('client', 'error'));
  client.on('transaction timeout', function(req)
  {
    console.log('[client#transaction timeout]');
    console.log(req.toPrettyString());
  });
  client.on('exchange timeout', function(req)
  {
    console.log('[client#exchange timeout]');
    console.log(req.toPrettyString());
  });
  client.on('message sent', function(message, retries)
  {
    console.log('[client#message sent]');

    if (retries > 0)
    {
      console.log(
        'Retransmission of %s (%d of %d)',
        message.getTransactionKey(),
        retries,
        client.maxRetransmit || 4
      );
    }
    else
    {
      console.log(message.toPrettyString());
    }
  });
  client.on('message received', function(message)
  {
    console.log('[client#message received]');
    console.log(message.toPrettyString());
  });

  app.onModuleReady(module.config.sioId, function()
  {
    app[module.config.sioId].on('connection', function(socket)
    {
      socket.on('request', handleRequestMessage);
    });
  });

  function prettyEvent(eventSource, eventName)
  {
    return function()
    {
      console.log('[%s#%s]', eventSource, eventName);

      if (arguments.length > 0)
      {
        console.log('%s', arguments[0].toString());
      }
    };
  }

  function handleRequestMessage(req, options, done)
  {
    if (_.isFunction(options))
    {
      done = options;
      options = {};
    }

    if (!_.isFunction(done))
    {
      return;
    }

    var complete = _.once(done);

    try
    {
      req = coap.Message.fromObject(req);
    }
    catch (err)
    {
      return complete(err);
    }

    req.on('error', complete);
    req.on('timeout', function() { complete(new Error('Timeout.')); });
    req.on('response', function(res)
    {
      complete(null, {
        code: res.getCodeDefinition().name,
        payload: res.getPayload().toString()
      });
    });

    client.request(req, options);
  }
};
