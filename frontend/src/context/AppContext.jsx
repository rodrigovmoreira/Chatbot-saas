import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { businessAPI } from '../services/api';

const AppContext = createContext();

// Estado Inicial Simplificado (Sem QR Code)
const initialState = {
  user: null,
  businessConfig: null,
  whatsappStatus: {
    isConnected: false, // Começa falso até a API confirmar
    isAuthenticated: false,
    mode: 'Twilio'
  },
  loading: false
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_BUSINESS_CONFIG':
      return { ...state, businessConfig: action.payload };
    case 'SET_WHATSAPP_STATUS':
      return { ...state, whatsappStatus: action.payload };
    // Removemos o case 'SET_QR_CODE' pois não existe mais
    default:
      return state;
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Carregar dados iniciais ao abrir a aplicação
  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        // 1. Restaura usuário
        dispatch({ type: 'SET_USER', payload: JSON.parse(user) });
        
        try {
          // 2. Carrega Configuração do Negócio
          const configResponse = await businessAPI.getConfig();
          dispatch({ type: 'SET_BUSINESS_CONFIG', payload: configResponse.data });
          
          // 3. Verifica Status da Conexão (Via API, não mais via Socket)
          const statusResponse = await businessAPI.getWhatsAppStatus();
          dispatch({ type: 'SET_WHATSAPP_STATUS', payload: statusResponse.data });
          
        } catch (error) {
          console.error('Erro ao carregar dados iniciais:', error);
          // O interceptor do api.js cuidará se for erro de autenticação (401)
        }
      }
    };

    loadInitialData();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};