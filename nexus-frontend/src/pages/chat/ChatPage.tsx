import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Video, Info, MessageCircle, Loader, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { messageAPI, userAPI } from '../../services/api';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
let socketInstance: Socket | null = null;

interface Message {
  _id: string;
  sender: { _id: string; name: string; avatarUrl: string };
  receiver: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  _id: string;
  participants: { _id: string; name: string; avatarUrl: string; isOnline: boolean; role: string }[];
  lastMessage?: { content: string; sender: { _id: string } };
  updatedAt: string;
}

export const ChatPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [convLoading, setConvLoading] = useState(true);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myId = currentUser?._id || currentUser?.id;

  const chatPartner = [...conversations.flatMap(c => c.participants), ...allUsers].find(p => p._id === userId);

  // Socket setup
  useEffect(() => {
    const token = localStorage.getItem('nexus_access_token');
    if (!token) return;
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, { auth: { token }, reconnection: true });
    }
    socketInstance.on('chat:message', (msg: Message) => {
      setMessages(prev => prev.find(m => m._id === msg._id) ? prev : [...prev, msg]);
    });
    socketInstance.on('chat:typing', ({ senderId, isTyping }: any) => {
      if (senderId === userId) setPartnerTyping(isTyping);
    });
    socketInstance.on('user:online', ({ userId: uid, isOnline }: any) => {
      setConversations(prev => prev.map(c => ({
        ...c, participants: c.participants.map(p => p._id === uid ? { ...p, isOnline } : p)
      })));
    });
    return () => {
      socketInstance?.off('chat:message');
      socketInstance?.off('chat:typing');
      socketInstance?.off('user:online');
    };
  }, [userId]);

  // Load conversations + users
  useEffect(() => {
    const load = async () => {
      try {
        setConvLoading(true);
        const [convRes, usersRes] = await Promise.all([
          messageAPI.getConversations(),
          userAPI.getAll({ limit: 50 })
        ]);
        setConversations(convRes.data.conversations);
        setAllUsers(usersRes.data.users.filter((u: any) => u._id !== myId));
      } catch { toast.error('Failed to load conversations'); }
      finally { setConvLoading(false); }
    };
    load();
  }, []);

  // Load messages when userId changes
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await messageAPI.getMessages(userId);
        setMessages(res.data.messages);
        await messageAPI.markAsRead(userId);
      } catch { toast.error('Failed to load messages'); }
      finally { setLoading(false); }
    };
    load();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !userId) return;
    const content = newMessage.trim();
    setNewMessage('');
    socketInstance?.emit('chat:send', { receiverId: userId, content });
    // Optimistic
    setMessages(prev => [...prev, {
      _id: Date.now().toString(),
      sender: { _id: myId!, name: currentUser!.name, avatarUrl: currentUser!.avatarUrl || '' },
      receiver: userId, content, createdAt: new Date().toISOString()
    }]);
  };

  const handleTyping = (val: string) => {
    setNewMessage(val);
    if (!isTyping) {
      setIsTyping(true);
      socketInstance?.emit('chat:typing', { receiverId: userId, isTyping: true });
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setIsTyping(false);
      socketInstance?.emit('chat:typing', { receiverId: userId, isTyping: false });
    }, 1500);
  };

  const handleVideoCall = () => {
    navigate(`/video-call?partnerId=${userId}&partnerName=${encodeURIComponent(chatPartner?.name || 'User')}`);
  };

  const conversationUserIds = new Set(conversations.flatMap(c => c.participants.map(p => p._id)));
  const filtered = allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const usersWithoutConv = filtered.filter(u => !conversationUserIds.has(u._id));

  if (!currentUser) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white border border-gray-200 rounded-lg overflow-hidden animate-fade-in">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-72 border-r border-gray-200 flex-shrink-0">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Messages</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex justify-center py-8 text-gray-400"><Loader size={20} className="animate-spin" /></div>
          ) : (
            <>
              {conversations.filter(c => c.participants.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(conv => {
                const partner = conv.participants.find(p => p._id !== myId);
                if (!partner) return null;
                const isActive = userId === partner._id;
                return (
                  <div key={conv._id} onClick={() => navigate(`/chat/${partner._id}`)}
                    className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-l-4 ${isActive ? 'bg-primary-50 border-primary-600' : 'hover:bg-gray-50 border-transparent'}`}>
                    <div className="relative mr-3 flex-shrink-0">
                      <img src={partner.avatarUrl} alt={partner.name} className="w-10 h-10 rounded-full object-cover" />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${partner.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-medium text-gray-700 truncate">{partner.name}</p>
                        <span className="text-xs text-gray-400 ml-1 flex-shrink-0">{formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })}</span>
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-gray-400 truncate">
                          {conv.lastMessage.sender._id === myId ? 'You: ' : ''}{conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {usersWithoutConv.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-t mt-2 pt-3">All Users</div>
                  {usersWithoutConv.map(u => (
                    <div key={u._id} onClick={() => navigate(`/chat/${u._id}`)}
                      className={`flex items-center px-4 py-3 cursor-pointer transition-colors border-l-4 ${userId === u._id ? 'bg-primary-50 border-primary-600' : 'hover:bg-gray-50 border-transparent'}`}>
                      <div className="relative mr-3 flex-shrink-0">
                        <img src={u.avatarUrl} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${u.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {chatPartner ? (
          <>
            <div className="border-b border-gray-200 p-4 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center">
                <div className="relative mr-3">
                  <img src={chatPartner.avatarUrl} alt={chatPartner.name} className="w-10 h-10 rounded-full object-cover" />
                  <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${chatPartner.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{chatPartner.name}</h2>
                  <p className="text-xs text-gray-500">
                    {partnerTyping ? <span className="text-primary-600 animate-pulse">typing...</span> : chatPartner.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={handleVideoCall} title="Start video call"
                  className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-primary-600 transition-colors">
                  <Video size={20} />
                </button>
                <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                  <Info size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
              {loading ? (
                <div className="flex justify-center items-center h-full text-gray-400">
                  <Loader size={24} className="animate-spin mr-2" /> Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="bg-gray-100 p-4 rounded-full mb-4"><MessageCircle size={32} className="text-gray-400" /></div>
                  <h3 className="text-base font-medium text-gray-700">No messages yet</h3>
                  <p className="text-gray-400 text-sm mt-1">Say hello to {chatPartner.name}!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map(msg => {
                    const isMine = msg.sender._id === myId;
                    return (
                      <div key={msg._id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {!isMine && <img src={msg.sender.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-xs sm:max-w-md px-4 py-2 rounded-2xl text-sm ${isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white shadow-sm text-gray-800 rounded-bl-sm border border-gray-100'}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-1 px-1">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        {isMine && <img src={currentUser.avatarUrl || ''} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />}
                      </div>
                    );
                  })}
                  {partnerTyping && (
                    <div className="flex items-end gap-2">
                      <img src={chatPartner.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                      <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="border-t border-gray-200 p-4 flex items-center gap-3 flex-shrink-0">
              <input type="text" value={newMessage} onChange={e => handleTyping(e.target.value)}
                placeholder={`Message ${chatPartner.name}...`}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <button type="submit" disabled={!newMessage.trim()}
                className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="bg-gray-100 p-6 rounded-full mb-4"><MessageCircle size={48} className="text-gray-400" /></div>
            <h2 className="text-xl font-semibold text-gray-700">Select a conversation</h2>
            <p className="text-gray-400 mt-2 text-sm">Choose a contact from the list to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};
