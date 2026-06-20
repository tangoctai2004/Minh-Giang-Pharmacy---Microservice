const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://catalog-service:8002';
const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL || 'http://identity-service:8001';
const CMS_SERVICE_URL = process.env.CMS_SERVICE_URL || 'http://cms-service:8004';

async function callInternalService(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-service-name': 'order-service',
    'x-internal-token': process.env.INTERNAL_SERVICE_TOKEN || '',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  return response;
}

module.exports = {
  CATALOG_SERVICE_URL,
  IDENTITY_SERVICE_URL,
  CMS_SERVICE_URL,
  callInternalService
};

