import axios from 'axios';

const API_BASE = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true // Importante para cookies
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Métodos de autenticação
export const authAPI = {
  login: (data) => api.post('/api/login', data),
  register: (data) => api.post('/api/register', data),
  logout: () => api.post('/api/logout'),
};

// Métodos de negócio
export const businessAPI = {
  getConfig: () => api.get('/api/business-config'),
  updateConfig: (data) => api.put('/api/business-config', data),
  getWhatsAppStatus: () => api.get('/api/whatsapp-status'),
};

export default api;