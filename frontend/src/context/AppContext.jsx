import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { io } from "socket.io-client";
import { businessAPI } from '../services/api';

const AppContext = createContext();

const initialState = {
  user: null,
  businessConfig: null,
  whatsappStatus: {
    isConnected: false,
    mode: 'Iniciando...',
    qrCode: null
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
      // Lógica movida para o Reducer para evitar estado obsoleto (stale state)
      const isConnected = action.payload.isConnected;
      
      return { 
        ...state, 
        whatsappStatus: { 
          ...state.whatsappStatus,
          isConnected: isConnected,
          mode: action.payload.mode,
          // Se conectou, limpa o QR. Se não, MANTÉM o QR que já estava no estado.
          qrCode: isConnected ? null : state.whatsappStatus.qrCode 
        }
      };
      
    case 'SET_QR_CODE':
      return {
        ...state,
        whatsappStatus: { 
          ...state.whatsappStatus, 
          qrCode: action.payload,
          isConnected: false,
          mode: 'Aguardando Leitura'
        }
      };

    default:
      return state;
  }
}

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 1. Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        dispatch({ type: 'SET_USER', payload: JSON.parse(user) });
        try {
          const config = await businessAPI.getConfig();
          dispatch({ type: 'SET_BUSINESS_CONFIG', payload: config.data });
        } catch (e) { 
          console.error("Erro config inicial:", e); 
        }
      }
    };
    loadInitialData();
  }, []);

  // 2. CONEXÃO SOCKET.IO
  useEffect(() => {
    if (!state.user) return;

    const socket = io('http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling'] // Força estabilidade
    });

    console.log('🔌 Tentando conectar ao Socket...');

    socket.on('connect', () => {
      console.log('✅ Conectado ao Socket ID:', socket.id);
    });

    socket.on('wwebjs_qr', (qr) => {
      console.log('📸 QR Code recebido via Socket!');
      dispatch({ type: 'SET_QR_CODE', payload: qr });
    });

    socket.on('wwebjs_status', (status) => {
      console.log('🔄 Status WWebJS:', status);
      
      let isConnected = false;
      let mode = 'Desconectado';

      if (status === 'ready' || status === 'authenticated') {
        isConnected = true;
        mode = 'Conectado (WWebJS)';
      } else if (status === 'qrcode') {
        mode = 'Aguardando Leitura';
      }

      // NÃO enviamos o qrCode aqui. O reducer vai manter o antigo.
      dispatch({ 
        type: 'SET_WHATSAPP_STATUS', 
        payload: { isConnected, mode } 
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [state.user]); 

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};