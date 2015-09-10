'use strict';

exports.id = 'walkner-iovis';

exports.modules = [
  'iovis',
  'express',
  'httpServer',
  'sio'
];

exports.httpServer = {
  host: '0.0.0.0',
  port: 1337
};

exports.express = {
  mongooseId: null,
  staticPath: __dirname + '/../frontend',
  staticBuildPath: __dirname + '/../frontend-build',
  cookieSecret: null,
  ejsAmdHelpers: {},
  title: exports.id
};

exports.iovis = {

};
