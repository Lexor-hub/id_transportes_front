export interface User {
  id: string;
  username: string;
  email: string;
  role: 'MOTORISTA' | 'ADMINISTRADOR' | 'SUPERVISOR' | 'OPERADOR' | 'CLIENTE';
  name: string;
  cpf?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  token?: string;
}