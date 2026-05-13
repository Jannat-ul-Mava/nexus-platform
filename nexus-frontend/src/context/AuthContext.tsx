import React, { createContext, useState, useContext, useEffect } from 'react';
import { User, UserRole, AuthContextType } from '../types';
import { authAPI, userAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app load: restore session from stored token
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('nexus_access_token');
      if (token) {
        try {
          const response = await authAPI.getMe();
          const userData = response.data.user;
          setUser({ ...userData, id: userData._id || userData.id });
        } catch {
          localStorage.removeItem('nexus_access_token');
          localStorage.removeItem('nexus_refresh_token');
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authAPI.login({ email, password, role });
      const { accessToken, refreshToken, user: userData } = response.data;
      localStorage.setItem('nexus_access_token', accessToken);
      localStorage.setItem('nexus_refresh_token', refreshToken);
      setUser({ ...userData, id: userData._id || userData.id });
      toast.success('Successfully logged in!');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Login failed. Check your credentials.';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authAPI.register({ name, email, password, role });
      const { accessToken, refreshToken, user: userData } = response.data;
      localStorage.setItem('nexus_access_token', accessToken);
      localStorage.setItem('nexus_refresh_token', refreshToken);
      setUser({ ...userData, id: userData._id || userData.id });
      toast.success('Account created successfully!');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Registration failed.';
      toast.error(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    authAPI.logout().catch(() => {});
    setUser(null);
    localStorage.removeItem('nexus_access_token');
    localStorage.removeItem('nexus_refresh_token');
    toast.success('Logged out successfully');
  };

  const forgotPassword = async (email: string): Promise<void> => {
    try {
      await authAPI.forgotPassword(email);
      toast.success('Password reset instructions sent to your email');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send reset email.';
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<void> => {
    try {
      await authAPI.resetPassword(token, newPassword);
      toast.success('Password reset successfully. Please log in.');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Invalid or expired reset token.';
      toast.error(msg);
      throw new Error(msg);
    }
  };

  // Fixed: calls real API instead of mutating typed mock array
  // This resolves "not assignable to type Entrepreneur | Investor" TS error
  const updateProfile = async (_userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const response = await userAPI.updateProfile(updates);
      const updatedUser = response.data.user;
      setUser({ ...updatedUser, id: updatedUser._id || updatedUser.id });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update profile.';
      toast.error(msg);
      throw new Error(msg);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    isAuthenticated: !!user,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
