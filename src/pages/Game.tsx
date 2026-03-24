import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Trophy, Phone, X, CheckCircle, Clock, Sparkles, DollarSign, ArrowRight, Award, Star, Pencil, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TOTAL = 20;

interface SoldEntry {
  number: number;
  phone: string;
  name: string;
}

interface Stock {
  total_cartelas: number;
  sold_cartelas: number;
  remaining: number;
  sold_numbers: number[];
}

interface GameConfig {
  cartelaPrice: string;
  prize1: string;
  prize2: string;
  prize3: string;
  totalCartelas: string;
}

export default function Game() {
  const { user, token } = useAuth();
  const [stock, setStock] = useState<Stock | null>(null);
  const [soldEntries, setSoldEntries] = useState<SoldEntry[]>([]);

  // Setup screen
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [setupForm, setSetupForm] = useState<GameConfig>({ cartelaPrice: '30', prize1: '', prize2: '', prize3: '', totalCartelas: '20' });
  const [setupErrors, setSetupErrors] = useState<Partial<GameConfig>>({});
  const [statusLoading, setStatusLoading] = useState(true);

  // Modal
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState('');

  // Draw
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Edit config modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<GameConfig>({ cartelaPrice: '', prize1: '', prize2: '', prize3: '', totalCartelas: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // End game
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [isEndingGame, setIsEndingGame] = useState(false);

  const WINNER_LABELS = ['1st Place', '2nd Place', '3rd Place'];
  const WINNER_COLORS = [
    'from-amber-400 via-yellow-400 to-orange-400',
    'from-slate-300 via-slate-200 to-slate-400',
    'from-orange-500 via-amber-600 to-yellow-700',
  ];

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStock = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const res = await fetch(`${API_URL}/api/cartelas/stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStock(await res.json());
    } catch {}
  }, [API_URL, token]);

  useEffect(() => {
    if (!token) return; // wait for auth to load
    // Check if a game is already open and resume it
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/game/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.open && data.configured) {
            setGameConfig({
              cartelaPrice: String(data.cartelaPrice),
              prize1: String(data.prize1),
              prize2: String(data.prize2),
              prize3: String(data.prize3),
              totalCartelas: String(data.totalCartelas ?? 20),
            });
          } else if (data.open && !data.configured) {
            // Round exists but not configured yet — show setup
            setGameConfig(null);
          }
        }
      } catch {}
      setStatusLoading(false);
    };
    checkStatus();
  }, [API_URL, token]);

  useEffect(() => {
    fetchStock();
    intervalRef.current = setInterval(fetchStock, 5000);
    const onVisibility = () => { if (document.visibilityState === 'visible') fetchStock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchStock]);

  // On game load, restore any already-revealed winners from server
  useEffect(() => {
    if (!gameConfig) return;
    const restore = async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/rounds/preset-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.revealed > 0) {
            setDrawnNumbers(data.revealedWinners ?? []);
          }
        }
      } catch {}
    };
    restore();
  }, [gameConfig, API_URL, token]);

  const soldSet = useMemo(() => new Set(stock?.sold_numbers ?? []), [stock?.sold_numbers]);
  const GAME_TOTAL = gameConfig ? Number(gameConfig.totalCartelas) : TOTAL;
  const allSold = stock ? stock.remaining === 0 : false;

  const handleDraw = async () => {
    if (isDrawing || drawnNumbers.length >= 3) return;
    setIsDrawing(true);

    let winnerData: { cartela_number: number } | null = null;
    try {
      const res = await fetch(`${API_URL}/api/admin/rounds/reveal-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        winnerData = await res.json();
      } else {
        const err = await res.json();
        console.error('Reveal winner failed:', err.error);
        setError(err.error || 'Failed to reveal winner');
        setIsDrawing(false);
        return;
      }
    } catch (e) {
      console.error('Failed to reveal winner', e);
      setError('Network error — failed to reveal winner');
      setIsDrawing(false);
      return;
    }

    // 5-second suspense animation
    await new Promise<void>(resolve => setTimeout(resolve, 5000));

    if (winnerData) setDrawnNumbers(prev => [...prev, winnerData!.cartela_number]);
    setIsDrawing(false);
  };

  const validateSetup = () => {
    const errs: Partial<GameConfig> = {};
    if (!setupForm.totalCartelas || isNaN(Number(setupForm.totalCartelas)) || Number(setupForm.totalCartelas) < 1)
      errs.totalCartelas = 'Required';
    if (!setupForm.cartelaPrice || isNaN(Number(setupForm.cartelaPrice)) || Number(setupForm.cartelaPrice) <= 0)
      errs.cartelaPrice = 'Required';
    if (!setupForm.prize1 || isNaN(Number(setupForm.prize1)) || Number(setupForm.prize1) <= 0)
      errs.prize1 = 'Required';
    if (!setupForm.prize2 || isNaN(Number(setupForm.prize2)) || Number(setupForm.prize2) <= 0)
      errs.prize2 = 'Required';
    if (!setupForm.prize3 || isNaN(Number(setupForm.prize3)) || Number(setupForm.prize3) <= 0)
      errs.prize3 = 'Required';
    return errs;
  };

  const handleStartGame = async () => {
    const errs = validateSetup();
    if (Object.keys(errs).length > 0) { setSetupErrors(errs); return; }
    setSetupErrors({});
    try {
      const res = await fetch(`${API_URL}/api/admin/cartelas/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          total_cartelas: Number(setupForm.totalCartelas),
          cartela_price: setupForm.cartelaPrice,
          prize_1: setupForm.prize1,
          prize_2: setupForm.prize2,
          prize_3: setupForm.prize3,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setSetupErrors({ cartelaPrice: err.error || 'Failed to start game' });
        return;
      }
    } catch {
      setSetupErrors({ cartelaPrice: 'Network error, try again' });
      return;
    }
    setGameConfig({ ...setupForm });
    await fetchStock();
  };

  const handleEndGame = async () => {
    setIsEndingGame(true);
    try {
      await fetch(`${API_URL}/api/admin/cartelas/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ total_cartelas: GAME_TOTAL }),
      });
    } catch {}
    setGameConfig(null);
    setDrawnNumbers([]);
    setSoldEntries([]);
    setSetupForm({ cartelaPrice: '30', prize1: '', prize2: '', prize3: '', totalCartelas: '20' });
    setStock(null);
    setConfirmEnd(false);
    setIsEndingGame(false);
  };

  const openEditModal = () => {
    if (!gameConfig) return;
    setEditForm({ ...gameConfig });
    setEditError('');
    setEditOpen(true);
  };

  const saveEditConfig = async () => {
    if (!editForm.cartelaPrice || !editForm.prize1 || !editForm.prize2 || !editForm.prize3) {
      setEditError('All fields are required');
      return;
    }
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/rounds/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cartela_price: editForm.cartelaPrice,
          prize_1: editForm.prize1,
          prize_2: editForm.prize2,
          prize_3: editForm.prize3,
        }),
      });
      if (!res.ok) { const d = await res.json(); setEditError(d.error || 'Failed'); setEditSaving(false); return; }
      setGameConfig(prev => prev ? { ...prev, ...editForm } : prev);
      setEditOpen(false);
    } catch {
      setEditError('Network error');
    }
    setEditSaving(false);
  };

  const handleNumberClick = (num: number) => {
    if (soldSet.has(num)) return;
    setError('');
    setPendingNumber(num);
    setCustomerName('');
    setNameError('');
  };

  const confirmBuy = async () => {
    if (!customerName.trim()) { setNameError('Customer name is required'); return; }
    if (pendingNumber === null) return;

    setIsBuying(true);
    setNameError('');
    try {
      const res = await fetch(`${API_URL}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selected_numbers: [pendingNumber],
          phone_number: 'N/A',
          customer_name: customerName.trim(),
          cartela_price: gameConfig?.cartelaPrice,
          prize1: gameConfig?.prize1,
          prize2: gameConfig?.prize2,
          prize3: gameConfig?.prize3,
        })
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Failed to register cartela');
        setPendingNumber(null);
        return;
      }
      setSoldEntries(prev => [...prev, { number: pendingNumber, phone: '', name: customerName.trim() }]);
      setPendingNumber(null);
      setCustomerName('');
      await fetchStock();
    } catch {
      setError('Failed to register cartela');
      setPendingNumber(null);
    } finally {
      setIsBuying(false);
    }
  };

  if (user?.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pl-14 sm:pl-16">
        <div className="bg-white/95 rounded-2xl shadow-2xl p-6 sm:p-8 text-center w-full max-w-md">
          <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">Administrator Account</h2>
          <p className="text-slate-600">Use the Admin Panel to manage users and run the draw.</p>
        </div>
      </div>
    );
  }

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center pl-14 sm:pl-16">
        <div className="w-8 h-8 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Setup screen ──────────────────────────────────────────────
  if (!gameConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pl-14 sm:pl-16">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="bg-indigo-100 p-2 rounded-xl">
              <DollarSign className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Game Setup</h2>
          </div>

          <div className="space-y-4">
            {/* Total cartelas */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Total Cartelas</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 20"
                value={setupForm.totalCartelas}
                onChange={e => setSetupForm(f => ({ ...f, totalCartelas: e.target.value }))}
                className={`w-full px-4 py-2.5 border-2 rounded-xl outline-none text-slate-800 text-sm ${setupErrors.totalCartelas ? 'border-red-400' : 'border-slate-200 focus:border-indigo-500'}`}
              />
              {setupErrors.totalCartelas && <p className="text-red-500 text-xs mt-1">{setupErrors.totalCartelas}</p>}
            </div>

            {/* Cartela price */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Cartela Price (Birr)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 30"
                value={setupForm.cartelaPrice}
                onChange={e => setSetupForm(f => ({ ...f, cartelaPrice: e.target.value }))}
                className={`w-full px-4 py-2.5 border-2 rounded-xl outline-none text-slate-800 text-sm ${setupErrors.cartelaPrice ? 'border-red-400' : 'border-slate-200 focus:border-indigo-500'}`}
              />
              {setupErrors.cartelaPrice && <p className="text-red-500 text-xs mt-1">{setupErrors.cartelaPrice}</p>}
            </div>

            {/* Prize fields */}
            {([
              { key: 'prize1', label: '🥇 1st Place Prize (Birr)', color: 'from-amber-400 to-orange-400' },
              { key: 'prize2', label: '🥈 2nd Place Prize (Birr)', color: 'from-slate-300 to-slate-400' },
              { key: 'prize3', label: '🥉 3rd Place Prize (Birr)', color: 'from-orange-500 to-yellow-600' },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{label}</label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 200"
                  value={setupForm[key]}
                  onChange={e => setSetupForm(f => ({ ...f, [key]: e.target.value }))}
                  className={`w-full px-4 py-2.5 border-2 rounded-xl outline-none text-slate-800 text-sm ${setupErrors[key] ? 'border-red-400' : 'border-slate-200 focus:border-indigo-500'}`}
                />
                {setupErrors[key] && <p className="text-red-500 text-xs mt-1">{setupErrors[key]}</p>}
              </div>
            ))}
          </div>

          <button
            onClick={handleStartGame}
            className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold flex items-center justify-center gap-2"
          >
            Start Selling <ArrowRight size={16} />
          </button>
          <p className="mt-3 text-center text-xs text-slate-400">30 Birr will be deducted from your balance</p>
        </div>
      </div>
    );
  }

  // ── Main game screen ──────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen p-2 sm:p-4 lg:p-6 pl-14 sm:pl-16">
        <div className="max-w-lg mx-auto space-y-3 sm:space-y-4">

          <header className="text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Cartela Registration</h1>
            {stock && (
              <p className="text-indigo-300 text-sm mt-1">{stock.sold_cartelas} / {stock.total_cartelas} sold</p>
            )}
          </header>

          {/* Prize summary bar */}
          <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 grid grid-cols-4 gap-2 text-center relative">
            <button
              onClick={openEditModal}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
              title="Edit game settings"
            >
              <Pencil size={13} />
            </button>
            <div>
              <p className="text-indigo-300 text-xs">Price</p>
              <p className="text-white font-bold text-sm">{gameConfig.cartelaPrice} Br</p>
            </div>
            <div>
              <p className="text-amber-300 text-xs">🥇 1st</p>
              <p className="text-white font-bold text-sm">{gameConfig.prize1} Br</p>
            </div>
            <div>
              <p className="text-slate-300 text-xs">🥈 2nd</p>
              <p className="text-white font-bold text-sm">{gameConfig.prize2} Br</p>
            </div>
            <div>
              <p className="text-orange-300 text-xs">🥉 3rd</p>
              <p className="text-white font-bold text-sm">{gameConfig.prize3} Br</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500 text-white px-4 py-3 rounded-xl text-center font-semibold text-sm">{error}</div>
          )}

          {/* Grid */}
          <div className="bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-2xl shadow-2xl p-3 sm:p-5 border-2 border-indigo-200">
            <p className="text-center text-slate-500 text-xs sm:text-sm mb-3">
              {allSold ? 'All cartelas registered!' : 'Tap a number to register a customer'}
            </p>

            <div className="grid grid-cols-4 xs:grid-cols-5 gap-2 sm:gap-3 mb-4">
              {Array.from({ length: GAME_TOTAL }, (_, i) => i + 1).map(num => {
                const isSold = soldSet.has(num);
                return (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    disabled={isSold}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl font-black text-lg sm:text-xl transition-all duration-200 select-none
                      ${isSold
                        ? 'bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 text-white shadow-lg shadow-amber-300/40 cursor-not-allowed ring-2 ring-amber-300/60 scale-95'
                        : 'bg-white border-2 border-indigo-200 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:scale-105 active:scale-95 shadow-sm'
                      }`}
                  >
                    <span>{num}</span>
                    {isSold && <CheckCircle className="w-3 h-3 mt-0.5 text-white/90" />}
                  </button>
                );
              })}
            </div>

            {stock && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>{stock.sold_cartelas} registered</span>
                  <span>{stock.remaining} remaining</span>
                </div>
                <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${(stock.sold_cartelas / stock.total_cartelas) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status banner / Draw section */}
          {allSold ? (
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-2xl p-4 sm:p-6 border border-indigo-800/50">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 rounded-xl shadow-lg shrink-0">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-white">Draw Winners</h3>
                  <p className="text-indigo-300 text-xs">Winners pre-selected — reveal one at a time</p>
                </div>
                <div className="ml-auto bg-indigo-900/60 border border-indigo-700 px-3 py-1.5 rounded-xl shrink-0 text-center">
                  <p className="text-indigo-300 text-xs">Winners</p>
                  <p className="text-white font-bold text-base">{drawnNumbers.length}/3</p>
                </div>
              </div>

              {/* Winner slots */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                {Array.from({ length: 3 }).map((_, idx) => {
                  const winner = drawnNumbers[idx];
                  const isDrawingThis = isDrawing && idx === drawnNumbers.length;
                  return (
                    <div key={idx} className={`flex flex-col items-center justify-center rounded-xl border-2 p-2 sm:p-4 transition-all duration-500 ${
                      winner ? `bg-gradient-to-br ${WINNER_COLORS[idx]} border-transparent shadow-2xl`
                        : isDrawingThis ? 'bg-indigo-950 border-yellow-400/60'
                        : 'bg-indigo-950/40 border-indigo-800/50'
                    }`}>
                      <p className={`text-xs font-bold mb-1 ${winner ? 'text-black/70' : isDrawingThis ? 'text-yellow-300' : 'text-indigo-400'}`}>
                        {WINNER_LABELS[idx]}
                      </p>
                      {winner ? (
                        <>
                          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/20 flex items-center justify-center ring-2 sm:ring-4 ring-white/40 shadow-xl">
                            <span className="text-xl sm:text-2xl font-black text-black">{winner}</span>
                          </div>
                          <Trophy className="w-4 h-4 text-white/80 mt-1" />
                        </>
                      ) : isDrawingThis ? (
                        /* Lottery ball bounce animation */
                        <div className="flex items-end justify-center gap-1 h-10 sm:h-14">
                          {[0, 1, 2].map(b => (
                            <div
                              key={b}
                              className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 shadow-lg shadow-yellow-400/50"
                              style={{
                                animation: 'lotteryBounce 0.7s ease-in-out infinite',
                                animationDelay: `${b * 0.15}s`,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-indigo-700 flex items-center justify-center">
                          <Star className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-700" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {drawnNumbers.length < 3 ? (
                <div className="space-y-2">
                  <button onClick={handleDraw} disabled={isDrawing}
                    className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm sm:text-lg flex items-center justify-center gap-2 transition-all ${
                      !isDrawing
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-2xl'
                        : 'bg-indigo-950 border border-yellow-400/40 text-yellow-200 cursor-not-allowed'
                    }`}>
                    {isDrawing ? (
                      <>
                        <div className="flex items-end gap-0.5 h-5">
                          {[0,1,2].map(b => (
                            <div key={b} className="w-1.5 h-1.5 rounded-full bg-yellow-300"
                              style={{ animation: 'lotteryBounce 0.7s ease-in-out infinite', animationDelay: `${b * 0.15}s` }} />
                          ))}
                        </div>
                        Drawing {WINNER_LABELS[drawnNumbers.length]}...
                      </>
                    ) : (
                      <><Sparkles size={18} className="animate-pulse" />Pick {WINNER_LABELS[drawnNumbers.length]}</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm sm:text-lg flex items-center justify-center gap-2 shadow-2xl">
                    <Trophy size={18} /> All Winners Selected!
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${API_URL}/api/admin/cartelas/reset`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ total_cartelas: GAME_TOTAL })
                        });
                      } catch {}
                      setGameConfig(null);
                      setDrawnNumbers([]);
                      setSoldEntries([]);
                      setSetupForm({ cartelaPrice: '30', prize1: '', prize2: '', prize3: '', totalCartelas: '20' });
                      setStock(null);
                    }}
                    className="w-full py-3 sm:py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-lg flex items-center justify-center gap-2 shadow-2xl"
                  >
                    <ArrowRight size={18} /> Finish &amp; Start New Game
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl p-4 text-center border bg-indigo-500/10 border-indigo-400/20">
                <div className="flex items-center justify-center gap-2 text-indigo-300 text-sm">
                  <Clock className="w-4 h-4 animate-pulse" />
                  Sell all {GAME_TOTAL} cartelas to unlock the winner draw
                </div>
              </div>
              {!confirmEnd ? (
                <button
                  onClick={() => setConfirmEnd(true)}
                  className="w-full py-2.5 rounded-xl border border-red-400/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <X size={15} /> End Current Game
                </button>
              ) : (
                <div className="rounded-xl border border-red-400/50 bg-red-500/10 p-4 space-y-3">
                  <p className="text-red-300 text-sm text-center font-semibold">End this game? All unsold cartelas will be cleared.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmEnd(false)}
                      className="flex-1 py-2 rounded-xl border border-white/20 text-white/60 text-sm font-semibold hover:bg-white/10">
                      Cancel
                    </button>
                    <button onClick={handleEndGame} disabled={isEndingGame}
                      className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                      {isEndingGame ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <X size={14} />}
                      {isEndingGame ? 'Ending...' : 'Yes, End Game'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sold list */}
          {soldEntries.length > 0 && (
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
              <h3 className="text-white font-semibold text-sm mb-3">Registered this session</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {soldEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {entry.number}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-sm font-medium truncate">{entry.name}</span>
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <Phone className="w-3 h-3" />
                        {entry.phone}
                      </div>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-400 ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Phone Modal */}
      {pendingNumber !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-xl">
                  <Phone className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Register Customer</h3>
              </div>
              <button onClick={() => setPendingNumber(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex justify-center mb-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-400 to-orange-400 flex items-center justify-center shadow-lg ring-4 ring-amber-300/50">
                <span className="text-4xl font-black text-white">{pendingNumber}</span>
              </div>
            </div>

            {/* Prize info inside modal */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center bg-slate-50 rounded-xl p-2">
              <div>
                <p className="text-xs text-amber-500">🥇 1st</p>
                <p className="text-sm font-bold text-slate-700">{gameConfig.prize1} Br</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">🥈 2nd</p>
                <p className="text-sm font-bold text-slate-700">{gameConfig.prize2} Br</p>
              </div>
              <div>
                <p className="text-xs text-orange-400">🥉 3rd</p>
                <p className="text-sm font-bold text-slate-700">{gameConfig.prize3} Br</p>
              </div>
            </div>

            <p className="text-slate-500 text-sm text-center mb-4">
              Cartela <span className="font-bold text-indigo-600">#{pendingNumber}</span> — <span className="font-semibold text-green-600">{gameConfig.cartelaPrice} Birr</span>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hayelu"
                  value={customerName}
                  onChange={(e) => { setCustomerName(e.target.value); setNameError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && confirmBuy()}
                  autoFocus
                  className={`w-full px-4 py-3 border-2 rounded-xl outline-none text-slate-800 text-base ${nameError ? 'border-red-400' : 'border-slate-200 focus:border-indigo-500'}`}
                />
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPendingNumber(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBuy}
                disabled={isBuying}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isBuying
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Sparkles size={16} />
                }
                {isBuying ? 'Registering...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Settings Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-xl">
                  <Pencil className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Edit Game Settings</h3>
              </div>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cartela Price (Birr)</label>
                <input type="number" min="1" value={editForm.cartelaPrice}
                  onChange={e => setEditForm(f => ({ ...f, cartelaPrice: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
                />
              </div>
              {([
                { key: 'prize1', label: '🥇 1st Place Prize (Birr)' },
                { key: 'prize2', label: '🥈 2nd Place Prize (Birr)' },
                { key: 'prize3', label: '🥉 3rd Place Prize (Birr)' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input type="number" min="1" value={editForm[key]}
                    onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 focus:border-indigo-500 rounded-xl outline-none text-sm text-slate-800"
                  />
                </div>
              ))}
            </div>

            {editError && <p className="text-red-500 text-xs mt-2">{editError}</p>}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setEditOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveEditConfig} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
