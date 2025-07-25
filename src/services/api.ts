import { LoginCredentials, ApiResponse, User } from '@/types/auth';

// Definição das URLs base para cada serviço
const API_BASE_URLS = {
  auth: import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001',
  drivers: import.meta.env.VITE_DRIVERS_API_URL || 'http://localhost:3002',
  deliveries: import.meta.env.VITE_DELIVERIES_API_URL || 'http://localhost:3003',
  receipts: import.meta.env.VITE_RECEIPTS_API_URL || 'http://localhost:3004',
  tracking: import.meta.env.VITE_TRACKING_API_URL || 'http://localhost:3005',
  reports: import.meta.env.VITE_REPORTS_API_URL || 'http://localhost:3006',
};

// Função auxiliar para determinar a base URL pelo endpoint
function getBaseUrl(endpoint: string): string {
  if (endpoint.startsWith('/api/auth') || endpoint.startsWith('/api/users')) return API_BASE_URLS.auth;
  if (endpoint.startsWith('/api/drivers') || endpoint.startsWith('/api/vehicles')) return API_BASE_URLS.drivers;
  if (endpoint.startsWith('/api/deliveries') || endpoint.startsWith('/api/routes')) return API_BASE_URLS.deliveries;
  if (endpoint.startsWith('/api/receipts')) return API_BASE_URLS.receipts;
  if (endpoint.startsWith('/api/tracking')) return API_BASE_URLS.tracking;
  if (endpoint.startsWith('/api/reports')) return API_BASE_URLS.reports;
  return API_BASE_URLS.auth; // fallback
}

class ApiService {
  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('id_transporte_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const baseUrl = getBaseUrl(endpoint);
      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro de conexão',
      };
    }
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Driver endpoints
  async getTodayDeliveries(driverId: string): Promise<ApiResponse<unknown[]>> {
    return this.request(`/api/drivers/${driverId}/today-deliveries`);
  }

  async updateDeliveryStatus(deliveryId: string, status: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/deliveries/${deliveryId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async uploadReceipt(formData: FormData): Promise<ApiResponse<unknown>> {
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

  async trackLocation(locationData: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/api/tracking/location', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  }

  // Reports endpoints
  async getDeliveryReports(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/deliveries${queryParams}`);
  }

  async getOccurrencesReports(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/occurrences${queryParams}`);
  }

  async getReceiptsReports(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/receipts-status${queryParams}`);
  }

  async getDriverPerformanceReports(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/driver-performance${queryParams}`);
  }

  async getClientVolumeReports(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/reports/client-volume${queryParams}`);
  }

  async getDailyStatus(): Promise<ApiResponse<unknown>> {
    return this.request('/api/reports/daily-status');
  }

  async getTrackingHistory(driverId?: string): Promise<ApiResponse<unknown[]>> {
    const endpoint = driverId ? `/api/tracking/drivers/${driverId}/history` : '/api/reports/tracking-history';
    return this.request(endpoint);
  }

  async getDriverLocations(): Promise<ApiResponse<unknown[]>> {
    return this.request('/api/tracking/drivers/current-locations');
  }

  // Receipt endpoints
  async getReceipts(filters?: unknown): Promise<ApiResponse<unknown[]>> {
    const queryParams = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/receipts${queryParams}`);
  }

  async processReceiptOCR(receiptId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/receipts/${receiptId}/process-ocr`, { method: 'POST' });
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

  // Importação de XML da NF para motorista
  async importXmlNf(formData: FormData): Promise<ApiResponse<unknown>> {
    const token = localStorage.getItem('id_transporte_token');
    try {
      const baseUrl = getBaseUrl('/api/sefaz/import-xml');
      const response = await fetch(`${baseUrl}/api/sefaz/import-xml`, {
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
        error: error instanceof Error ? error.message : 'Erro no upload do XML',
      };
    }
  }

  async getVehicles(): Promise<ApiResponse<unknown[]>> {
    return this.request('/api/vehicles');
  }

  async createVehicle(vehicleData: unknown): Promise<ApiResponse<unknown>> {
    return this.request('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  }

  async updateVehicle(vehicleId: string, vehicleData: unknown): Promise<ApiResponse<unknown>> {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });
  }

  async deleteVehicle(vehicleId: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService();