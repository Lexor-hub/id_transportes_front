type ApiConfig = {
  AUTH_SERVICE: string;
  AUTH_USERS: string;
  DRIVERS: string;
  DELIVERIES: string;
  RECEIPTS: string;
  TRACKING: string;
  REPORTS: string;
  COMPANIES: string;
  API_GATEWAY: string;
};

const DEFAULT_CONFIG: ApiConfig = {
  AUTH_SERVICE: 'http://localhost:3000',
  AUTH_USERS: 'http://localhost:3001',
  DRIVERS: 'http://localhost:3002',
  DELIVERIES: 'http://localhost:3003',
  RECEIPTS: 'http://localhost:3004',
  TRACKING: 'http://localhost:3005',
  REPORTS: 'http://localhost:3006',
  COMPANIES: 'http://localhost:3007',
  API_GATEWAY: 'http://localhost:3008',
};

const trimEnv = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const stripTrailingSlash = (url: string): string =>
  url.endsWith('/') ? url.slice(0, -1) : url;

const env = import.meta.env as Record<string, string | undefined>;

export const API_CONFIG: ApiConfig = {
  AUTH_SERVICE: stripTrailingSlash(
    trimEnv(env.VITE_AUTH_API_URL) ?? DEFAULT_CONFIG.AUTH_SERVICE
  ),
  AUTH_USERS: stripTrailingSlash(
    trimEnv(env.VITE_AUTH_USERS_API_URL) ?? DEFAULT_CONFIG.AUTH_USERS
  ),
  DRIVERS: stripTrailingSlash(
    trimEnv(env.VITE_DRIVERS_API_URL) ?? DEFAULT_CONFIG.DRIVERS
  ),
  DELIVERIES: stripTrailingSlash(
    trimEnv(env.VITE_DELIVERIES_API_URL) ?? DEFAULT_CONFIG.DELIVERIES
  ),
  RECEIPTS: stripTrailingSlash(
    trimEnv(env.VITE_RECEIPTS_API_URL) ?? DEFAULT_CONFIG.RECEIPTS
  ),
  TRACKING: stripTrailingSlash(
    trimEnv(env.VITE_TRACKING_API_URL) ?? DEFAULT_CONFIG.TRACKING
  ),
  REPORTS: stripTrailingSlash(
    trimEnv(env.VITE_REPORTS_API_URL) ?? DEFAULT_CONFIG.REPORTS
  ),
  COMPANIES: stripTrailingSlash(
    trimEnv(env.VITE_COMPANIES_API_URL) ?? DEFAULT_CONFIG.COMPANIES
  ),
  API_GATEWAY: stripTrailingSlash(
    trimEnv(env.VITE_API_BASE_URL) ??
      trimEnv(env.VITE_GATEWAY_API_URL) ??
      DEFAULT_CONFIG.API_GATEWAY
  ),
};

export const API_BASE_URL = API_CONFIG.API_GATEWAY;

export const getApiConfig = (): ApiConfig => API_CONFIG;

export const getBaseUrl = (endpoint: string): string => {
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (normalized.startsWith('/api/auth')) return API_CONFIG.AUTH_SERVICE;
  if (normalized.startsWith('/api/users')) return API_CONFIG.AUTH_USERS;
  if (normalized.startsWith('/api/drivers') || normalized.startsWith('/api/vehicles')) {
    return API_CONFIG.DRIVERS;
  }
  if (
    normalized.startsWith('/api/deliveries') ||
    normalized.startsWith('/api/routes') ||
    normalized.startsWith('/api/occurrences')
  ) {
    return API_CONFIG.DELIVERIES;
  }
  if (normalized.startsWith('/api/receipts')) return API_CONFIG.RECEIPTS;
  if (normalized.startsWith('/api/tracking')) return API_CONFIG.TRACKING;
  if (normalized.startsWith('/api/reports')) return API_CONFIG.REPORTS;
  if (normalized.startsWith('/api/companies')) return API_CONFIG.COMPANIES;

  return API_CONFIG.API_GATEWAY || API_CONFIG.AUTH_SERVICE;
};

export const resolveApiUrl = (endpoint: string): string =>
  `${getBaseUrl(endpoint)}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
