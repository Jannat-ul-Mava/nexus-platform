import React, { useState, useEffect } from 'react';
import { Bell, MessageCircle, UserPlus, DollarSign, FileText, Calendar, Check, Trash2, Loader } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { notificationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

const getIcon = (type: string) => {
  if (type.includes('message'))      return <MessageCircle size={18} className="text-primary-600" />;
  if (type.includes('meeting'))      return <Calendar size={18} className="text-secondary-600" />;
  if (type.includes('payment'))      return <DollarSign size={18} className="text-accent-600" />;
  if (type.includes('document') || type.includes('signature')) return <FileText size={18} className="text-purple-600" />;
  if (type.includes('collaboration')) return <UserPlus size={18} className="text-green-600" />;
  return <Bell size={18} className="text-gray-500" />;
};

export const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationAPI.getAll();
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to mark as read'); }
  };

  const handleMarkOne = async (id: string) => {
    try {
      await notificationAPI.markAsRead([id]);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationAPI.delete(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with your network activity</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" leftIcon={<Check size={16} />} onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-16 text-gray-400">
              <Loader size={24} className="animate-spin mr-2" /> Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="bg-gray-100 p-4 rounded-full mb-4"><Bell size={32} className="text-gray-400" /></div>
              <h3 className="text-base font-medium text-gray-700">No notifications yet</h3>
              <p className="text-gray-400 text-sm mt-1">You'll see activity from your network here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map(n => (
                <div key={n._id}
                  className={`flex items-start gap-4 p-4 transition-colors ${!n.isRead ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                  <div className={`p-2 rounded-full flex-shrink-0 ${!n.isRead ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <button onClick={() => handleMarkOne(n._id)}
                        className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
                        title="Mark as read">
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(n._id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete">
                      <Trash2 size={14} />
                    </button>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0 ml-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
