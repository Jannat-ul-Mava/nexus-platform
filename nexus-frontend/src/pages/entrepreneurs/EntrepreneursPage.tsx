import React, { useState, useEffect } from 'react';
import { Search, Loader, MessageCircle } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { userAPI, collaborationAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const EntrepreneursPage: React.FC = () => {
  const navigate = useNavigate();
  const [entrepreneurs, setEntrepreneurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const [entRes, collabRes] = await Promise.all([
          userAPI.getEntrepreneurs({ limit: 50 }),
          collaborationAPI.getAll()
        ]);
        setEntrepreneurs(entRes.data.users || []);
        const sent = new Set((collabRes.data.collaborations || []).map((c: any) => c.entrepreneur?._id));
        setSentRequests(sent);
      } catch { toast.error('Failed to load entrepreneurs'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const handleConnect = async (entrepreneurId: string) => {
    if (sentRequests.has(entrepreneurId)) return toast.error('Request already sent');
    setSendingRequest(entrepreneurId);
    try {
      await collaborationAPI.send(entrepreneurId, "Hi! I'm an investor interested in your startup. Let's connect!");
      toast.success('Collaboration request sent!');
      setSentRequests(prev => new Set([...prev, entrepreneurId]));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send request');
    } finally { setSendingRequest(null); }
  };

  const industries = [...new Set(entrepreneurs.map(e => e.industry).filter(Boolean))];

  const filtered = entrepreneurs.filter(ent => {
    const matchSearch = !searchQuery ||
      ent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ent.startupName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ent.industry || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ent.pitchSummary || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchIndustry = !selectedIndustry || ent.industry === selectedIndustry;
    return matchSearch && matchIndustry;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Startups</h1>
        <p className="text-gray-600">Discover entrepreneurs looking for investment</p>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search startups..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <select value={selectedIndustry} onChange={e => setSelectedIndustry(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Industries</option>
              {industries.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader size={28} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 font-medium">No entrepreneurs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(ent => (
            <div key={ent._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <img src={ent.avatarUrl || `https://ui-avatars.com/api/?name=${ent.name}&background=random`}
                    alt={ent.name} className="w-14 h-14 rounded-full object-cover" />
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${ent.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{ent.name}</p>
                  <p className="text-sm text-primary-600 font-medium">{ent.startupName || 'Startup'}</p>
                  <p className="text-xs text-gray-400">{ent.industry || 'Technology'} · {ent.location || 'Remote'}</p>
                </div>
              </div>
              {ent.pitchSummary && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{ent.pitchSummary}</p>}
              {ent.fundingNeeded && (
                <p className="text-xs text-green-600 font-semibold mb-3">Seeking: {ent.fundingNeeded}</p>
              )}
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-500 mb-4 py-2 border-y border-gray-100">
                <div><p className="font-semibold text-gray-900">{ent.foundedYear || '—'}</p><p>Founded</p></div>
                <div><p className="font-semibold text-gray-900">{ent.teamSize || '—'}</p><p>Team</p></div>
                <div><p className="font-semibold text-gray-900">{ent.industry || '—'}</p><p>Industry</p></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1"
                  onClick={() => navigate(`/profile/entrepreneur/${ent._id}`)}>Profile</Button>
                <Button size="sm" className="flex-1"
                  isLoading={sendingRequest === ent._id}
                  disabled={sentRequests.has(ent._id)}
                  onClick={() => handleConnect(ent._id)}>
                  {sentRequests.has(ent._id) ? '✓ Sent' : 'Connect'}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => navigate(`/chat/${ent._id}`)}>
                  <MessageCircle size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
