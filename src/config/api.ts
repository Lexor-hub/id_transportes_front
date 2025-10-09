// ✅ Arquivo de configuração de API simplificado para produção e desenvolvimento

// 1. Define a URL base da API.
//    - Em produção (Vercel), usará a variável de ambiente VITE_API_BASE_URL.
//    - Em desenvolvimento, usará http://localhost:3008 (a porta do serviço principal).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';

// 2. Cria um objeto de configuração unificado.
//    Todos os serviços serão acessados através da mesma URL base,
//    que atuará como um API Gateway.
export const API_CONFIG = {
  // Todas as chaves apontam para a mesma URL base, garantindo que o frontend
  // não tente acessar 'localhost' em produção.
  AUTH_SERVICE: API_BASE_URL,
  AUTH_USERS: API_BASE_URL,
  COMPANIES: API_BASE_URL,
  DRIVERS: API_BASE_URL,
  DELIVERIES: API_BASE_URL,
  RECEIPTS: API_BASE_URL,
  TRACKING: API_BASE_URL,
  REPORTS: API_BASE_URL,
};

// ExportaÃ§Ã£o padrÃ£o
export default API_CONFIG; 
