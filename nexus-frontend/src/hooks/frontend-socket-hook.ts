// src/hooks/useSocket.ts
// Drop this into Nexus frontend src/hooks/ directory

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

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected:', socketInstance?.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket error:', err.message);
    });

    return () => {
      // Don't disconnect on component unmount — keep global socket alive
    };
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

// ── Video call hook ───────────────────────────────────────────────────────────
export const useVideoCall = (roomId: string, token: string | null) => {
  const { socket, emit, on } = useSocket(token);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStream = useRef<MediaStream | null>(null);

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const createPeerConnection = useCallback((targetSocketId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('video:ice-candidate', { candidate: event.candidate, targetSocketId });
      }
    };

    peerConnections.current.set(targetSocketId, pc);
    return pc;
  }, [emit]);

  const joinRoom = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      emit('video:join-room', { roomId });
      return stream;
    } catch (err) {
      console.error('Media access error:', err);
      throw err;
    }
  }, [emit, roomId]);

  const leaveRoom = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    emit('video:leave-room', { roomId });
  }, [emit, roomId]);

  const toggleAudio = useCallback((enabled: boolean) => {
    localStream.current?.getAudioTracks().forEach(t => { t.enabled = enabled; });
    emit('video:toggle-media', { roomId, type: 'audio', enabled });
  }, [emit, roomId]);

  const toggleVideo = useCallback((enabled: boolean) => {
    localStream.current?.getVideoTracks().forEach(t => { t.enabled = enabled; });
    emit('video:toggle-media', { roomId, type: 'video', enabled });
  }, [emit, roomId]);

  return { joinRoom, leaveRoom, toggleAudio, toggleVideo, createPeerConnection, peerConnections, localStream, on };
};
