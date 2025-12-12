import axios from 'axios';

// Se estiver rodando localmente, mantém localhost.
const API_BASE = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true // Essencial para manter a sessão (cookies)
});

// Interceptor: Adiciona Token se existir
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: Redireciona se Token expirar (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Limpa dados locais
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Só redireciona se já não estiver na tela de login para evitar loop
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// --- Rotas de Autenticação ---
export const authAPI = {
  login: (data) => api.post('/api/login', data),
  register: (data) => api.post('/api/register', data),
  logout: () => api.post('/api/logout'),
};

// --- Rotas de Negócio ---
export const businessAPI = {
  // Pega configurações (Nome, Horários, etc)
  getConfig: () => api.get('/api/business-config'),
  
  // Atualiza configurações
  updateConfig: (data) => api.put('/api/business-config', data),
  
  // Verifica status da conexão (Agora retorna sempre "Conectado" via Twilio Cloud)
  getWhatsAppStatus: () => api.get('/api/whatsapp-status'),

  // Desconecta o WhatsApp
  logoutWhatsApp: () => api.post('/api/whatsapp-logout')

};

export default api;