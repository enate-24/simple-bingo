import { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Clock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  id: number;
  user_id: number;
  amount: string | number;
  type: 'credit' | 'debit';
  description: string | null;
  created_at: string;
}

interface BalancePageProps {
  onBack: () => void;
}

export default function BalancePage({ onBack }: BalancePageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchTransactions();
  }, []);

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
    <div className="space-y-6">
      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-6 h-6" />
            <p className="text-green-100 text-sm font-medium">Current Balance</p>
          </div>
          <p className="text-4xl font-bold">${user?.balance.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-6 h-6" />
            <p className="text-blue-100 text-sm font-medium">Total Credits</p>
          </div>
          <p className="text-4xl font-bold">${totalCredits.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <TrendingDown className="w-6 h-6" />
            <p className="text-orange-100 text-sm font-medium">Total Spent</p>
          </div>
          <p className="text-4xl font-bold">${totalDebits.toFixed(2)}</p>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Transaction History
          </h3>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-600 mt-4">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">No transactions yet</p>
            <p className="text-slate-400 text-sm mt-2">Your transaction history will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date & Time</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Description</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Type</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-700">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {formatDate(transaction.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800">
                      {transaction.description || 'No description'}
                    </td>
                    <td className="px-6 py-4">
                      {transaction.type === 'credit' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <TrendingUp className="w-3 h-3" />
                          Credit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <TrendingDown className="w-3 h-3" />
                          Debit
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-lg font-bold ${
                        transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
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

      {/* Summary Footer */}
      {transactions.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-600 text-sm">Total Transactions</p>
              <p className="text-2xl font-bold text-slate-800">{transactions.length}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-600 text-sm">Net Change</p>
              <p className={`text-2xl font-bold ${
                totalCredits - totalDebits >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {totalCredits - totalDebits >= 0 ? '+' : ''}${(totalCredits - totalDebits).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
