import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Bell, Calendar, TrendingUp, PlusCircle, Loader, DollarSign, FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { collaborationAPI, meetingAPI, userAPI, paymentAPI, notificationAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export const EntrepreneurDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pending: 0, connections: 0, meetings: 0, balance: 0 });
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [collabRes, usersRes, meetingsRes, walletRes, notifRes] = await Promise.all([
          collaborationAPI.getAll(),
          userAPI.getInvestors({ limit: 4 }),
          meetingAPI.getAll({ status: 'accepted' }),
          paymentAPI.getWallet(),
          notificationAPI.getAll({ limit: 5 }),
        ]);
        const collabs = collabRes.data.collaborations || [];
        setCollaborations(collabs);
        setInvestors(usersRes.data.users || []);
        setNotifications(notifRes.data.notifications || []);
        setStats({
          pending: collabs.filter((c: any) => c.status === 'pending').length,
          connections: collabs.filter((c: any) => c.status === 'accepted').length,
          meetings: (meetingsRes.data.meetings || []).filter((m: any) => new Date(m.scheduledAt) > new Date()).length,
          balance: walletRes.data.balance || 0,
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleCollabRespond = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await collaborationAPI.respond(id, status);
      toast.success(`Request ${status}`);
      setCollaborations(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      if (status === 'accepted') setStats(s => ({ ...s, connections: s.connections + 1, pending: s.pending - 1 }));
      else setStats(s => ({ ...s, pending: s.pending - 1 }));
    } catch { toast.error('Failed to respond'); }
  };

  if (!user) return null;

  const statCards = [
    { label: 'Pending Requests', value: stats.pending, icon: Bell, color: 'bg-primary-50 text-primary-600', border: 'border-primary-100' },
    { label: 'Total Connections', value: stats.connections, icon: Users, color: 'bg-secondary-50 text-secondary-600', border: 'border-secondary-100' },
    { label: 'Upcoming Meetings', value: stats.meetings, icon: Calendar, color: 'bg-accent-50 text-accent-600', border: 'border-accent-100' },
    { label: 'Wallet Balance', value: `$${stats.balance.toFixed(2)}`, icon: DollarSign, color: 'bg-green-50 text-green-600', border: 'border-green-100' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
          <p className="text-gray-600">Here's what's happening with your startup today</p>
        </div>
        <Link to="/investors"><Button leftIcon={<PlusCircle size={18} />}>Find Investors</Button></Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className={`bg-opacity-50 border ${s.border}`}>
            <CardBody>
              <div className="flex items-center">
                <div className={`p-3 rounded-lg mr-3 ${s.color} bg-opacity-20`}>
                  <s.icon size={22} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{s.label}</p>
                  {loading ? <div className="h-7 w-12 bg-gray-200 animate-pulse rounded mt-1" /> :
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Collaboration Requests */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Collaboration Requests</h2>
                <Badge variant={stats.pending > 0 ? 'warning' : 'secondary'}>{stats.pending} pending</Badge>
              </div>
            </CardHeader>
            <CardBody>
              {loading ? (
                <div className="flex justify-center py-8"><Loader size={24} className="animate-spin text-gray-400" /></div>
              ) : collaborations.filter(c => c.status === 'pending').length === 0 ? (
                <div className="text-center py-10">
                  <Users size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No pending requests</p>
                  <p className="text-gray-400 text-sm mt-1">Investors who want to collaborate will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {collaborations.filter(c => c.status === 'pending').map(collab => (
                    <div key={collab._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <img src={collab.investor?.avatarUrl || `https://ui-avatars.com/api/?name=${collab.investor?.name}&background=random`}
                          alt={collab.investor?.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{collab.investor?.name}</p>
                          <p className="text-sm text-gray-500 capitalize">{collab.investor?.role} {collab.investor?.firmName ? `· ${collab.investor.firmName}` : ''}</p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{collab.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(collab.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleCollabRespond(collab._id, 'accepted')} className="flex-1">Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => handleCollabRespond(collab._id, 'rejected')} className="flex-1">Decline</Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/chat/${collab.investor?._id}`)}>Message</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Recommended Investors */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Recommended Investors</h2>
                <Link to="/investors" className="text-sm text-primary-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader size={24} className="animate-spin text-gray-400" /></div>
              ) : investors.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 text-sm">No investors registered yet</p>
                  <Link to="/investors" className="text-primary-600 text-sm hover:underline mt-1 block">Browse investors</Link>
                </div>
              ) : (
                investors.map(inv => (
                  <div key={inv._id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <img src={inv.avatarUrl || `https://ui-avatars.com/api/?name=${inv.name}&background=random`}
                      alt={inv.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.name}</p>
                      <p className="text-xs text-gray-500 truncate">{inv.firmName || 'Independent Investor'}</p>
                      {inv.investmentInterests?.slice(0, 2).map((i: string) => (
                        <span key={i} className="inline-block text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded mr-1 mt-1">{i}</span>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/chat/${inv._id}`)}>Chat</Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* Recent Notifications */}
          <Card className="mt-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <Link to="/notifications" className="text-sm text-primary-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardBody>
              {notifications.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {notifications.slice(0, 4).map(n => (
                    <div key={n._id} className={`flex items-start gap-2 ${!n.isRead ? 'font-medium' : ''}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? 'bg-primary-600' : 'bg-gray-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700 truncate">{n.message}</p>
                        <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
