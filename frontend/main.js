var address = '';
var config = {};
var requestGroupId = 0;
var readRequestsTodo = 0;
var readRequestsDone = 0;
var requestSentCounter = 0;
var requestSuccessCounter = 0;
var requestFailureCounter = 0;
var socket = io({
  transports: ['websocket'],
  timeout: 10000,
  reconnectionDelay: 500,
  autoConnect: true
});

var READ_RESPONSE_HANDLERS = {
  in: handleReadInputResponse,
  out: handleReadOutputResponse,
  anal: handleReadAnalogResponse
};

$(function()
{
  $('#config-address').on('change', function(e)
  {
    updateAddress(e.target.value);
    reset();
  });

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

  $('#analogs').on('change', '.form-control', function(e)
  {
    setAnalog(config[$(e.currentTarget).closest('.analog')[0].dataset.id], e.currentTarget.value);
  });

  $('#analogs').on('keyup', '.form-control', function(e)
  {
    if (e.keyCode === 13)
    {
      setAnalog(config[$(e.currentTarget).closest('.analog')[0].dataset.id], e.currentTarget.value);
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
  var height = window.innerHeight - 110 - 54 - 20 - 53 - 15 - 53 - 15 - 30;

  $('#config-input').css('height', height + 'px');
}

function updateAddress(newAddress)
{
  newAddress = newAddress.trim();

  localStorage.ADDRESS = newAddress;

  $('#config-address').val(newAddress);

  if (newAddress.indexOf('.') === -1)
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

  var re = /([A-Z0-9_]+)\s+([0-9]+)\s+([0-9]+)\s+(in|out|anal)/ig;
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
    analogs: []
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

      console.error('Error reading %s: %s', io.name, err.message);
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

  $output.toggleClass('active', io.value === true);
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

function toggleOutput(io)
{
  if (io.writing)
  {
    return;
  }

  io.writing = true;

  var $output = $('.output[data-id="' + io.name + '"]');

  $output.removeClass('btn-default').addClass('btn-warning');

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

    $output.removeClass('btn-warning').addClass('btn-default');

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

      $output.toggleClass('active', io.value);
    }

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
