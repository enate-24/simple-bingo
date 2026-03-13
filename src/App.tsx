import { useState } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import LotteryGrid from './components/LotteryGrid';
import LotteryDrawer from './components/LotteryDrawer';

function App() {
  const [selectedNumbers, setSelectedNumbers] = useState<Set<number>>(new Set());
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [canDraw, setCanDraw] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const toggleNumber = (num: number) => {
    const newSelected = new Set(selectedNumbers);
    if (newSelected.has(num)) {
      newSelected.delete(num);
    } else {
      newSelected.add(num);
    }
    setSelectedNumbers(newSelected);
    setCanDraw(newSelected.size > 0);
  };

  const drawNumbers = () => {
    if (selectedNumbers.size === 0) return;

    const selectedArray = Array.from(selectedNumbers);
    const randomIndex = Math.floor(Math.random() * selectedArray.length);
    const drawnNumber = selectedArray[randomIndex];

    setDrawnNumbers(prev => [...prev, drawnNumber]);

    const newSelected = new Set(selectedNumbers);
    newSelected.delete(drawnNumber);
    setSelectedNumbers(newSelected);
    setCanDraw(newSelected.size > 0);
  };

  const resetGame = async () => {
    setIsResetting(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setSelectedNumbers(new Set());
    setDrawnNumbers([]);
    setCanDraw(false);
    setIsResetting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full mb-4 shadow-2xl">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-3 tracking-tight">
            Professional Lottery Draw
          </h1>
          <p className="text-slate-300 text-base sm:text-lg">
            Select your numbers and draw winners with confidence
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          <LotteryGrid
            selectedNumbers={selectedNumbers}
            onToggleNumber={toggleNumber}
          />

          <LotteryDrawer
            selectedCount={selectedNumbers.size}
            drawnNumbers={drawnNumbers}
            onDraw={drawNumbers}
            canDraw={canDraw}
          />

          {(selectedNumbers.size > 0 || drawnNumbers.length > 0) && (
            <button
              onClick={resetGame}
              disabled={isResetting}
              className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 disabled:from-slate-800 disabled:to-slate-900 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl border border-slate-600/50"
            >
              <RotateCcw size={20} className={isResetting ? 'animate-spin' : ''} />
              {isResetting ? 'Resetting...' : 'Reset Game'}
            </button>
          )}
        </div>

        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>© 2026 Professional Lottery System. All draws are random and fair.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
