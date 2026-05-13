// src/services/api.ts
// Drop this file into the Nexus frontend src/services/ directory

import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: handle token expiry ─────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('nexus_refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh-token`, { refreshToken });
          const { accessToken } = res.data;
          localStorage.setItem('nexus_access_token', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: object) => api.post('/auth/register', data),
  login: (data: object) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.patch(`/auth/reset-password/${token}`, { password }),
  changePassword: (data: object) => api.patch('/auth/change-password', data),
  verifyOTP: (userId: string, otp: string) => api.post('/auth/verify-otp', { userId, otp }),
  toggle2FA: () => api.patch('/auth/toggle-2fa'),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const userAPI = {
  getAll: (params?: object) => api.get('/users', { params }),
  getInvestors: (params?: object) => api.get('/users/investors', { params }),
  getEntrepreneurs: (params?: object) => api.get('/users/entrepreneurs', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  updateProfile: (data: object) => api.patch('/users/me', data),
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    return api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deactivate: () => api.delete('/users/me'),
};

// ── Meetings ──────────────────────────────────────────────────────────────────
export const meetingAPI = {
  create: (data: object) => api.post('/meetings', data),
  getAll: (params?: object) => api.get('/meetings', { params }),
  getById: (id: string) => api.get(`/meetings/${id}`),
  getRoom: (id: string) => api.get(`/meetings/${id}/room`),
  respond: (id: string, status: 'accepted' | 'rejected', message?: string) =>
    api.patch(`/meetings/${id}/respond`, { status, message }),
  cancel: (id: string) => api.patch(`/meetings/${id}/cancel`),
};

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentAPI = {
  upload: (file: File, meta: object) => {
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(meta).forEach(([k, v]) =>
      fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
    );
    return api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getAll: (params?: object) => api.get('/documents', { params }),
  getById: (id: string) => api.get(`/documents/${id}`),
  uploadVersion: (id: string, file: File, changeNote?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (changeNote) fd.append('changeNote', changeNote);
    return api.post(`/documents/${id}/version`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  sign: (id: string, signatureImage: File) => {
    const fd = new FormData();
    fd.append('signature', signatureImage);
    return api.post(`/documents/${id}/sign`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  share: (id: string, userIds: string[]) => api.post(`/documents/${id}/share`, { userIds }),
  delete: (id: string) => api.delete(`/documents/${id}`),
};

// ── Payments ──────────────────────────────────────────────────────────────────
export const paymentAPI = {
  getWallet: () => api.get('/payments/wallet'),
  getTransactions: (params?: object) => api.get('/payments/transactions', { params }),
  deposit: (amount: number) => api.post('/payments/deposit', { amount, type: 'deposit' }),
  confirmDeposit: (transactionId: string) => api.patch(`/payments/deposit/${transactionId}/confirm`),
  withdraw: (amount: number, bankDetails?: object) =>
    api.post('/payments/withdrawal', { amount, type: 'withdrawal', bankDetails }),
  transfer: (recipientId: string, amount: number, description?: string, dealId?: string) =>
    api.post('/payments/transfer', { recipientId, amount, description, dealId }),
};

// ── Collaborations ────────────────────────────────────────────────────────────
export const collaborationAPI = {
  send: (entrepreneurId: string, message: string) =>
    api.post('/collaborations', { entrepreneurId, message }),
  getAll: () => api.get('/collaborations'),
  respond: (id: string, status: 'accepted' | 'rejected', responseMessage?: string) =>
    api.patch(`/collaborations/${id}/respond`, { status, responseMessage }),
};

// ── Messages ──────────────────────────────────────────────────────────────────
export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId: string, page?: number) =>
    api.get(`/messages/${userId}`, { params: { page } }),
  send: (receiverId: string, content: string, type = 'text') =>
    api.post('/messages', { receiverId, content, type }),
  markAsRead: (senderId: string) => api.patch(`/messages/read/${senderId}`),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll: (params?: object) => api.get('/notifications', { params }),
  markAsRead: (notificationIds?: string[]) =>
    api.patch('/notifications/read', { notificationIds }),
  delete: (id: string) => api.delete(`/notifications/${id}`),
};

export default api;
