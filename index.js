'use strict';

var AWS = require('aws-sdk');
var http = require('http');
var httpProxy = require('http-proxy');
var express = require('express');
var bodyParser = require('body-parser');
var stream = require('stream');
var uri = 'https://' + process.env.ENDPOINT;
var region = uri.match(/\.([^.]+)\.es\.amazonaws\.com\.?$/)[1];
var port = 3000;
var address = '127.0.0.1';
var creds;

var chain = new AWS.CredentialProviderChain();
chain.resolve(function (err, resolved) {
  if (err) throw err;
  creds = resolved;
});

function getCreds(req, res, next) {
  return creds.get(next);
}
var proxy = httpProxy.createProxyServer({
  target: uri,
  changeOrigin: true,
  secure: true
});

var app = express();
app.use(bodyParser.raw({type: '*/*'}));
app.use(getCreds);

app.use(function (req, res) {
  var bufferStream;
  if (Buffer.isBuffer(req.body)) {
    bufferStream = new stream.PassThrough();
    bufferStream.end(req.body);
  }
  proxy.web(req, res, { buffer: bufferStream });
});

proxy.on('proxyReq', function (proxyReq, req, res, options) {
  var endpoint = new AWS.Endpoint(uri);
  var request = new AWS.HttpRequest(endpoint);

  request.method = proxyReq.method;
  request.path = proxyReq.path;
  request.region = region;

  if (Buffer.isBuffer(req.body)) request.body = req.body;
  if (!request.headers) request.headers = {};
  request.headers['presigned-expires'] = false;
  request.headers['Host'] = endpoint;

  var signer = new AWS.Signers.V4(request, 'es');
  signer.addAuthorization(creds, new Date());

  proxyReq.setHeader('Host', request.headers['Host']);
  proxyReq.setHeader('X-Amz-Date', request.headers['X-Amz-Date']);
  proxyReq.setHeader('Authorization', request.headers['Authorization']);
  if (request.headers['x-amz-security-token']) proxyReq.setHeader('x-amz-security-token', request.headers['x-amz-security-token']);
});

http.createServer(app).listen(port, address);
console.log('server listening at ' + address + ':' + port);
