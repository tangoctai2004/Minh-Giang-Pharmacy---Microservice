function log(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: 'catalog-service',
    message,
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error' || level === 'warn') {
    console.error(line);
    return;
  }
  console.log(line);
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
};
