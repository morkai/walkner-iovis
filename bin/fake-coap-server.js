'use strict';

var url = require('url');
var coap = require('coap');

var server = coap.createServer();

var state = {};

setTimeout(updateState, 1000);

function updateState()
{
  Object.keys(state).forEach(function(key)
  {
    if (state[key].type === 'in')
    {
      state[key].value = Math.random() > 0.6 ? 'OFF' : 'ON';
    }
  });

  setTimeout(updateState, 100 + Math.round(Math.random() * 2000));
}

function getState(tim, channel, type)
{
  var key = tim + ':' + channel;

  if (state[key] !== undefined)
  {
    return state[key].value;
  }

  var value;

  switch (type)
  {
    case 'in':
    case 'out':
      value = 'OFF';
      break;

    case 'func':
      value = '';
      break;

    default:
      value = 0;
      break;
  }

  state[key] = {
    type: type,
    value: value
  };

  return value;
}

function setState(tim, channel, type, payload)
{
  var key = tim + ':' + channel;
  var newValue = payload.toString();

  switch (type)
  {
    case 'out':
      newValue = (payload.length === 1 && payload[0] === 1) || newValue === '1'  || newValue.toUpperCase() === 'ON'
        ? 'ON' : 'OFF';
      break;

    case 'anal':
      newValue = parseInt(newValue, 10);

      if (isNaN(newValue))
      {
        newValue = null;
      }
      break;

    case 'func':
      break;

    default:
      newValue = null;
      break;
  }

  if (newValue === null)
  {
    return false;
  }

  state[key] = {
    type: type,
    value: newValue
  };

  return true;
}

server.on('request', function(req, res)
{
  var urlParts = url.parse(req.url, true);
  var tim = parseInt(urlParts.query.tim, 10);
  var channel = parseInt(urlParts.query.ch, 10);
  var type = urlParts.query.t;

  switch (urlParts.pathname)
  {
    case '/io/RD':
      if (isNaN(tim) || isNaN(channel))
      {
        res.statusCode = 400;
        res.end('666');

        return;
      }

      res.end([0, tim, channel, getState(tim, channel, type)].join('\n'));
      break;

    case '/io/WD':
      if (isNaN(tim)
        || isNaN(channel)
        || type === 'in'
        || !setState(tim, channel, type, urlParts.query.tD || req.payload))
      {
        res.statusCode = 400;
        res.end('400');

        return;
      }

      res.end([0, tim, channel].join('\n'));
      break;

    default:
      res.statusCode = 404;
      res.end('404');
      break;
  }
});

server.listen();
