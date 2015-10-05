var address = '';
var config = {};
var requestGroupId = 0;
var readRequestsTodo = 0;
var readRequestsDone = 0;
var scanRequestsTodo = [0, 0, 0];
var scanRequestsDone = [0, 0, 0];
var scanResults = [];
var requestSentCounter = 0;
var requestSuccessCounter = 0;
var requestFailureCounter = 0;
var requestInProgress = false;
var requestQueue = [];
var socket = io({
  transports: ['websocket'],
  timeout: 10000,
  reconnectionDelay: 500,
  autoConnect: true
});

socket.on('reconnect', function()
{
  window.location.reload();
});

var READ_RESPONSE_HANDLERS = {
  in: handleReadInputResponse,
  out: handleReadOutputResponse,
  anal: handleReadAnalogResponse,
  func: handleReadFunctionResponse
};

$(function()
{
  $('#config-address').on('change', function(e)
  {
    updateAddress(e.target.value);
    reset();
  });

  $('#config-scan').on('click', scan);

  $('#config-file').on('change', function(e)
  {
    var file = e.target.files[0];

    if (!file || !/\.conf/.test(file.name))
    {
      updateInput('');
      reset();

      return;
    }

    var reader = new FileReader();

    reader.onload = function(e)
    {
      updateInput(e.target.result);
      reset();
    };

    reader.readAsText(file);
  });

  $('#config-input').on('change', function(e)
  {
    $('#config-file').val('');
    updateInput(e.target.value);
    reset();
  });

  $('#outputs').on('click', '.output', function(e)
  {
    toggleOutput(config[e.currentTarget.dataset.id]);
  });

  $('#analogs')
    .on('change', '.form-control', function(e)
    {
      setAnalog(config[$(e.currentTarget).closest('.analog')[0].dataset.id], e.currentTarget.value);
    })
    .on('keyup', '.form-control', function(e)
    {
      if (e.keyCode === 13)
      {
        setAnalog(config[$(e.currentTarget).closest('.analog')[0].dataset.id], e.currentTarget.value);
      }
    });

  $('#functions')
    .on('change', '.form-control', function(e)
    {
      setFunction(config[$(e.currentTarget).closest('.function')[0].dataset.id], e.currentTarget.value);
    })
    .on('keyup', '.form-control', function(e)
    {
      if (e.keyCode === 13)
      {
        setFunction(config[$(e.currentTarget).closest('.function')[0].dataset.id], e.currentTarget.value);
      }
    });

  $(window).on('resize', resizeInput);

  resizeInput();
  updateAddress(localStorage.ADDRESS || '');
  updateInput(localStorage.INPUT || '');
  reset();
});

function resizeInput()
{
  var height = window.innerHeight - 90 - 54 - 20 - 53 - 15 - 53 - 15 - 30;

  $('#config-input').css('height', height + 'px');
}

function updateAddress(newAddress)
{
  newAddress = newAddress.trim();

  localStorage.ADDRESS = newAddress;

  $('#config-address').val(newAddress);

  if (newAddress.length && newAddress.indexOf('.') === -1)
  {
    newAddress = '[' + newAddress + ']';
  }

  address = newAddress;
}

function updateInput(newInput)
{
  parseInput(newInput);

  if (!Object.keys(config).length)
  {
    newInput = 'Nieprawidłowy lub pusty plik!';
  }
  else
  {
    localStorage.INPUT = newInput;
  }

  $('#config-input').val(newInput);
}

function parseInput(input)
{
  config = {};

  var re = /([A-Z0-9_-]+)\s+([0-9]+)\s+([0-9]+)\s+(in|out|anal|func)/ig;
  var matches;

  while (matches = re.exec(input))
  {
    var name = matches[1];

    config[name] = {
      type: matches[4],
      name: name,
      tim: parseInt(matches[2], 10),
      channel: parseInt(matches[3], 10),
      writing: false,
      value: null
    };
  }
}

function renderIo()
{
  var html = {
    inputs: [],
    outputs: [],
    analogs: [],
    functions: []
  };

  Object.keys(config).forEach(function(key)
  {
    var io = config[key];

    if (io.type === 'in')
    {
      renderInput(html.inputs, io);
    }
    else if (io.type === 'out')
    {
      renderOutput(html.outputs, io);
    }
    else if (io.type === 'anal')
    {
      renderAnalog(html.analogs, io);
    }
    else if (io.type === 'func')
    {
      renderFunction(html.functions, io);
    }
  });

  Object.keys(html).forEach(function(ioType)
  {
    $('#' + ioType).html(html[ioType].join(''));
  });
}

function renderInput(html, io)
{
  html.push(
    '<span class="input label label-default" data-id="', io.name, '">',
    io.name,
    '</span>'
  );
}

function renderOutput(html, io)
{
  html.push(
    '<button class="output btn btn-default" data-id="', io.name, '">',
    io.name,
    '</button>'
  );
}

function renderAnalog(html, io)
{
  html.push(
    '<div class="analog" data-id="', io.name, '"><div class="input-group"><span class="input-group-addon">',
    io.name,
    '</span><input type="number" class="form-control" min="0" max="65535" step="1"></div></div>'
  );
}

function renderFunction(html, io)
{
  html.push(
    '<div class="function" data-id="', io.name, '"><div class="input-group"><span class="input-group-addon">',
    io.name,
    '</span><input type="text" class="form-control"></div></div>'
  );
}

function reset()
{
  ++requestGroupId;

  Object.keys(config).forEach(function(key)
  {
    config[key].value = null;
  });

  readRequestsDone = 0;
  readRequestsTodo = 0;
  requestSentCounter = 0;
  requestSuccessCounter = 0;
  requestFailureCounter = 0;

  updateRequestCounter();
  renderIo();
  readAll();
}

function updateRequestCounter()
{
  $('#requestCounter-success').text(requestSuccessCounter);
  $('#requestCounter-failure').text(requestFailureCounter);
  $('#requestCounter-sent').text(requestSentCounter);
}

function readAll()
{
  if (readRequestsDone !== readRequestsTodo)
  {
    return;
  }

  if (!address.length)
  {
    return;
  }

  var keys = Object.keys(config);

  readRequestsDone = 0;
  readRequestsTodo = keys.length;

  keys.forEach(function(key)
  {
    read(config[key]);
  });

  requestSentCounter += readRequestsTodo;

  updateRequestCounter();
}

function read(io)
{
  var reqGroupId = requestGroupId;
  var req = {
    type: 'NON',
    code: 'GET',
    uri: 'coap://' + address + '/io/RD?tim=' + io.tim + '&ch=' + io.channel + '&t=' + io.type
  };

  socket.emit('request', req, function(err, res)
  {
    if (requestGroupId !== reqGroupId)
    {
      return;
    }

    ++readRequestsDone;

    if (err)
    {
      ++requestFailureCounter;

      //console.error('Error reading %s: %s', io.name, err.message);
    }
    else if (res.payload.indexOf('0') !== 0)
    {
      ++requestFailureCounter;

      console.error('Error reading %s (%s): %d', io.name, res.code, res.payload.split('\n')[0]);
    }
    else
    {
      ++requestSuccessCounter;

      READ_RESPONSE_HANDLERS[io.type](io, res);
    }

    updateRequestCounter();

    if (readRequestsDone === readRequestsTodo)
    {
      setTimeout(readAll, 333);
    }
  });
}

function handleReadInputResponse(io, res)
{
  var $input = $('.input[data-id="' + io.name + '"]');

  if (!$input.length)
  {
    return;
  }

  $input.removeClass('label-default label-success label-danger');

  io.value = res.payload.indexOf('ON') !== -1
    ? true
    : res.payload.indexOf('OFF') !== -1
      ? false
      : null;

  if (io.value === true)
  {
    $input.addClass('label-success');
  }
  else if (io.value === false)
  {
    $input.addClass('label-danger');
  }
  else
  {
    $input.addClass('label-default');
  }
}

function handleReadOutputResponse(io, res)
{
  if (io.writing)
  {
    return;
  }

  var $output = $('.output[data-id="' + io.name + '"]');

  if (!$output.length)
  {
    return;
  }

  io.value = res.payload.indexOf('ON') !== -1
    ? true
    : res.payload.indexOf('OFF') !== -1
      ? false
    : null;

  $output
    .removeClass('btn-default btn-success btn-danger')
    .addClass(io.value === null ? 'btn-default' : io.value ? 'btn-success' : 'btn-danger');
}

function handleReadAnalogResponse(io, res)
{
  if (io.writing)
  {
    return;
  }

  var $analog = $('.analog[data-id="' + io.name + '"]');
  var $input = $analog.find('.form-control');

  if (!$analog.length || document.activeElement === $input[0])
  {
    return;
  }

  io.value = parseInt(res.payload.split('\n')[3], 10) || 0;

  $input.val(io.value);
}

function handleReadFunctionResponse(io, res)
{
  if (io.writing)
  {
    return;
  }

  var $function = $('.function[data-id="' + io.name + '"]');
  var $input = $function.find('.form-control');

  if (!$function.length || document.activeElement === $input[0])
  {
    return;
  }

  io.value = res.payload.trim().split('\n')[3];

  if (io.value === undefined)
  {
    io.value = '';
  }

  $input.val(io.value);
}

function toggleOutput(io)
{
  if (io.writing)
  {
    return;
  }

  io.writing = true;

  var $output = $('.output[data-id="' + io.name + '"]');

  $output
    .removeClass('btn-default btn-success btn-danger')
    .addClass('btn-warning');

  ++requestSentCounter;

  updateRequestCounter();

  var reqGroupId = requestGroupId;
  var req = {
    type: 'NON',
    code: 'POST',
    uri: 'coap://' + address + '/io/WD?tim=' + io.tim
    + '&ch=' + io.channel
    + '&t=' + io.type
    + '&tD=' + (io.value ? 'OFF' : 'ON')
  };

  socket.emit('request', req, function(err, res)
  {
    if (requestGroupId !== reqGroupId)
    {
      return;
    }

    io.writing = false;

    if (err)
    {
      ++requestFailureCounter;

      console.error('Error writing %s: %s', io.name, err.message);
    }
    else if (res.payload.indexOf('0') !== 0)
    {
      ++requestFailureCounter;

      console.error('Error writing %s (%s): %d', io.name, res.code, res.payload.split('\n')[0]);
    }
    else
    {
      ++requestSuccessCounter;

      io.value = !io.value;
    }

    $output
      .removeClass('btn-warning')
      .addClass(io.value === null ? 'btn-default' : io.value ? 'btn-success' : 'btn-danger');

    updateRequestCounter();
  });
}

function setAnalog(io, value)
{
  value = parseInt(value, 10);

  if (io.writing || isNaN(value) || value < 0 || value > 0xFFFF)
  {
    return;
  }

  io.writing = true;

  var $analog = $('.analog[data-id="' + io.name + '"]');
  var $input = $analog.find('.form-control');

  $analog.addClass('is-writing');
  $input.attr('readonly', true);

  ++requestSentCounter;

  updateRequestCounter();

  var reqGroupId = requestGroupId;
  var req = {
    type: 'NON',
    code: 'POST',
    uri: 'coap://' + address + '/io/WD?tim=' + io.tim
    + '&ch=' + io.channel
    + '&t=' + io.type
    + '&tD=' + value
  };

  socket.emit('request', req, function(err, res)
  {
    if (requestGroupId !== reqGroupId)
    {
      return;
    }

    $analog.removeClass('is-writing');

    io.writing = false;

    if (err)
    {
      ++requestFailureCounter;

      console.error('Error writing %s: %s', io.name, err.message);
    }
    else if (res.payload.indexOf('0') !== 0)
    {
      ++requestFailureCounter;

      console.error('Error writing %s (%s): %d', io.name, res.code, res.payload.split('\n')[0]);
    }
    else
    {
      ++requestSuccessCounter;

      io.value = value;

      $input.val(value).attr('readonly', false);
    }

    updateRequestCounter();
  });
}

function setFunction(io, value)
{
  if (io.writing)
  {
    return;
  }

  io.writing = true;

  var $function = $('.function[data-id="' + io.name + '"]');
  var $input = $function.find('.form-control');

  $function.addClass('is-writing');
  $input.attr('readonly', true);

  ++requestSentCounter;

  updateRequestCounter();

  var reqGroupId = requestGroupId;
  var req = {
    type: 'NON',
    code: 'POST',
    uri: 'coap://' + address + '/io/WD?tim=' + io.tim
    + '&ch=' + io.channel
    + '&t=' + io.type
    + '&tD=' + value
  };

  socket.emit('request', req, function(err, res)
  {
    if (requestGroupId !== reqGroupId)
    {
      return;
    }

    $function.removeClass('is-writing');

    io.writing = false;

    if (err)
    {
      ++requestFailureCounter;

      console.error('Error writing %s: %s', io.name, err.message);
    }
    else if (res.payload.indexOf('0') !== 0)
    {
      ++requestFailureCounter;

      console.error('Error writing %s (%s): %d', io.name, res.code, res.payload.split('\n')[0]);
    }
    else
    {
      ++requestSuccessCounter;

      io.value = value;

      $input.val(value).attr('readonly', false);
    }

    updateRequestCounter();
  });
}

function unlockAfterScan()
{
  scanRequestsDone = [0, 0];
  scanRequestsTodo = [0, 0];
  scanResults = [];

  $('#config').find('.form-control').prop('disabled', false);
}

function scan()
{
  if (!address.length || scanRequestsTodo[0] !== 0)
  {
    return;
  }

  updateInput('');
  reset();
  $('#config').find('.form-control').prop('disabled', true);

  var req = {
    type: 'CON',
    code: 'GET',
    uri: 'coap://' + address + '/io/TDisc'
  };
  var options = {
    exchangeTimeout: 10000,
    transactionTimeout: 1000,
    maxRetransmit: 3,
    blockSize: 64
  };

  updateRequestCounter(++requestSentCounter);

  queueRequest(req, options, function(err, res)
  {
    if (err)
    {
      updateRequestCounter(++requestFailureCounter);
      unlockAfterScan();

      return console.error("Error scanning: %s", err.message);
    }

    updateRequestCounter(++requestSuccessCounter);

    var tims = res.payload.split('\n')[1].split(',');

    scanRequestsDone = [0, 0];
    scanRequestsTodo = [tims.length, 0];
    scanResults = [];

    tims.forEach(function(timId)
    {
      scanTim(parseInt(timId.trim(), 10));
    });
  });
}

function scanTim(timId)
{
  var req = {
    type: 'CON',
    code: 'GET',
    uri: 'coap://' + address + '/io/CDisc?tim=' + timId
  };
  var options = {
    exchangeTimeout: 10000,
    transactionTimeout: 1000,
    maxRetransmit: 3,
    blockSize: 64
  };

  updateRequestCounter(++requestSentCounter);

  queueRequest(req, options, function(err, res)
  {
    if (err)
    {
      updateRequestCounter(++requestFailureCounter);
      unlockAfterScan();

      return console.error("Error scanning TIM %d: %s", timId, err.message);
    }

    updateRequestCounter(++requestSuccessCounter);

    ++scanRequestsDone[0];

    var lines = res.payload.split('\n');
    var channelIds = lines[2].split(',');
    var transducerNames = lines[3].replace(/"/g, '').split(',');

    scanRequestsTodo[1] += channelIds.length;

    channelIds.forEach(function(channelId, i)
    {
      setTimeout(
        scanChannel,
        Math.round(10 + Math.random() * 200),
        timId,
        parseInt(channelId.trim(), 10),
        transducerNames[i]
      );
    });
  });
}

function scanChannel(timId, channelId, transducerName)
{
  var req = {
    type: 'CON',
    code: 'GET',
    uri: 'coap://' + address + '/io/RTeds?tim=' + timId + '&ch=' + channelId + '&TT=4'
  };
  var options = {
    exchangeTimeout: 10000,
    transactionTimeout: 1000,
    maxRetransmit: 3,
    blockSize: 64
  };

  updateRequestCounter(++requestSentCounter);

  queueRequest(req, options, function(err, res)
  {
    if (err)
    {
      updateRequestCounter(++requestFailureCounter);
      unlockAfterScan();

      return console.error("Error scanning channel %d of TIM %d: %s", channelId, timId, err.message);
    }

    updateRequestCounter(++requestSuccessCounter);

    ++scanRequestsDone[1];

    var type = null;

    if (/Digital Input/i.test(res.payload))
    {
      type = 'in';
    }
    else if (/Digital Output/i.test(res.payload))
    {
      type = 'out';
    }
    else if (/(Digit.*?|Analog|Step g) (Input|Output)/i.test(res.payload))
    {
      type = 'anal';
    }

    if (type)
    {
      scanResults.push({
        timId: timId,
        channelId: channelId,
        name: (transducerName || ('T_' + timId + '_' + channelId)).trim(),
        type: type
      });
    }

    if (scanRequestsDone[1] === scanRequestsTodo[1])
    {
      buildInputFromScanResults();
    }
  });
}

function buildInputFromScanResults()
{
  var input = [];

  scanResults.sort(function(a, b)
  {
    var r = a.timId - b.timId;

    if (r === 0)
    {
      r = a.channelId - b.channelId;
    }

    return r;
  });

  scanResults.forEach(function(io)
  {
    input.push(io.name + ' ' + io.timId + ' ' + io.channelId + ' ' + io.type);
  });

  unlockAfterScan();
  updateInput(input.join('\n'));
  renderIo();
  readAll();
}

function queueRequest(req, options, callback)
{
  requestQueue.push(req, options, callback);

  if (!requestInProgress)
  {
    sendNextRequest();
  }
}

function sendNextRequest()
{
  var req = requestQueue.shift();
  var options = requestQueue.shift();
  var callback = requestQueue.shift();

  if (!callback)
  {
    return;
  }

  requestInProgress = true;

  socket.emit('request', req, options, function(err, res)
  {
    requestInProgress = false;

    callback(err, res);

    sendNextRequest();
  });
}
