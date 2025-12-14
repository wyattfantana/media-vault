// Simple API client for REST endpoints
// Centralized API URL configuration - reads from environment variable
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class APIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Send cookies for Clerk authentication
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'An error occurred' };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return { error: 'Network error occurred' };
    }
  }

  // Clients
  async getClients() {
    return this.request<any[]>('/api/clients');
  }

  async getClient(id: number) {
    return this.request<any>(`/api/clients/${id}`);
  }

  async createClient(data: any) {
    return this.request<any>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: number, data: any) {
    return this.request<any>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number) {
    return this.request<void>(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  }

  // Products
  async getProducts(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<any[]>(`/api/products${query}`);
  }

  async getProduct(id: number) {
    return this.request<any>(`/api/products/${id}`);
  }

  async createProduct(data: any) {
    return this.request<any>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: number, data: any) {
    return this.request<any>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: number) {
    return this.request<void>(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  // Estimates
  async getEstimates() {
    return this.request<any[]>('/api/estimates');
  }

  async getEstimate(id: number) {
    return this.request<any>(`/api/estimates/${id}`);
  }

  async createEstimate(data: any) {
    return this.request<any>('/api/estimates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteEstimate(id: number) {
    return this.request<void>(`/api/estimates/${id}`, {
      method: 'DELETE',
    });
  }

  // Invoices
  async getInvoices() {
    return this.request<any[]>('/api/invoices');
  }

  async getInvoice(id: number) {
    return this.request<any>(`/api/invoices/${id}`);
  }

  async createInvoice(data: any) {
    return this.request<any>('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: number) {
    return this.request<void>(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new APIClient(API_URL);
