import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, Loader, X, Send } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { paymentAPI, userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface Transaction {
  _id: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  sender?: { _id: string; name: string; avatarUrl: string };
  recipient?: { _id: string; name: string; avatarUrl: string };
  createdAt: string;
}

interface User { _id: string; name: string; avatarUrl: string; role: string; }

const statusColor: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
  completed: 'success', pending: 'warning', failed: 'error', refunded: 'secondary'
};

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'deposit' | 'withdraw' | 'transfer' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [amount, setAmount] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [description, setDescription] = useState('');
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  const myId = user?._id || (user as any)?.id;

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const res = await paymentAPI.getWallet();
      setBalance(res.data.balance || 0);
      setTransactions(res.data.transactions || []);
    } catch { toast.error('Failed to load wallet'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await userAPI.getAll({ limit: 50 });
      setUsers((res.data.users || []).filter((u: User) => u._id !== myId));
    } catch {}
  };

  useEffect(() => { fetchWallet(); fetchUsers(); }, []);

  const closeModal = () => { setModal(null); setAmount(''); setRecipientId(''); setDescription(''); };

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) return toast.error('Minimum deposit is $1');
    setProcessing(true);
    try {
      const res = await paymentAPI.deposit(amt);
      // confirm immediately in mock/sandbox mode
      if (res.data.transactionId) {
        await paymentAPI.confirmDeposit(res.data.transactionId);
      }
      toast.success(`$${amt.toFixed(2)} deposited to your wallet!`);
      closeModal();
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Deposit failed');
    } finally { setProcessing(false); }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) return toast.error('Minimum withdrawal is $1');
    if (amt > balance) return toast.error(`Insufficient balance. Available: $${balance.toFixed(2)}`);
    setProcessing(true);
    try {
      await paymentAPI.withdraw(amt);
      toast.success(`$${amt.toFixed(2)} withdrawal initiated!`);
      closeModal();
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Withdrawal failed');
    } finally { setProcessing(false); }
  };

  const handleTransfer = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 1) return toast.error('Minimum transfer is $1');
    if (!recipientId) return toast.error('Please select a recipient');
    if (amt > balance) return toast.error(`Insufficient balance. Available: $${balance.toFixed(2)}`);
    setProcessing(true);
    try {
      await paymentAPI.transfer(recipientId, amt, description);
      toast.success(`$${amt.toFixed(2)} transferred successfully!`);
      closeModal();
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    } finally { setProcessing(false); }
  };

  const filteredTx = transactions.filter(tx => filter === 'all' ? true : tx.type === filter);

  const totalIn = transactions
    .filter(tx => tx.status === 'completed' && (tx.type === 'deposit' || tx.recipient?._id === myId))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOut = transactions
    .filter(tx => tx.status === 'completed' && (tx.type === 'withdrawal' || (tx.type === 'transfer' && tx.sender?._id === myId)))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const getTxSign = (tx: Transaction) => {
    const isSender = tx.sender?._id === myId;
    const positive = tx.type === 'deposit' || (!isSender && tx.type === 'transfer');
    return positive ? '+' : '-';
  };

  const getTxColor = (tx: Transaction) => {
    const isSender = tx.sender?._id === myId;
    const positive = tx.type === 'deposit' || (!isSender && tx.type === 'transfer');
    return positive ? 'text-green-600' : 'text-red-600';
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Manage your wallet and transactions</p>
        </div>
        <Button leftIcon={<RefreshCw size={16} />} variant="outline" onClick={fetchWallet}>Refresh</Button>
      </div>

      {/* Wallet Card */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-primary-200 text-sm font-medium">Wallet Balance</p>
            {loading ? (
              <div className="flex items-center gap-2 mt-1"><Loader size={20} className="animate-spin" /><span className="text-2xl">Loading...</span></div>
            ) : (
              <p className="text-4xl font-bold mt-1">${balance.toFixed(2)}</p>
            )}
            <p className="text-primary-200 text-xs mt-1">Available for transfers</p>
          </div>
          <div className="p-4 bg-white bg-opacity-20 rounded-2xl"><DollarSign size={32} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => setModal('deposit')}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors">
            <Plus size={16} /> Deposit
          </button>
          <button onClick={() => setModal('withdraw')}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white bg-opacity-20 text-white border border-white border-opacity-30 rounded-lg text-sm font-medium hover:bg-opacity-30 transition-colors">
            <ArrowUpRight size={16} /> Withdraw
          </button>
          <button onClick={() => setModal('transfer')}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-white bg-opacity-20 text-white border border-white border-opacity-30 rounded-lg text-sm font-medium hover:bg-opacity-30 transition-colors">
            <Send size={16} /> Transfer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg"><ArrowDownLeft size={20} className="text-green-600" /></div>
            <div><p className="text-sm text-gray-600">Total Received</p><p className="text-xl font-semibold text-green-600">${totalIn.toFixed(2)}</p></div>
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-lg"><ArrowUpRight size={20} className="text-red-500" /></div>
            <div><p className="text-sm text-gray-600">Total Sent</p><p className="text-xl font-semibold text-red-600">${totalOut.toFixed(2)}</p></div>
          </div>
        </CardBody></Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-medium text-gray-900">Transaction History</h2>
            <div className="flex gap-2">
              {(['all', 'deposit', 'withdrawal', 'transfer'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${filter === f ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-400"><Loader size={24} className="animate-spin mr-2" /> Loading...</div>
          ) : filteredTx.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No transactions yet</p>
              <Button className="mt-4" leftIcon={<Plus size={16} />} onClick={() => setModal('deposit')}>Make First Deposit</Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTx.map(tx => (
                <div key={tx._id} className="flex items-center gap-4 py-4">
                  <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                    {tx.type === 'deposit' ? <ArrowDownLeft size={16} className="text-green-600" /> :
                     tx.type === 'withdrawal' ? <ArrowUpRight size={16} className="text-red-500" /> :
                     tx.sender?._id === myId ? <ArrowUpRight size={16} className="text-red-500" /> :
                     <ArrowDownLeft size={16} className="text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {tx.description || `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                      {tx.type === 'transfer' && tx.sender && tx.recipient && (
                        <span className="ml-2">
                          {tx.sender._id === myId ? `→ ${tx.recipient.name}` : `← ${tx.sender.name}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`font-semibold ${getTxColor(tx)}`}>
                      {getTxSign(tx)}${tx.amount.toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                      tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Deposit Modal */}
      {modal === 'deposit' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-semibold">Deposit Funds</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                Sandbox mode — no real money involved.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input type="number" min="1" step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[100, 500, 1000, 5000].map(a => (
                  <button key={a} onClick={() => setAmount(String(a))}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-primary-50 hover:border-primary-300 hover:text-primary-700 transition-colors">
                    ${a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <Button variant="outline" fullWidth onClick={closeModal}>Cancel</Button>
              <Button fullWidth isLoading={processing} onClick={handleDeposit}>
                Deposit ${parseFloat(amount || '0').toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {modal === 'withdraw' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-semibold">Withdraw Funds</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between text-sm">
                <span className="text-gray-600">Available Balance</span>
                <span className="font-semibold">${balance.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input type="number" min="1" max={balance} step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <button onClick={() => setAmount(String(balance))} className="text-xs text-primary-600 hover:underline">
                Withdraw all (${balance.toFixed(2)})
              </button>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <Button variant="outline" fullWidth onClick={closeModal}>Cancel</Button>
              <Button fullWidth isLoading={processing} onClick={handleWithdraw}>
                Withdraw ${parseFloat(amount || '0').toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {modal === 'transfer' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-lg font-semibold">Transfer Funds</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg flex justify-between text-sm">
                <span className="text-gray-600">Available Balance</span>
                <span className="font-semibold">${balance.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient *</label>
                <select value={recipientId} onChange={e => setRecipientId(e.target.value)} className={inputClass}>
                  <option value="">Select user...</option>
                  {users.map(u => (
                    <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input type="number" min="1" max={balance} step="0.01" value={amount}
                    onChange={e => setAmount(e.target.value)} placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Seed investment for TechWave AI" className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t">
              <Button variant="outline" fullWidth onClick={closeModal}>Cancel</Button>
              <Button fullWidth isLoading={processing} onClick={handleTransfer}>
                Transfer ${parseFloat(amount || '0').toFixed(2)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
