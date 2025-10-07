// ConfiguraÃ§Ã£o centralizada da API - Multi-Tenant System
export const API_CONFIG = {
  // âœ… Portas corretas dos serviÃ§os
  AUTH_SERVICE: 'http://localhost:3001',    // âœ… auth-service (onde estÃ¡ o endpoint /api/auth/companies)
  AUTH_USERS: 'http://localhost:3008',      // ✅ auth-users-service (cadastro e gestão de usuários)
  DRIVERS: 'http://localhost:3002',         // âœ… drivers-vehicles-service
  DELIVERIES: 'http://localhost:3003',      // âœ… deliveries-routes-service
  RECEIPTS: 'http://localhost:3004',        // âœ… receipts-ocr-service
  TRACKING: 'http://localhost:3005',        // âœ… tracking-service
  REPORTS: 'http://localhost:3006',         // âœ… reports-service
  COMPANIES: 'http://localhost:3007'        // âœ… companies-service
};

// ConfiguraÃ§Ã£o para variÃ¡veis de ambiente (produÃ§Ã£o)
export const getApiConfig = () => ({
  AUTH_SERVICE: import.meta.env.VITE_AUTH_API_URL || API_CONFIG.AUTH_SERVICE,
  AUTH_USERS: import.meta.env.VITE_AUTH_USERS_API_URL || API_CONFIG.AUTH_USERS,
  DRIVERS: import.meta.env.VITE_DRIVERS_API_URL || API_CONFIG.DRIVERS,
  DELIVERIES: import.meta.env.VITE_DELIVERIES_API_URL || API_CONFIG.DELIVERIES,
  RECEIPTS: import.meta.env.VITE_RECEIPTS_API_URL || API_CONFIG.RECEIPTS,
  TRACKING: import.meta.env.VITE_TRACKING_API_URL || API_CONFIG.TRACKING,
  REPORTS: import.meta.env.VITE_REPORTS_API_URL || API_CONFIG.REPORTS,
  COMPANIES: import.meta.env.VITE_COMPANIES_API_URL || API_CONFIG.COMPANIES,
});

// FunÃ§Ã£o auxiliar para determinar a base URL pelo endpoint
export function getBaseUrl(endpoint: string): string {
  const config = getApiConfig();
  
  // âœ… AutenticaÃ§Ã£o (inclui /api/auth/companies)
  if (endpoint.startsWith('/api/auth')) {
    return config.AUTH_SERVICE;
  }
  
  // âœ… UsuÃ¡rios (gerenciamento de usuÃ¡rios)
  if (endpoint.startsWith('/api/users')) {
    return config.AUTH_USERS;
  }
  
  // âœ… Motoristas e VeÃ­culos
  if (endpoint.startsWith('/api/drivers') || endpoint.startsWith('/api/vehicles')) {
    return config.DRIVERS;
  }
  
  // âœ… Entregas, Rotas e OcorrÃªncias
  if (endpoint.startsWith('/api/deliveries') || 
      endpoint.startsWith('/api/routes') || 
      endpoint.startsWith('/api/occurrences')) {
    return config.DELIVERIES;
  }
  
  // âœ… Comprovantes e OCR
  if (endpoint.startsWith('/api/receipts')) {
    return config.RECEIPTS;
  }
  
  // âœ… Rastreamento
  if (endpoint.startsWith('/api/tracking')) {
    return config.TRACKING;
  }
  
  // âœ… RelatÃ³rios e Dashboard
  if (endpoint.startsWith('/api/reports') || endpoint.startsWith('/api/dashboard')) {
    return config.REPORTS;
  }
  
  // âœ… Empresas
  if (endpoint.startsWith('/api/companies')) {
    return config.COMPANIES;
  }
  
  // Fallback para autenticaÃ§Ã£o
  return config.AUTH_SERVICE;
}

// Tipos para configuraÃ§Ã£o
export interface ApiConfig {
  AUTH_SERVICE: string;
  AUTH_USERS: string;
  DRIVERS: string;
  DELIVERIES: string;
  RECEIPTS: string;
  TRACKING: string;
  REPORTS: string;
  COMPANIES: string;
}

// ExportaÃ§Ã£o padrÃ£o
export default API_CONFIG; 
