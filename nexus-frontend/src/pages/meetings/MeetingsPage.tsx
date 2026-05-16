import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, Plus, Check, X, Users, Loader, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { meetingAPI, userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface Participant { _id: string; name: string; avatarUrl: string; role: string; }
interface Meeting {
  _id: string;
  title: string;
  description: string;
  scheduledAt: string;
  duration: number;
  type: string;
  status: string;
  organizer: Participant;
  participants: Participant[];
  roomId: string;
  responses: { user: { _id: string }; status: string }[];
}

const statusColor: Record<string, 'success' | 'warning' | 'error' | 'secondary' | 'primary'> = {
  accepted: 'success', completed: 'success',
  pending: 'warning', cancelled: 'error', rejected: 'error'
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const isUpcoming = (d: string) => new Date(d) > new Date();

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<Participant[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', scheduledAt: '', duration: 30,
    type: 'video', participants: [] as string[]
  });

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const res = await meetingAPI.getAll();
      setMeetings(res.data.meetings);
    } catch {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await userAPI.getAll({ limit: 50 });
      setUsers(res.data.users.filter((u: Participant) => u._id !== (user?._id || user?.id)));
    } catch {}
  };

  useEffect(() => { fetchMeetings(); fetchUsers(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return toast.error('Meeting title is required');
    if (!form.scheduledAt) return toast.error('Please select a date and time');
    if (form.participants.length === 0) return toast.error('Add at least one participant');
    if (new Date(form.scheduledAt) <= new Date()) return toast.error('Please select a future date and time');

    setCreating(true);
    try {
      await meetingAPI.create({
        title: form.title,
        description: form.description,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        duration: form.duration,
        type: form.type,
        participants: form.participants
      });
      toast.success('Meeting scheduled! Invites sent.');
      setShowModal(false);
      setForm({ title: '', description: '', scheduledAt: '', duration: 30, type: 'video', participants: [] });
      fetchMeetings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setCreating(false);
    }
  };

  const handleRespond = async (meetingId: string, status: 'accepted' | 'rejected') => {
    try {
      await meetingAPI.respond(meetingId, status);
      toast.success(`Meeting ${status}`);
      fetchMeetings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to respond');
    }
  };

  const handleCancel = async (meetingId: string) => {
    if (!confirm('Cancel this meeting?')) return;
    try {
      await meetingAPI.cancel(meetingId);
      toast.success('Meeting cancelled');
      fetchMeetings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const handleJoinCall = async (meetingId: string) => {
    try {
      const res = await meetingAPI.getRoom(meetingId);
      const { roomId } = res.data;
      window.open(`/chat?room=${roomId}`, '_blank');
      toast.success('Joining video call...');
    } catch {
      toast.error('Could not join call');
    }
  };

  const toggleParticipant = (uid: string) => {
    setForm(p => ({
      ...p,
      participants: p.participants.includes(uid)
        ? p.participants.filter(id => id !== uid)
        : [...p.participants, uid]
    }));
  };

  const myId = user?._id || user?.id;

  const filteredMeetings = meetings.filter(m => {
    const upcoming = isUpcoming(m.scheduledAt);
    const myResponse = m.responses?.find(r => r.user._id === myId);
    const isPending = myResponse?.status === 'pending' && !m.organizer._id.equals?.(myId) && upcoming;
    if (tab === 'upcoming') return upcoming && m.status !== 'cancelled' && m.status !== 'rejected';
    if (tab === 'pending') return myResponse?.status === 'pending' && m.organizer._id !== myId && upcoming;
    if (tab === 'past') return !upcoming || m.status === 'cancelled' || m.status === 'completed';
    return true;
  });

  // Count pending invites
  const pendingCount = meetings.filter(m => {
    const r = m.responses?.find(r => r.user._id === myId);
    return r?.status === 'pending' && m.organizer._id !== myId && isUpcoming(m.scheduledAt);
  }).length;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Minimum datetime for input (now)
  const minDateTime = new Date(Date.now() + 15 * 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600">Schedule and manage your pitch meetings</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => setShowModal(true)}>
          Schedule Meeting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: meetings.filter(m => isUpcoming(m.scheduledAt) && m.status !== 'cancelled').length, icon: Calendar, color: 'bg-primary-100 text-primary-600' },
          { label: 'Pending Invites', value: pendingCount, icon: Clock, color: 'bg-warning-100 text-warning-700' },
          { label: 'Total Meetings', value: meetings.length, icon: Users, color: 'bg-secondary-100 text-secondary-600' }
        ].map(stat => (
          <Card key={stat.label}>
            <CardBody>
              <div className="flex items-center">
                <div className={`p-3 rounded-lg mr-3 ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {(['upcoming', 'pending', 'past'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors ${
                tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}{t === 'pending' && pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-warning-100 text-warning-700 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Meeting List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader size={24} className="animate-spin mr-2" /> Loading meetings...
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No {tab} meetings</p>
            {tab === 'upcoming' && (
              <Button className="mt-4" leftIcon={<Plus size={16} />} onClick={() => setShowModal(true)}>
                Schedule your first meeting
              </Button>
            )}
          </div>
        ) : (
          filteredMeetings.map(meeting => {
            const isOrganizer = meeting.organizer._id === myId;
            const myResponse = meeting.responses?.find(r => r.user._id === myId);
            const upcoming = isUpcoming(meeting.scheduledAt);
            const canJoin = meeting.status === 'accepted' && meeting.type === 'video' && upcoming;
            const needsResponse = myResponse?.status === 'pending' && !isOrganizer;

            return (
              <Card key={meeting._id} className={needsResponse ? 'border-l-4 border-warning-400' : ''}>
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-primary-50 rounded-lg flex-shrink-0">
                        {meeting.type === 'video' ? <Video size={20} className="text-primary-600" /> : <Calendar size={20} className="text-primary-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">{meeting.title}</h3>
                          <Badge variant={statusColor[meeting.status] || 'secondary'} size="sm">
                            {meeting.status}
                          </Badge>
                          {isOrganizer && <Badge variant="gray" size="sm">Organizer</Badge>}
                        </div>
                        {meeting.description && (
                          <p className="text-sm text-gray-500 mt-1 truncate">{meeting.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} /> {formatDate(meeting.scheduledAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} /> {formatTime(meeting.scheduledAt)} · {meeting.duration} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={14} /> {meeting.participants.length + 1} people
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-gray-400">With:</span>
                          {[meeting.organizer, ...meeting.participants].filter(p => p._id !== myId).slice(0, 3).map(p => (
                            <span key={p._id} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                              {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {canJoin && (
                        <Button size="sm" leftIcon={<Video size={14} />} onClick={() => handleJoinCall(meeting._id)}>
                          Join Call
                        </Button>
                      )}
                      {needsResponse && upcoming && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="success" leftIcon={<Check size={14} />}
                            onClick={() => handleRespond(meeting._id, 'accepted')}>
                            Accept
                          </Button>
                          <Button size="sm" variant="error" leftIcon={<X size={14} />}
                            onClick={() => handleRespond(meeting._id, 'rejected')}>
                            Reject
                          </Button>
                        </div>
                      )}
                      {isOrganizer && upcoming && meeting.status !== 'cancelled' && (
                        <Button size="sm" variant="outline" onClick={() => handleCancel(meeting._id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>

      {/* Schedule Meeting Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Meeting</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Q1 2026 Pitch Meeting"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Meeting agenda or notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
                  <input type="datetime-local" value={form.scheduledAt} min={minDateTime}
                    onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select value={form.duration}
                    onChange={e => setForm(p => ({ ...p, duration: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {[15, 30, 45, 60, 90, 120].map(d => (
                      <option key={d} value={d}>{d} minutes</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Type</label>
                <div className="flex gap-3">
                  {['video', 'in-person', 'phone'].map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="type" value={t} checked={form.type === t}
                        onChange={() => setForm(p => ({ ...p, type: t }))} className="text-primary-600" />
                      <span className="text-sm capitalize text-gray-700">{t}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participants * ({form.participants.length} selected)
                </label>
                <input type="text" placeholder="Search users..." value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                />
                <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-3">No users found</p>
                  ) : filteredUsers.map(u => (
                    <label key={u._id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                      <input type="checkbox" checked={form.participants.includes(u._id)}
                        onChange={() => toggleParticipant(u._id)} className="rounded text-primary-600" />
                      <img src={u.avatarUrl} alt={u.name} className="w-6 h-6 rounded-full object-cover" />
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400 capitalize ml-auto">{u.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t sticky bottom-0 bg-white">
              <Button variant="outline" fullWidth onClick={() => setShowModal(false)}>Cancel</Button>
              <Button fullWidth isLoading={creating} onClick={handleCreate} leftIcon={<Calendar size={16} />}>
                Schedule Meeting
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
