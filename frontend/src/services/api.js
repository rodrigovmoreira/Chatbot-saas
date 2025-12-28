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

// --- Rotas de Autenticação (Atualizadas para /api/auth) ---
export const authAPI = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
};

// --- Rotas de Negócio (Dashboard) ---
export const businessAPI = {
  // 1. Configurações Gerais (Atualizado para /api/business)
  getConfig: () => api.get('/api/business/config'),
  updateConfig: (data) => api.put('/api/business/config', data),
  
  // 2. Controle do WhatsApp (Atualizado para /api/whatsapp)
  getWhatsAppStatus: () => api.get('/api/whatsapp/status'),
  startWhatsApp: () => api.post('/api/whatsapp/start'), // <--- Botão "Ligar"
  logoutWhatsApp: () => api.post('/api/whatsapp/logout'), // <--- Botão "Desconectar"

  // 3. Inteligência e Presets (Atualizado para /api/business)
  getPresets: () => api.get('/api/business/presets'),
  applyPreset: (presetKey) => api.post('/api/business/apply-preset', { presetKey }),

  // Upload de Imagem (NOVO)
  uploadImage: (formData) => api.post('/api/business/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteImage: (imageUrl) => api.post('/api/business/delete-image', { imageUrl }),

  // 4. Meus Modelos (Custom Prompts) (Atualizado para /api/business)
  getCustomPrompts: () => api.get('/api/business/custom-prompts'),
  saveCustomPrompt: (data) => api.post('/api/business/custom-prompts', data), // data = { name, prompts: { chatSystem, visionSystem } }
  deleteCustomPrompt: (id) => api.delete(`/api/business/custom-prompts/${id}`),
  
  // 5. Agendamentos (NOVO - /api/appointments)
  // O parâmetro 'params' serve para filtrar data { start: '...', end: '...' }
  getAppointments: (params) => api.get('/api/appointments', { params }), 
  createAppointment: (data) => api.post('/api/appointments', data),
  updateAppointment: (id, data) => api.put(`/api/appointments/${id}`, data), // <--- NOVO
  updateAppointmentStatus: (id, status) => api.patch(`/api/appointments/${id}/status`, { status }), // <--- NOVO
  deleteAppointment: (id) => api.delete(`/api/appointments/${id}`),
};

export default api;