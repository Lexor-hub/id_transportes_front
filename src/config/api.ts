// ✅ Arquivo de configuração de API simplificado para produção e desenvolvimento

// 1. Define a URL base da API.
//    - Em produção (Vercel), usará a variável de ambiente VITE_API_BASE_URL (ex: https://idtransporteback-production.up.railway.app).
//    - Em desenvolvimento, usará http://localhost:3008, a porta do serviço principal (auth-users-service).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

// 2. Cria um objeto de configuração unificado.
//    Todos os serviços serão acessados através da mesma URL base,
//    que atuará como um API Gateway.
export const API_CONFIG = {
  // Todas as chaves apontam para a mesma URL base, garantindo que o frontend
  // não tente acessar 'localhost' em produção.
  AUTH_SERVICE: API_BASE_URL, // Para /api/auth/*
  AUTH_USERS: API_BASE_URL,   // Para /api/users/*
  COMPANIES: API_BASE_URL,    // Para /api/companies/*
  DRIVERS: API_BASE_URL,      // Para /api/drivers/*
  DELIVERIES: API_BASE_URL,   // Para /api/deliveries/*
  RECEIPTS: API_BASE_URL,     // Para /api/receipts/*
  TRACKING: API_BASE_URL,     // Para /api/tracking/*
  REPORTS: API_BASE_URL,      // Para /api/reports/*
};

// 3. Função getBaseUrl simplificada.
//    Como todas as chamadas passam pelo mesmo gateway, esta função sempre retorna a URL base.
export function getBaseUrl(endpoint: string): string {
  // A lógica de roteamento complexa foi removida. Sempre usamos a URL base.
  return API_BASE_URL;
}

// ExportaÃ§Ã£o padrÃ£o
export default API_CONFIG; 
