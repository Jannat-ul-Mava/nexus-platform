import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, PlusCircle, Loader, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { userAPI, collaborationAPI, meetingAPI, paymentAPI } from '../../services/api';
import { useNavigate as useNav } from 'react-router-dom';
import toast from 'react-hot-toast';

export const InvestorDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [collaborations, setCollaborations] = useState<any[]>([]);
  const [stats, setStats] = useState({ sent: 0, accepted: 0, meetings: 0, balance: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [entRes, collabRes, meetRes, walletRes] = await Promise.all([
          userAPI.getEntrepreneurs({ limit: 8 }),
          collaborationAPI.getAll(),
          meetingAPI.getAll(),
          paymentAPI.getWallet(),
        ]);
        const collabs = collabRes.data.collaborations || [];
        setEntrepreneurs(entRes.data.users || []);
        setCollaborations(collabs);
        setStats({
          sent: collabs.length,
          accepted: collabs.filter((c: any) => c.status === 'accepted').length,
          meetings: (meetRes.data.meetings || []).filter((m: any) => new Date(m.scheduledAt) > new Date()).length,
          balance: walletRes.data.balance || 0,
        });
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleConnect = async (entrepreneurId: string) => {
    const already = collaborations.find(c => c.entrepreneur?._id === entrepreneurId);
    if (already) return toast.error('Request already sent');
    setSendingRequest(entrepreneurId);
    try {
      await collaborationAPI.send(entrepreneurId, `Hi! I'm interested in learning more about your startup. Let's connect!`);
      toast.success('Collaboration request sent!');
      setCollaborations(prev => [...prev, { entrepreneur: { _id: entrepreneurId }, status: 'pending' }]);
      setStats(s => ({ ...s, sent: s.sent + 1 }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally { setSendingRequest(null); }
  };

  if (!user) return null;

  const filtered = entrepreneurs.filter(e =>
    searchQuery === '' ||
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.startupName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.industry || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const requestedIds = new Set(collaborations.map(c => c.entrepreneur?._id));

  const statCards = [
    { label: 'Requests Sent', value: stats.sent, icon: Users, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Accepted', value: stats.accepted, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Upcoming Meetings', value: stats.meetings, icon: Calendar, color: 'text-accent-600', bg: 'bg-accent-50' },
    { label: 'Wallet Balance', value: `$${stats.balance.toFixed(2)}`, icon: DollarSign, color: 'text-secondary-600', bg: 'bg-secondary-50' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.name}</h1>
          <p className="text-gray-600">Discover and connect with promising startups</p>
        </div>
        <Link to="/entrepreneurs"><Button leftIcon={<PlusCircle size={18} />}>Browse Startups</Button></Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${s.bg}`}><s.icon size={20} className={s.color} /></div>
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  {loading ? <div className="h-6 w-10 bg-gray-200 animate-pulse rounded mt-1" /> :
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search + Entrepreneur Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Discover Startups</h2>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search startups..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-12"><Loader size={24} className="animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">{searchQuery ? 'No startups match your search' : 'No entrepreneurs registered yet'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(ent => {
                const alreadySent = requestedIds.has(ent._id);
                return (
                  <div key={ent._id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <img src={ent.avatarUrl || `https://ui-avatars.com/api/?name=${ent.name}&background=random`}
                        alt={ent.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{ent.name}</p>
                        <p className="text-sm text-primary-600 font-medium">{ent.startupName || 'Startup'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ent.industry || 'Technology'} · {ent.location || 'Remote'}</p>
                        {ent.pitchSummary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ent.pitchSummary}</p>}
                        {ent.fundingNeeded && <p className="text-xs text-green-600 font-medium mt-1">Seeking: {ent.fundingNeeded}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate(`/profile/entrepreneur/${ent._id}`)}>View Profile</Button>
                      <Button size="sm" className="flex-1"
                        isLoading={sendingRequest === ent._id}
                        disabled={alreadySent}
                        onClick={() => handleConnect(ent._id)}>
                        {alreadySent ? 'Requested' : 'Connect'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/chat/${ent._id}`)}>Chat</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
