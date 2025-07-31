import { LoginCredentials, ApiResponse, User, Company } from '@/types/auth';
import { getBaseUrl } from '@/config/api';

class ApiService {
  private isTokenValid(): boolean {
    // Verifica primeiro o token final
    let token = localStorage.getItem('id_transporte_token');
    
    // Se não tem token final, verifica o token temporário
    if (!token) {
      token = localStorage.getItem('temp_token');
    }
    
    if (!token) {
      console.log('Token não encontrado no localStorage');
      return false;
    }
    
    try {
      // Verificar se o token tem o formato correto (3 partes separadas por ponto)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('Token com formato inválido');
        return false;
      }
      
      // Decodificar o token JWT (base64url para base64)
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      const currentTime = Math.floor(Date.now() / 1000);
      
      console.log('Token expira em:', new Date(payload.exp * 1000));
      console.log('Tempo atual:', new Date(currentTime * 1000));
      console.log('Token válido:', payload.exp > currentTime);
      
      return payload.exp > currentTime;
    } catch (error) {
      console.log('Erro ao validar token:', error);
      return false;
    }
  }

  private getAuthHeader(): Record<string, string> {
    console.log('=== DEBUG getAuthHeader ===');
    
    // Primeiro tenta o token final (com company_id)
    let token = localStorage.getItem('id_transporte_token');
    console.log('Token final:', token ? 'Presente' : 'Ausente');
    
    // Se não tem token final, tenta o token temporário
    if (!token) {
      token = localStorage.getItem('temp_token');
      console.log('Token temporário:', token ? 'Presente' : 'Ausente');
    }
    
    if (token) {
      console.log('Token encontrado:', token.substring(0, 20) + '...');
      console.log('Token válido:', this.isTokenValid());
      
      if (!this.isTokenValid()) {
        console.log('Token expirado ou inválido - removendo do localStorage');
        localStorage.removeItem('id_transporte_token');
        localStorage.removeItem('id_transporte_user');
        localStorage.removeItem('id_transporte_company');
        localStorage.removeItem('temp_token');
        localStorage.removeItem('temp_user');
        return {};
      }
      console.log('Token válido - enviando no header Authorization');
      return { Authorization: `Bearer ${token}` };
    }
    console.log('Nenhum token encontrado no localStorage');
    return {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = getBaseUrl(endpoint);
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`Fazendo requisição para: ${fullUrl}`);
      
      const headers = {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
        ...options.headers,
      };
      
      console.log('Headers da requisição:', headers);
      
      const response = await fetch(fullUrl, {
        headers,
        ...options,
      });

      console.log(`Status da resposta: ${response.status} ${response.statusText}`);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Erro da API:', errorData);
        
        // Tratamento específico para erro de configuração do backend
        if (errorData?.error?.includes('secretOrPrivateKey')) {
          throw new Error('Erro de configuração do servidor. Entre em contato com o administrador.');
        }
        
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('Dados da resposta:', data);
      
      // Verificar se a resposta já tem a estrutura esperada
      if (data && typeof data === 'object' && 'success' in data) {
        console.log('Resposta já tem estrutura esperada, retornando diretamente');
        return data as ApiResponse<T>;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('API Error:', error);
      
      // Melhorar mensagem de erro para o usuário
      let errorMessage = 'Erro de conexão';
      if (error instanceof Error) {
        if (error.message.includes('secretOrPrivateKey')) {
          errorMessage = 'Erro de configuração do servidor. Entre em contato com o administrador.';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Auth methods
  async login(credentials: { username: string; password: string }): Promise<ApiResponse<{
    token: string;
    user: {
      id: string;
      username: string;
      email: string;
      full_name: string;
      user_type: string;
      company_id?: string;
      company_name?: string;
      company_domain?: string;
    };
  }>> {
    console.log('=== DEBUG API LOGIN ===');
    console.log('Credenciais enviadas:', credentials);
    
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    console.log('Resposta do login da API:', response);
    return response as ApiResponse<{
      token: string;
      user: {
        id: string;
        username: string;
        email: string;
        full_name: string;
        user_type: string;
        company_id?: string;
        company_name?: string;
        company_domain?: string;
      };
    }>;
  }

  async getCompanies(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    domain: string;
    email: string;
    subscription_plan: string;
  }>>> {
    return this.request('/api/auth/companies');
  }

  async selectCompany(companyId: string): Promise<ApiResponse<{
    token: string;
    user: {
      id: string;
      username: string;
      email: string;
      full_name: string;
      user_type: string;
      company_id: string;
    };
  }>> {
    return this.request('/api/auth/select-company', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId }),
    });
  }

  async refreshToken(): Promise<ApiResponse<{ token: string; expires_in: number }>> {
    return this.request('/api/auth/refresh', {
      method: 'POST',
    });
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    return this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Receipts endpoints (Upload e Processamento de Canhotos)
  async uploadReceipt(formData: FormData): Promise<ApiResponse<{
    id: string;
    filename: string;
    url: string;
    processed: boolean;
    status: string;
  }>> {
    const token = localStorage.getItem('id_transporte_token');
    
    try {
      const baseUrl = getBaseUrl('/api/receipts/upload');
      const response = await fetch(`${baseUrl}/api/receipts/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no upload',
      };
    }
  }

  async processReceiptOCR(receiptId: string): Promise<ApiResponse<{
    ocr_data: {
      nf_number: string;
      client_name: string;
      address: string;
      value: number;
      items: Array<Record<string, unknown>>;
    };
    raw_text: string;
  }>> {
    return this.request(`/api/receipts/${receiptId}/process-ocr`, { method: 'POST' });
  }

  async validateReceipt(receiptId: string, validationData: {
    ocr_data: Record<string, unknown>;
    validated: boolean;
    corrections?: Record<string, unknown>;
  }): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request(`/api/receipts/${receiptId}/validate`, {
      method: 'PUT',
      body: JSON.stringify(validationData),
    });
  }

  async getReceipts(filters?: {
    delivery_id?: string;
    driver_id?: string;
    status?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    delivery_id: string;
    driver_id: string;
    filename: string;
    status: string;
    ocr_data?: Record<string, unknown>;
    validated: boolean;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/receipts${queryParams}`);
  }

  // Tracking endpoints (Rastreamento em Tempo Real)
  async sendLocation(locationData: {
    driver_id: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    delivery_id?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request('/api/tracking/location', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  async getCurrentLocations(): Promise<ApiResponse<Array<{
    driver_id: string;
    driver_name: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
    last_update: string;
    status: string;
    current_delivery_id?: string;
    current_delivery_client?: string;
  }>>> {
    return this.request('/api/tracking/drivers/current-locations');
  }

  async getTrackingHistory(driverId: string, filters?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ApiResponse<Array<{
    timestamp: string;
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number;
    heading: number;
    delivery_id?: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/tracking/drivers/${driverId}/history${queryParams}`);
  }

  async updateDriverStatus(driverId: string, status: 'active' | 'inactive' | 'busy' | 'available'): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/tracking/drivers/${driverId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Occurrences endpoints (Gestão de Ocorrências)
  async createOccurrence(deliveryId: string, occurrenceData: {
    type: 'reentrega' | 'recusa' | 'avaria';
    description: string;
    photo?: File;
    latitude?: number;
    longitude?: number;
  }): Promise<ApiResponse<{
    id: string;
    delivery_id: string;
    type: string;
    description: string;
    photo_url?: string;
    created_at: string;
  }>> {
    const formData = new FormData();
    formData.append('type', occurrenceData.type);
    formData.append('description', occurrenceData.description);
    
    if (occurrenceData.photo) {
      formData.append('photo', occurrenceData.photo);
    }
    
    if (occurrenceData.latitude) {
      formData.append('latitude', occurrenceData.latitude.toString());
    }
    
    if (occurrenceData.longitude) {
      formData.append('longitude', occurrenceData.longitude.toString());
    }

    const token = localStorage.getItem('id_transporte_token');
    
    try {
      const baseUrl = getBaseUrl('/api/deliveries');
      const response = await fetch(`${baseUrl}/api/deliveries/${deliveryId}/occurrence`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar ocorrência',
      };
    }
  }

  async getOccurrences(filters?: {
    company_id?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    driver_id?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    delivery_id: string;
    type: string;
    description: string;
    photo_url?: string;
    driver_name: string;
    client_name: string;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/occurrences${queryParams}`);
  }

  async getOccurrenceDetails(occurrenceId: string): Promise<ApiResponse<{
    id: string;
    delivery_id: string;
    type: string;
    description: string;
    photo_url?: string;
    latitude?: number;
    longitude?: number;
    driver_name: string;
    client_name: string;
    created_at: string;
  }>> {
    return this.request(`/api/occurrences/${occurrenceId}`);
  }

  // Reports endpoints (Relatórios Avançados)
  async getDeliveryReports(filters?: {
    company_id?: string;
    start_date?: string;
    end_date?: string;
    driver_id?: string;
    client_id?: string;
    status?: string;
    format?: 'json' | 'pdf' | 'excel';
  }): Promise<ApiResponse<{
    summary: {
      total: number;
      completed: number;
      pending: number;
      cancelled: number;
      refused: number;
      avg_delivery_time: number;
    };
    daily_progress: Array<{
      date: string;
      total: number;
      completed: number;
      pending: number;
    }>;
    status_distribution: Array<{
      status: string;
      count: number;
      percentage: number;
    }>;
    driver_performance: Array<{
      driver_name: string;
      total_deliveries: number;
      completed_deliveries: number;
      success_rate: number;
      avg_delivery_time: number;
    }>;
  }>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/deliveries${queryParams}`);
  }

  async getDriverPerformanceReports(filters?: {
    company_id?: string;
    start_date: string;
    end_date: string;
    driver_id?: string;
  }): Promise<ApiResponse<Array<{
    driver_id: string;
    driver_name: string;
    total_deliveries: number;
    completed_deliveries: number;
    success_rate: number;
    average_time: number;
    occurrences: number;
    occurrence_rate: number;
    performance_score: number;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/driver-performance${queryParams}`);
  }

  async getClientVolumeReports(filters?: {
    company_id?: string;
    start_date: string;
    end_date: string;
    client_id?: string;
  }): Promise<ApiResponse<Array<{
    client_id: string;
    client_name: string;
    total_deliveries: number;
    total_value: number;
    average_value: number;
    completed_deliveries: number;
    success_rate: number;
    growth_rate: number;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/client-volume${queryParams}`);
  }

  async getDailyStatus(): Promise<ApiResponse<{
    total_deliveries: number;
    completed_deliveries: number;
    pending_deliveries: number;
    active_drivers: number;
    total_revenue: number;
  }>> {
    return this.request('/api/reports/daily-status');
  }

  async getOccurrencesReports(filters?: {
    company_id?: string;
    start_date?: string;
    end_date?: string;
    type?: string;
    search?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    delivery_id: string;
    type: string;
    description: string;
    driver_name: string;
    client_name: string;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/occurrences${queryParams}`);
  }

  async getReceiptsReports(filters?: {
    company_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    delivery_id: string;
    driver_name: string;
    filename: string;
    status: string;
    validated: boolean;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/receipts${queryParams}`);
  }

  // Dashboard endpoints (KPIs)
  async getDashboardKPIs(): Promise<ApiResponse<{
    today_deliveries: {
      total: number;
      completed: number;
      pending: number;
    };
    active_drivers: number;
    pending_occurrences: number;
    performance_score: number;
    revenue_today: number;
    efficiency_rate: number;
  }>> {
    return this.request('/api/dashboard/kpis');
  }



  // Deliveries endpoints (Gestão de Entregas)
  async getDeliveries(filters?: {
    status?: string;
    driver_id?: string;
    client_id?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    nf_number: string;
    client_name: string;
    client_address: string;
    merchandise_value: number;
    status: string;
    driver_name: string;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/deliveries${queryParams}`);
  }

  async getDeliveryDetails(deliveryId: string): Promise<ApiResponse<{
    id: string;
    nf_number: string;
    client_name: string;
    client_address: string;
    client_phone: string;
    merchandise_value: number;
    status: string;
    driver_name: string;
    notes: string;
    created_at: string;
    occurrences: Array<{
      id: string;
      type: string;
      description: string;
      created_at: string;
    }>;
  }>> {
    return this.request(`/api/deliveries/${deliveryId}`);
  }

  async updateDeliveryStatus(deliveryId: string, statusData: {
    status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'REFUSED';
    notes?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/deliveries/${deliveryId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData),
    });
  }



  async createCompany(companyData: {
    name: string;
    cnpj: string;
    domain: string;
    email: string;
    subscription_plan: string;
    max_users: number;
    max_drivers: number;
  }): Promise<ApiResponse<{
    message: string;
    company_id: string;
    admin_credentials: {
      username: string;
      password: string;
    };
  }>> {
    return this.request('/api/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
  }

  async updateCompany(companyId: string, companyData: {
    name?: string;
    cnpj?: string;
    domain?: string;
    email?: string;
    subscription_plan?: string;
    max_users?: number;
    max_drivers?: number;
    is_active?: boolean;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/companies/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(companyData),
    });
  }

  async getCompanyStats(companyId: string): Promise<ApiResponse<{
    users: number;
    drivers: number;
    vehicles: number;
    clients: number;
    total_deliveries: number;
    active_deliveries: number;
  }>> {
    return this.request(`/api/companies/${companyId}/stats`);
  }

  async getCompanySettings(companyId: string): Promise<ApiResponse<{
    company_id: string;
    logo_url?: string;
    primary_color: string;
    secondary_color: string;
    company_name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    timezone: string;
    currency: string;
    language: string;
    notifications: {
      email_notifications: boolean;
      sms_notifications: boolean;
      push_notifications: boolean;
    };
    delivery_settings: {
      max_delivery_time: number;
      auto_assign_drivers: boolean;
      require_signature: boolean;
      require_photo: boolean;
    };
  }>> {
    return this.request(`/api/companies/${companyId}/settings`);
  }

  async updateCompanySettings(companyId: string, settings: Record<string, unknown>): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/companies/${companyId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async uploadCompanyLogo(companyId: string, logoFile: File): Promise<ApiResponse<{
    logo_url: string;
    message: string;
  }>> {
    const formData = new FormData();
    formData.append('logo', logoFile);

    const token = localStorage.getItem('id_transporte_token');
    
    try {
      const baseUrl = getBaseUrl('/api/companies');
      const response = await fetch(`${baseUrl}/api/companies/${companyId}/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no upload do logo',
      };
    }
  }

  // Drivers and Vehicles endpoints
  async getDrivers(filters?: {
    status?: string;
    vehicle_id?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    cpf: string;
    cnh: string;
    phone: string;
    email: string;
    status: string;
    vehicle_id?: string;
    vehicle_plate?: string;
    vehicle_model?: string;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/drivers${queryParams}`);
  }

  async createDriver(driverData: {
    name: string;
    cpf: string;
    cnh: string;
    phone: string;
    email: string;
    vehicle_id?: string;
  }): Promise<ApiResponse<{
    id: string;
    name: string;
    cpf: string;
    cnh: string;
    phone: string;
    email: string;
    status: string;
    vehicle_id?: string;
    created_at: string;
  }>> {
    return this.request('/api/drivers', {
      method: 'POST',
      body: JSON.stringify(driverData),
    });
  }

  async updateDriver(driverId: string, driverData: {
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/drivers/${driverId}`, {
      method: 'PUT',
      body: JSON.stringify(driverData),
    });
  }

  async getDriverDetails(driverId: string): Promise<ApiResponse<{
    id: string;
    name: string;
    cpf: string;
    cnh: string;
    phone: string;
    email: string;
    status: string;
    vehicle?: {
      id: string;
      plate: string;
      model: string;
      year: number;
      color: string;
    };
    statistics: {
      total_deliveries: number;
      completed_deliveries: number;
      success_rate: number;
      avg_delivery_time: number;
    };
    created_at: string;
  }>> {
    return this.request(`/api/drivers/${driverId}`);
  }

  async getVehicles(filters?: {
    status?: string;
  }): Promise<ApiResponse<Array<{
    id: string;
    plate: string;
    model: string;
    brand: string;
    year: number;
    color: string;
    status: string;
    driver_name?: string;
    created_at: string;
  }>>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/vehicles${queryParams}`);
  }

  async createVehicle(vehicleData: {
    plate: string;
    model: string;
    brand: string;
    year: number;
    color: string;
    driver_id?: string;
  }): Promise<ApiResponse<{
    id: string;
    plate: string;
    model: string;
    brand: string;
    year: number;
    color: string;
    status: string;
    driver_id?: string;
    created_at: string;
  }>> {
    return this.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  }

  async updateVehicle(vehicleId: string, vehicleData: {
    plate?: string;
    model?: string;
    brand?: string;
    year?: number;
    color?: string;
    driver_id?: string;
    status?: string;
  }): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });
  }

  async deleteVehicle(vehicleId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
  }

  // Users management
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request('/api/users');
  }

  async createUser(userData: unknown): Promise<ApiResponse<User>> {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: unknown): Promise<ApiResponse<User>> {
    return this.request(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }


}

export const apiService = new ApiService();