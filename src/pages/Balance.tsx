import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Clock, Copy, CheckCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Transaction {
  id: number;
  user_id: number;
  amount: string | number;
  type: 'credit' | 'debit';
  description: string | null;
  created_at: string;
}

interface PaymentAddress {
  id: number;
  label: string;
  address: string;
  type: string;
}

export default function Balance() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentAddresses, setPaymentAddresses] = useState<PaymentAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchTransactions();
    fetchPaymentAddresses();
  }, []);

  const fetchPaymentAddresses = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/payment-addresses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentAddresses(data);
      }
    } catch (error) {
      console.error('Failed to fetch payment addresses', error);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalCredits = transactions
    .filter(t => t.type === 'credit')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalDebits = transactions
    .filter(t => t.type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6 pl-14 sm:pl-16">
      <div className="max-w-full mx-auto space-y-4 sm:space-y-6">
        {/* Balance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-4 sm:p-6 text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
              <p className="text-green-100 text-xs sm:text-sm font-medium">Current Balance</p>
            </div>
            <p className="text-3xl sm:text-4xl font-bold">${user?.balance.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-4 sm:p-6 text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
              <p className="text-blue-100 text-xs sm:text-sm font-medium">Total Credits</p>
            </div>
            <p className="text-3xl sm:text-4xl font-bold">${totalCredits.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-2xl p-4 sm:p-6 text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
              <p className="text-orange-100 text-xs sm:text-sm font-medium">Total Spent</p>
            </div>
            <p className="text-3xl sm:text-4xl font-bold">${totalDebits.toFixed(2)}</p>
          </div>
        </div>

        {/* Deposit Instructions */}
        {paymentAddresses.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 sm:px-6 py-3 sm:py-4">
              <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                Deposit — Send Payment To
              </h3>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paymentAddresses.map((pa) => (
                <div key={pa.id} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{pa.type} — {pa.label}</p>
                    <p className="text-sm sm:text-base font-mono font-semibold text-slate-800 truncate">{pa.address}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(pa.address, pa.id)}
                    className="shrink-0 p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
                    title="Copy address"
                  >
                    {copiedId === pa.id ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
            <p className="px-4 sm:px-6 pb-4 text-xs text-slate-400">After sending, contact the admin with your receipt to get your balance credited.</p>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4">
            <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              Transaction History
            </h3>
          </div>

          {loading ? (
            <div className="p-8 sm:p-12 text-center">
              <div className="inline-block w-10 h-10 sm:w-12 sm:h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-600 mt-4 text-sm sm:text-base">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 text-base sm:text-lg">No transactions yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-700">Date</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-700">Description</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-slate-700">Type</th>
                    <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-xs sm:text-sm font-semibold text-slate-700">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-slate-800">
                        {transaction.description || 'No description'}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        {transaction.type === 'credit' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            <TrendingUp className="w-3 h-3" />
                            Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            <TrendingDown className="w-3 h-3" />
                            Debit
                          </span>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                        <span className={`text-sm sm:text-base font-bold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {transaction.type === 'credit' ? '+' : '-'}${parseFloat(transaction.amount.toString()).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 sm:p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-slate-600 text-xs sm:text-sm">Total Transactions</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800">{transactions.length}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-600 text-xs sm:text-sm">Net Change</p>
                <p className={`text-xl sm:text-2xl font-bold ${totalCredits - totalDebits >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalCredits - totalDebits >= 0 ? '+' : ''}${(totalCredits - totalDebits).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}