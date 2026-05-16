import React, { useState, useRef } from 'react';
import { User, Lock, Bell, Globe, Palette, CreditCard, Camera, Loader } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { userAPI, authAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const SettingsPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    location: user?.location || '',
    website: user?.website || '',
    linkedIn: user?.linkedIn || '',
    startupName: (user as any)?.startupName || '',
    industry: (user as any)?.industry || '',
    fundingNeeded: (user as any)?.fundingNeeded || '',
    firmName: (user as any)?.firmName || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });

  if (!user) return null;

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(user.id || (user as any)._id, profileForm);
    } catch {}
    finally { setSaving(false); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
    setUploadingAvatar(true);
    try {
      await userAPI.uploadAvatar(file);
      toast.success('Avatar updated!');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to upload avatar');
    } finally { setUploadingAvatar(false); }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword) return toast.error('Enter your current password');
    if (passwordForm.newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/.test(passwordForm.newPassword))
      return toast.error('Password needs uppercase, lowercase and a number');
    if (passwordForm.newPassword !== passwordForm.confirmPassword)
      return toast.error('Passwords do not match');
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      toast.success('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  };

  const navItems = [
    { id: 'profile',  icon: User,       label: 'Profile' },
    { id: 'security', icon: Lock,       label: 'Security' },
    { id: 'notifications', icon: Bell,  label: 'Notifications' },
  ];

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Nav */}
        <Card className="lg:col-span-1 h-fit">
          <CardBody className="p-2">
            <nav className="space-y-1">
              {navItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === item.id ? 'text-primary-700 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'
                  }`}>
                  <item.icon size={18} className="mr-3" />
                  {item.label}
                </button>
              ))}
            </nav>
          </CardBody>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader><h2 className="text-lg font-medium text-gray-900">Profile Settings</h2></CardHeader>
              <CardBody className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <img src={user.avatarUrl || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                      alt={user.name} className="w-16 h-16 rounded-full object-cover" />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <Loader size={16} className="animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    <Button variant="outline" size="sm" leftIcon={<Camera size={14} />}
                      onClick={() => avatarInputRef.current?.click()} isLoading={uploadingAvatar}>
                      Change Photo
                    </Button>
                    <p className="mt-1 text-xs text-gray-500">JPG, PNG or GIF. Max 5MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                      className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input value={profileForm.location} onChange={e => setProfileForm(p => ({ ...p, location: e.target.value }))}
                      placeholder="City, Country" className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({ ...p, bio: e.target.value }))}
                      rows={3} placeholder="Tell investors about yourself..." className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input value={profileForm.website} onChange={e => setProfileForm(p => ({ ...p, website: e.target.value }))}
                      placeholder="https://yoursite.com" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                    <input value={profileForm.linkedIn} onChange={e => setProfileForm(p => ({ ...p, linkedIn: e.target.value }))}
                      placeholder="https://linkedin.com/in/you" className={inputClass} />
                  </div>

                  {user.role === 'entrepreneur' && (<>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Startup Name</label>
                      <input value={profileForm.startupName} onChange={e => setProfileForm(p => ({ ...p, startupName: e.target.value }))}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                      <input value={profileForm.industry} onChange={e => setProfileForm(p => ({ ...p, industry: e.target.value }))}
                        placeholder="FinTech, HealthTech..." className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Funding Needed</label>
                      <input value={profileForm.fundingNeeded} onChange={e => setProfileForm(p => ({ ...p, fundingNeeded: e.target.value }))}
                        placeholder="$500K" className={inputClass} />
                    </div>
                  </>)}

                  {user.role === 'investor' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Firm Name</label>
                      <input value={profileForm.firmName} onChange={e => setProfileForm(p => ({ ...p, firmName: e.target.value }))}
                        className={inputClass} />
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div>
                    <p className="text-sm text-gray-500">Email: <strong>{user.email}</strong></p>
                    <p className="text-sm text-gray-500">Role: <strong className="capitalize">{user.role}</strong></p>
                  </div>
                  <Button onClick={handleSaveProfile} isLoading={saving}>Save Changes</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader><h2 className="text-lg font-medium text-gray-900">Security Settings</h2></CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                    className={inputClass} placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                    className={inputClass} placeholder="Min 8 chars, uppercase, number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input type="password" value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    className={inputClass} placeholder="Repeat new password" />
                </div>
                <div className="pt-2">
                  <Button onClick={handleChangePassword} isLoading={saving}>Update Password</Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader><h2 className="text-lg font-medium text-gray-900">Notification Preferences</h2></CardHeader>
              <CardBody className="space-y-4">
                {[
                  { label: 'Meeting invitations', desc: 'When someone schedules a meeting with you' },
                  { label: 'Collaboration requests', desc: 'When an investor wants to collaborate' },
                  { label: 'Document shared', desc: 'When someone shares a document with you' },
                  { label: 'Payment received', desc: 'When you receive a payment or transfer' },
                  { label: 'New messages', desc: 'When you receive a new chat message' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-5 peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>
                ))}
                <Button className="mt-2">Save Preferences</Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
