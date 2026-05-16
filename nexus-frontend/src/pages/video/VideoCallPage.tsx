import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

let socket: Socket | null = null;

interface RemoteStream { socketId: string; stream: MediaStream; userName: string; }

export const VideoCallPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const roomId = searchParams.get('room') || searchParams.get('roomId') || 'default-room';
  const partnerName = searchParams.get('partnerName') || 'Participant';

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStream[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());

  const createPeerConnection = useCallback((targetSocketId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket?.emit('video:ice-candidate', { candidate: e.candidate, targetSocketId });
      }
    };

    // Remote stream
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      setRemoteStreams(prev => {
        const exists = prev.find(s => s.socketId === targetSocketId);
        if (exists) return prev.map(s => s.socketId === targetSocketId ? { ...s, stream: remoteStream } : s);
        return [...prev, { socketId: targetSocketId, stream: remoteStream, userName: partnerName }];
      });
    };

    peerConnections.current.set(targetSocketId, pc);
    return pc;
  }, [partnerName]);

  useEffect(() => {
    const token = localStorage.getItem('nexus_access_token');
    if (!token) { navigate('/login'); return; }

    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // Connect socket
        if (!socket) {
          socket = io(SOCKET_URL, { auth: { token }, reconnection: true });
        }

        socket.on('connect', () => {
          setIsConnecting(false);
          socket!.emit('video:join-room', { roomId });
        });

        socket.on('video:room-participants', ({ participants }: { participants: string[] }) => {
          setParticipantCount(prev => prev + participants.length);
          // Create offers to existing participants
          participants.forEach(async (socketId) => {
            const pc = createPeerConnection(socketId, stream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket!.emit('video:offer', { offer, targetSocketId: socketId });
          });
        });

        socket.on('video:user-joined', ({ socketId, userName }: { socketId: string; userName: string }) => {
          setParticipantCount(prev => prev + 1);
          toast.success(`${userName} joined the call`);
        });

        socket.on('video:offer', async ({ offer, fromSocketId, fromUser }: any) => {
          const pc = createPeerConnection(fromSocketId, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket!.emit('video:answer', { answer, targetSocketId: fromSocketId });
          toast(`${fromUser?.name || 'Someone'} joined`, { icon: '👋' });
        });

        socket.on('video:answer', async ({ answer, fromSocketId }: any) => {
          const pc = peerConnections.current.get(fromSocketId);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('video:ice-candidate', async ({ candidate, fromSocketId }: any) => {
          const pc = peerConnections.current.get(fromSocketId);
          if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('video:user-left', ({ socketId, userId: leftId }: any) => {
          peerConnections.current.get(socketId)?.close();
          peerConnections.current.delete(socketId);
          setRemoteStreams(prev => prev.filter(s => s.socketId !== socketId));
          setParticipantCount(prev => Math.max(1, prev - 1));
          toast(`${partnerName} left the call`, { icon: '👋' });
        });

        socket.on('video:media-toggle', ({ userId: uid, type, enabled }: any) => {
          // Handle remote media toggle (UI indicator)
        });

        if (!socket.connected) setIsConnecting(false);
      })
      .catch(err => {
        console.error('Media error:', err);
        toast.error('Could not access camera/microphone. Check permissions.');
        setIsConnecting(false);
      });

    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      socket?.emit('video:leave-room', { roomId });
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
      socket?.off('video:room-participants');
      socket?.off('video:user-joined');
      socket?.off('video:offer');
      socket?.off('video:answer');
      socket?.off('video:ice-candidate');
      socket?.off('video:user-left');
    };
  }, [roomId]);

  const toggleAudio = () => {
    if (!localStream) return;
    const enabled = !audioEnabled;
    localStream.getAudioTracks().forEach(t => { t.enabled = enabled; });
    setAudioEnabled(enabled);
    socket?.emit('video:toggle-media', { roomId, type: 'audio', enabled });
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const enabled = !videoEnabled;
    localStream.getVideoTracks().forEach(t => { t.enabled = enabled; });
    setVideoEnabled(enabled);
    socket?.emit('video:toggle-media', { roomId, type: 'video', enabled });
  };

  const endCall = () => {
    localStream?.getTracks().forEach(t => t.stop());
    socket?.emit('video:leave-room', { roomId });
    peerConnections.current.forEach(pc => pc.close());
    navigate(-1);
  };

  return (
    <div className={`bg-gray-900 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-4rem)] rounded-lg overflow-hidden'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 bg-opacity-80">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white text-sm font-medium">Live Call</span>
          <span className="text-gray-400 text-xs">Room: {roomId.slice(0, 8)}...</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-gray-300 text-sm">
            <Users size={14} />
            <span>{participantCount}</span>
          </div>
          <button onClick={() => setIsFullscreen(f => !f)}
            className="p-1.5 text-gray-400 hover:text-white transition-colors">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 overflow-hidden">
        {isConnecting ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-white text-lg font-medium">Connecting to call...</p>
            <p className="text-gray-400 text-sm mt-1">Setting up your camera and microphone</p>
          </div>
        ) : (
          <div className={`h-full grid gap-3 ${
            remoteStreams.length === 0 ? 'grid-cols-1' :
            remoteStreams.length === 1 ? 'grid-cols-2' :
            'grid-cols-2 md:grid-cols-3'
          }`}>
            {/* Local video */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden">
              <video ref={localVideoRef} autoPlay muted playsInline
                className={`w-full h-full object-cover ${!videoEnabled ? 'invisible' : ''}`} />
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                  You
                </span>
                {!audioEnabled && (
                  <span className="bg-red-600 bg-opacity-80 text-white p-1 rounded-full">
                    <MicOff size={10} />
                  </span>
                )}
              </div>
            </div>

            {/* Remote videos */}
            {remoteStreams.map(({ socketId, stream, userName }) => (
              <RemoteVideo key={socketId} stream={stream} userName={userName} />
            ))}

            {/* Waiting placeholder if no remotes */}
            {remoteStreams.length === 0 && (
              <div className="bg-gray-800 rounded-xl flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-3">
                  <span className="text-gray-400 text-2xl font-bold">
                    {partnerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-300 text-sm font-medium">{partnerName}</p>
                <p className="text-gray-500 text-xs mt-1">Waiting to join...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-5 bg-gray-800 bg-opacity-80">
        <button onClick={toggleAudio}
          className={`p-4 rounded-full transition-all ${audioEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          title={audioEnabled ? 'Mute' : 'Unmute'}>
          {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${videoEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}>
          {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button onClick={endCall}
          className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all transform hover:scale-105"
          title="End call">
          <PhoneOff size={22} />
        </button>
      </div>
    </div>
  );
};

// Remote video component
const RemoteVideo: React.FC<{ stream: MediaStream; userName: string }> = ({ stream, userName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-3 left-3">
        <span className="bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">{userName}</span>
      </div>
    </div>
  );
};
