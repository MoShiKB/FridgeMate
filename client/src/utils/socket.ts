import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, tokenManager } from '../services/api';

const SOCKET_URL = new URL(API_BASE_URL).origin;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
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
