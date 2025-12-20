import axios from 'axios';

// Se estiver rodando localmente, mantém localhost.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001',
});

// Interceptor: Adiciona Token se existir.
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

// --- Rotas de Negócio (Dashboard) ---
export const businessAPI = {
  // 1. Configurações Gerais
  getConfig: () => api.get('/api/business-config'),
  updateConfig: (data) => api.put('/api/business-config', data),
  
  // 2. Controle do WhatsApp (Multi-tenant)
  getWhatsAppStatus: () => api.get('/api/whatsapp-status'),
  startWhatsApp: () => api.post('/api/whatsapp-start'), // <--- Botão "Ligar"
  logoutWhatsApp: () => api.post('/api/whatsapp-logout'), // <--- Botão "Desconectar"

  // 3. Inteligência e Presets
  getPresets: () => api.get('/api/presets'),
  applyPreset: (presetKey) => api.post('/api/apply-preset', { presetKey }),

  getCustomPrompts: () => api.get('/api/custom-prompts'),
  saveCustomPrompt: (data) => api.post('/api/custom-prompts', data), // data = { name, prompts: { chatSystem, visionSystem } }
  deleteCustomPrompt: (id) => api.delete(`/api/custom-prompts/${id}`),
  
};

export default api;