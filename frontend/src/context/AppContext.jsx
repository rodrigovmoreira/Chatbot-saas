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
      const isConnected = action.payload.isConnected;
      return { 
        ...state, 
        whatsappStatus: { 
          ...state.whatsappStatus,
          isConnected: isConnected,
          mode: action.payload.mode,
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

  // 1. Carregar dados iniciais (User + Token + Config)
  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        const userObj = JSON.parse(userStr);
        dispatch({ type: 'SET_USER', payload: userObj });
        
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

  // 2. CONEXÃO SOCKET.IO (CRUCIAL PARA O QR CODE)
  useEffect(() => {
    // Só conecta se tivermos um usuário logado
    if (!state.user || !state.user.id) return;

    console.log('🔌 Iniciando conexão Socket para usuário:', state.user.id);

    const socket = io(process.env.REACT_APP_API_URL || 'http://localhost:3001', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('✅ Socket Conectado! ID:', socket.id);
      
      // --- O PULO DO GATO ---
      // Emitimos o join_session imediatamente após conectar
      console.log(`🗣️ Solicitando entrada na sala: ${state.user.id}`);
      socket.emit('join_session', state.user.id);
    });

    socket.on('wwebjs_qr', (qr) => {
      console.log('📸 QR Code recebido via Socket!');
      dispatch({ type: 'SET_QR_CODE', payload: qr });
    });

    socket.on('wwebjs_status', (status) => {
      console.log('🔄 Status WWebJS recebido:', status);
      
      let isConnected = false;
      let mode = 'Desconectado';

      if (status === 'ready' || status === 'authenticated') {
        isConnected = true;
        mode = 'Conectado';
      } else if (status === 'qrcode') {
        mode = 'Aguardando Leitura';
      } else if (status === 'initializing') {
        mode = 'Iniciando...';
      }

      dispatch({ 
        type: 'SET_WHATSAPP_STATUS', 
        payload: { isConnected, mode } 
      });
    });

    return () => {
      console.log('🔌 Desconectando Socket...');
      socket.disconnect();
    };
  }, [state.user]); // Executa sempre que o usuário muda (Login/Logout)

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