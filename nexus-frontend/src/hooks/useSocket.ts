import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
let socketInstance: Socket | null = null;

export const useSocket = (token: string | null) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });
    }
    socketRef.current = socketInstance;
    return () => {};
  }, [token]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (...args: any[]) => void) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef.current, emit, on, off };
};
