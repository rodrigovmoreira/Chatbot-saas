import { io } from 'socket.io-client';

let socket = null;

export const connectSocket = (token) => {
  if (socket && socket.connected) return socket;
  
  console.log('🔌 Conectando Socket.IO...');
  socket = io('http://localhost:3001', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Eventos de debug
  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado com sucesso');
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO desconectado:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('💥 Erro de conexão Socket.IO:', error);
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    console.warn('⚠️ Socket não inicializado');
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};