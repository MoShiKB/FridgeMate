import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, tokenManager } from '../services/api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE_URL, {
      auth: { token: tokenManager.getAccessToken() },
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (s.disconnected) {
    s.auth = { token: tokenManager.getAccessToken() };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
