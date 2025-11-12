import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { businessAPI } from '../services/api';

const AppContext = createContext();

const initialState = {
  user: null,
  businessConfig: null,
  whatsappStatus: {
    isConnected: false,
    isAuthenticated: false,
    connectionTime: null
  },
  qrCode: null,
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
    case 'SET_QR_CODE':
      return { ...state, qrCode: action.payload };
    default:
      return state;
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        dispatch({ type: 'SET_USER', payload: JSON.parse(user) });
        
        try {
          // Carregar configuração do negócio
          const configResponse = await businessAPI.getConfig();
          dispatch({ type: 'SET_BUSINESS_CONFIG', payload: configResponse.data });
          
          // Carregar status do WhatsApp
          const statusResponse = await businessAPI.getWhatsAppStatus();
          dispatch({ type: 'SET_WHATSAPP_STATUS', payload: statusResponse.data });
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
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