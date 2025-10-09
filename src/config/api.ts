// ✅ Arquivo de configuração de API simplificado para produção e desenvolvimento

/**
 * A URL base para todas as chamadas de API.
 * - Em produção (Vercel), usa a variável de ambiente `VITE_API_BASE_URL`.
 * - Em desenvolvimento, usa `http://localhost:3008` (a porta do serviço principal/gateway).
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3008';
