import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Trophy, Sparkles } from 'lucide-react';
import LotteryGrid from '../components/LotteryGrid';
import LotteryDrawer from '../components/LotteryDrawer';
import { useAuth } from '../contexts/AuthContext';

export default function Game() {
  const { user, refreshUser, token } = useAuth();
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [originalNumbers, setOriginalNumbers] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [canDraw, setCanDraw] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const pendingDrawRef = useRef<number | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const loadCurrentGame = async () => {
      if (!user || !token) return;
      try {
        const response = await fetch(`${API_URL}/api/game/current`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const game = await response.json();
          if (game) {
            setSelectedNumbers(new Set(game.selected_numbers));
            setOriginalNumbers(new Set(game.selected_numbers));
            setDrawnNumbers(game.drawn_numbers || []);
            setGameStarted(true);
            setCanDraw(game.drawn_numbers.length < 3);
            setCurrentGameId(game.id);
          }
        }
      } catch (error) {
        console.error('Failed to load current game', error);
      }
    };
    loadCurrentGame();
  }, [user, token, API_URL]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`lottery_game_${user.id}`, JSON.stringify({
      selectedNumbers: Array.from(selectedNumbers),
      originalNumbers: Array.from(originalNumbers),
      drawnNumbers,
      gameStarted,
      gameId: currentGameId,
    }));
  }, [selectedNumbers, originalNumbers, drawnNumbers, gameStarted, currentGameId, user]);

  const toggleNumber = (num: number) => {
    if (gameStarted) return;
    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(num)) newSelected.delete(num);
    else newSelected.add(num);
    setSelectedNumbers(newSelected);
  };

  const playStartSound = () => {
    const audio = new Audio('/src/public/start.wav');
    audio.play().catch(() => {});
  };

  const startGame = async () => {
    if (selectedNumbers.size === 0) {
      setError('Please select at least one number to start');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selected_numbers: Array.from(selectedNumbers) })
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start game');
        return;
      }
      const game = await response.json();
      setCurrentGameId(game.id);
      setOriginalNumbers(new Set(selectedNumbers));
      setGameStarted(true);
      setCanDraw(true);
      setError('');
      playStartSound();
      await refreshUser();
    } catch (err) {
      setError('Failed to start game');
    }
  };

  const drawNumbers = (): number | null => {
    if (pendingDrawRef.current !== null) return null;
    if (originalNumbers.size === 0) return null;
    if (drawnNumbers.length >= 3) {
      setError('Maximum 3 winners allowed. Finish the game to start a new one.');
      return null;
    }
    setError('');
    const remainingNumbers = Array.from(originalNumbers).filter(num => !drawnNumbers.includes(num));
    if (remainingNumbers.length === 0) {
      setError('No more numbers to draw');
      setCanDraw(false);
      return null;
    }
    const drawnNumber = remainingNumbers[Math.floor(Math.random() * remainingNumbers.length)];
    pendingDrawRef.current = drawnNumber;
    fetch(`${API_URL}/api/game/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ drawn_number: drawnNumber })
    }).catch(() => {});
    return drawnNumber;
  };

  const revealWinner = (drawnNumber: number) => {
    pendingDrawRef.current = null;
    setDrawnNumbers(prev => {
      const next = [...prev, drawnNumber];
      setCanDraw(next.length < 3);
      return next;
    });
  };

  const resetGame = async () => {
    setIsResetting(true);
    setError('');
    await new Promise(resolve => setTimeout(resolve, 300));
    setSelectedNumbers(new Set());
    setOriginalNumbers(new Set());
    setDrawnNumbers([]);
    setCanDraw(false);
    setGameStarted(false);
    setCurrentGameId(null);
    if (user) localStorage.removeItem(`lottery_game_${user.id}`);
    setIsResetting(false);
  };

  if (user?.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pl-14 sm:pl-16">
        <div className="bg-white/95 rounded-2xl shadow-2xl p-6 sm:p-8 text-center w-full max-w-md">
          <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">Administrator Account</h2>
          <p className="text-slate-600">Admins cannot play the lottery. Use the Admin Panel to manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-6 pl-14 sm:pl-16">
      <div className="max-w-full mx-auto">
        <header className="text-center mb-3 sm:mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">Lottery</h1>
        </header>

        {error && (
          <div className="bg-red-500 text-white px-4 py-3 rounded-xl mb-3 text-center font-semibold text-sm sm:text-base">
            {error}
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {!gameStarted ? (
            <>
              <LotteryGrid selectedNumbers={selectedNumbers} onToggleNumber={toggleNumber} disabled={false} />
              {selectedNumbers.size > 0 && (
                <button
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 sm:py-5 px-4 rounded-xl flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 shadow-xl text-base sm:text-lg"
                >
                  <Sparkles size={20} />
                  Start Game ({selectedNumbers.size} selected)
                </button>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div className="lg:sticky lg:top-4 lg:self-start">
                <LotteryGrid selectedNumbers={selectedNumbers} onToggleNumber={toggleNumber} disabled={true} />
              </div>
              <div>
                <LotteryDrawer
                  selectedCount={originalNumbers.size}
                  drawnNumbers={drawnNumbers}
                  onDraw={drawNumbers}
                  onReveal={revealWinner}
                  canDraw={canDraw}
                />
              </div>
            </div>
          )}

          {(gameStarted || drawnNumbers.length > 0) && (
            <button
              onClick={resetGame}
              disabled={isResetting}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-3 sm:py-4 px-4 rounded-xl flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 shadow-xl border border-slate-600/50 text-sm sm:text-base"
            >
              <RotateCcw size={18} className={isResetting ? 'animate-spin' : ''} />
              {isResetting ? 'Finishing...' : 'Finish Game'}
            </button>
          )}
        </div>

        <footer className="mt-4 sm:mt-6 text-center text-slate-400 text-xs">
          <p>© 2026 Professional Lottery System. All draws are random and fair.</p>
        </footer>
      </div>
    </div>
  );
}
