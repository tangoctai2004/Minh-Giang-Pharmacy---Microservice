const { randomUUID } = require('crypto');
const monitoring = require('./monitoring');
const logger = require('../utils/logger');

module.exports = function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Date.now() - req.requestStartedAt;
    monitoring.recordRequest({
      route: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      durationMs,
    });
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.userId || null,
      userRole: req.userRole || null,
    });
  });

  next();
};
