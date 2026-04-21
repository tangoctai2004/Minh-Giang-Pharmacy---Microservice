const stats = {
  startedAt: new Date().toISOString(),
  requestsTotal: 0,
  errorsTotal: 0,
  byRoute: {},
  byStatus: {},
};

function recordRequest({ route, method, statusCode, durationMs }) {
  stats.requestsTotal += 1;
  if (statusCode >= 500) {
    stats.errorsTotal += 1;
  }

  const routeKey = `${method} ${route || 'unknown'}`;
  if (!stats.byRoute[routeKey]) {
    stats.byRoute[routeKey] = {
      count: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
    };
  }
  const item = stats.byRoute[routeKey];
  item.count += 1;
  item.totalDurationMs += durationMs;
  item.avgDurationMs = Number((item.totalDurationMs / item.count).toFixed(2));
  item.maxDurationMs = Math.max(item.maxDurationMs, durationMs);

  const statusKey = String(statusCode);
  stats.byStatus[statusKey] = (stats.byStatus[statusKey] || 0) + 1;
}

function snapshot() {
  return {
    ...stats,
    uptimeSec: Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 1000),
  };
}

module.exports = {
  recordRequest,
  snapshot,
};
