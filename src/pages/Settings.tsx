import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle, Send, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface PaymentAddress {
  id: number;
  label: string;
  address: string;
  type: string;
}

interface TgSettings {
  telegram_bot_token: string;
  telegram_group_chat_id: string;
  operator_name: string;
  custom_message: string;
}

export default function Settings() {
  const { token } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Telegram settings
  const [tg, setTg] = useState<TgSettings>({
    telegram_bot_token: '',
    telegram_group_chat_id: '',
    operator_name: '',
    custom_message: '',
  });
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);

  // Payment addresses
  const [addresses, setAddresses] = useState<PaymentAddress[]>([]);
  const [addrForm, setAddrForm] = useState({ label: '', address: '', type: 'bank' });
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrSaved, setAddrSaved] = useState(false);
  const [addrError, setAddrError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API_URL}/api/admin/settings`, { headers })
      .then(r => r.json())
      .then(data => setTg(prev => ({ ...prev, ...data })))
      .catch(() => {});

    fetch(`${API_URL}/api/admin/payment-addresses`, { headers })
      .then(r => r.json())
      .then(setAddresses)
      .catch(() => {});
  }, []);

  const saveTgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setTgSaving(true);
    await fetch(`${API_URL}/api/admin/settings`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(tg),
    });
    setTgSaving(false);
    setTgSaved(true);
    setTimeout(() => setTgSaved(false), 2000);
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrForm.label.trim() || !addrForm.address.trim()) { setAddrError('Label and address are required'); return; }
    setAddrSaving(true); setAddrError('');
    const res = await fetch(`${API_URL}/api/admin/payment-addresses`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(addrForm),
    });
    if (res.ok) {
      setAddrForm({ label: '', address: '', type: 'bank' });
      setAddrSaved(true);
      setTimeout(() => setAddrSaved(false), 2000);
      const updated = await fetch(`${API_URL}/api/admin/payment-addresses`, { headers });
      if (updated.ok) setAddresses(await updated.json());
    } else {
      const d = await res.json();
      setAddrError(d.error || 'Failed to save');
    }
    setAddrSaving(false);
  };

  const deleteAddress = async (id: number) => {
    await fetch(`${API_URL}/api/admin/payment-addresses/${id}`, { method: 'DELETE', headers });
    setAddresses(prev => prev.filter(a => a.id !== id));
  };

  const field = (label: string, key: keyof TgSettings, placeholder: string, type = 'text') => (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={tg[key]}
        onChange={e => setTg(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
      />
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 pl-14 sm:pl-16">
      <div className="max-w-lg mx-auto space-y-4">

        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-2 rounded-xl">
            <SettingsIcon className="w-6 h-6 text-indigo-300" />
          </div>
          <h1 className="text-xl font-bold text-white">Settings</h1>
        </div>

        {/* Telegram settings */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-800">Telegram Configuration</h2>
          </div>
          <form onSubmit={saveTgSettings} className="space-y-3">
            {field('Bot Token', 'telegram_bot_token', 'e.g. 123456:ABC-DEF...')}
            {field('Group Chat ID', 'telegram_group_chat_id', 'e.g. -1001234567890')}
            {field('Operator Name', 'operator_name', 'e.g. Hayilu Lottery')}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Custom Message (shown in every notification)</label>
              <textarea
                rows={2}
                placeholder="e.g. Welcome to Hayilu Online Lottery!"
                value={tg.custom_message}
                onChange={e => setTg(f => ({ ...f, custom_message: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={tgSaving}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {tgSaved ? <><CheckCircle size={16} /> Saved!</> : tgSaving ? 'Saving...' : <><Save size={16} /> Save Telegram Settings</>}
            </button>
          </form>
        </div>

        {/* Payment addresses */}
        <div className="bg-white rounded-2xl shadow-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-800">Payment Addresses</h2>
          </div>
          <form onSubmit={addAddress} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Label</label>
              <input
                type="text"
                placeholder="e.g. CBE, Telebirr, M-Pesa"
                value={addrForm.label}
                onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Account / Phone Number</label>
              <input
                type="text"
                placeholder="e.g. 1000123456789 or 0912345678"
                value={addrForm.address}
                onChange={e => setAddrForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select
                value={addrForm.type}
                onChange={e => setAddrForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
              >
                <option value="bank">Bank</option>
                <option value="telebirr">Telebirr</option>
                <option value="mpesa">M-Pesa</option>
                <option value="other">Other</option>
              </select>
            </div>
            {addrError && <p className="text-red-500 text-xs">{addrError}</p>}
            <button
              type="submit"
              disabled={addrSaving}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {addrSaved ? <><CheckCircle size={16} /> Added!</> : addrSaving ? 'Saving...' : <><Save size={16} /> Add Address</>}
            </button>
          </form>

          {addresses.length > 0 && (
            <div className="mt-4 space-y-2">
              {addresses.map(addr => (
                <div key={addr.id} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{addr.label}</p>
                    <p className="text-xs text-slate-500 truncate">{addr.address}</p>
                    <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">{addr.type}</span>
                  </div>
                  <button onClick={() => deleteAddress(addr.id)} className="text-red-400 hover:text-red-600 text-xs font-semibold shrink-0">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
