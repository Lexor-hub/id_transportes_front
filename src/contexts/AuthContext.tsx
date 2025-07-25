import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType, LoginCredentials } from '@/types/auth';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check for stored auth data on app load
    const token = localStorage.getItem('id_transporte_token');
    const userData = localStorage.getItem('id_transporte_user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        localStorage.removeItem('id_transporte_token');
        localStorage.removeItem('id_transporte_user');
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        const { user: userData, token } = response.data;
        
        // Store auth data
        localStorage.setItem('id_transporte_token', token);
        localStorage.setItem('id_transporte_user', JSON.stringify(userData));
        
        setUser(userData);
        
        toast({
          title: "Login realizado com sucesso!",
          description: `Bem-vindo(a), ${userData.name}!`,
        });
      } else {
        throw new Error(response.error || 'Erro no login');
      }
    } catch (error) {
      toast({
        title: "Erro no login",
        description: error instanceof Error ? error.message : 'Credenciais inválidas',
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('id_transporte_token');
    localStorage.removeItem('id_transporte_user');
    setUser(null);
    
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};