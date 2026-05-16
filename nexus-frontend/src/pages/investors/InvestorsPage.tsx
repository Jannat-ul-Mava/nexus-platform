import React, { useState, useEffect } from 'react';
import { Search, Loader, MessageCircle, Calendar } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import toast from 'react-hot-toast';

export const InvestorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await userAPI.getInvestors({ limit: 50 });
        setInvestors(res.data.users || []);
      } catch { toast.error('Failed to load investors'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth'];

  const filtered = investors.filter(inv => {
    const matchSearch = !searchQuery ||
      inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.bio || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.firmName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.investmentInterests || []).some((i: string) => i.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchStage = !selectedStage || (inv.investmentStage || []).includes(selectedStage);
    return matchSearch && matchStage;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Find Investors</h1>
        <p className="text-gray-600">Connect with investors who match your startup's needs</p>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, interests..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">All Stages</option>
              {stages.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(searchQuery || selectedStage) && (
              <button onClick={() => { setSearchQuery(''); setSelectedStage(''); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline">Clear filters</button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader size={28} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 font-medium">No investors found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(inv => (
            <div key={inv._id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="relative">
                  <img src={inv.avatarUrl || `https://ui-avatars.com/api/?name=${inv.name}&background=random`}
                    alt={inv.name} className="w-14 h-14 rounded-full object-cover" />
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${inv.isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{inv.name}</p>
                  <p className="text-sm text-gray-500">{inv.firmName || 'Independent Investor'}</p>
                  {inv.location && <p className="text-xs text-gray-400 mt-0.5">{inv.location}</p>}
                </div>
              </div>
              {inv.bio && <p className="text-sm text-gray-600 line-clamp-2 mb-3">{inv.bio}</p>}
              {inv.investmentInterests?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {inv.investmentInterests.slice(0, 3).map((i: string) => (
                    <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">{i}</span>
                  ))}
                </div>
              )}
              {inv.investmentStage?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {inv.investmentStage.slice(0, 3).map((s: string) => (
                    <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1"
                  onClick={() => navigate(`/profile/investor/${inv._id}`)}>Profile</Button>
                <Button size="sm" className="flex-1"
                  leftIcon={<MessageCircle size={14} />}
                  onClick={() => navigate(`/chat/${inv._id}`)}>Message</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
