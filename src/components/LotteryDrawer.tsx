import { useState } from 'react';
import { Sparkles, Award, Trophy, Star } from 'lucide-react';

interface LotteryDrawerProps {
  selectedCount: number;
  drawnNumbers: number[];
  onDraw: () => number | null;
  onReveal: (num: number) => void;
  canDraw: boolean;
}

const WINNER_LABELS = ['1st Place', '2nd Place', '3rd Place'];
const WINNER_COLORS = [
  'from-amber-400 via-yellow-400 to-orange-400',
  'from-slate-300 via-slate-200 to-slate-400',
  'from-orange-500 via-amber-600 to-yellow-700',
];
const WINNER_RINGS = ['ring-amber-300', 'ring-slate-300', 'ring-orange-400'];
const WINNER_BADGES = ['text-amber-900', 'text-slate-700', 'text-white'];

function LotteryDrawer({ selectedCount, drawnNumbers, onDraw, onReveal, canDraw }: LotteryDrawerProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const maxWinners = 3;

  const handleDraw = async () => {
    if (isDrawing || !canDraw || drawnNumbers.length >= maxWinners) return;
    setIsDrawing(true);
    const drawnNumber = onDraw();
    if (drawnNumber !== null && drawnNumber !== undefined) {
      onReveal(drawnNumber);
    }
    setIsDrawing(false);
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-indigo-800/50">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-48 sm:h-64 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-3 sm:p-4 lg:p-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-2 sm:p-3 rounded-xl shadow-lg shrink-0">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-white">Pick Winners</h2>
            <p className="text-indigo-300 text-xs sm:text-sm">{selectedCount} numbers in pool</p>
          </div>
          <div className="ml-auto bg-indigo-900/60 border border-indigo-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shrink-0">
            <p className="text-indigo-300 text-xs">Winners</p>
            <p className="text-white font-bold text-base sm:text-lg text-center">{drawnNumbers.length}/{maxWinners}</p>
          </div>
        </div>

        {/* Winner Slots */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {Array.from({ length: maxWinners }).map((_, idx) => {
            const winner = drawnNumbers[idx];
            const isDrawingThis = isDrawing && idx === drawnNumbers.length;
            return (
              <div key={idx} className={`flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border-2 p-2 sm:p-4 transition-all duration-500 ${
                winner
                  ? `bg-gradient-to-br ${WINNER_COLORS[idx]} border-transparent shadow-2xl`
                  : isDrawingThis
                  ? 'bg-indigo-900/60 border-indigo-500 animate-pulse'
                  : 'bg-indigo-950/40 border-indigo-800/50'
              }`}>
                <p className={`text-xs font-bold mb-1 sm:mb-2 ${winner ? WINNER_BADGES[idx] : 'text-indigo-400'}`}>
                  {WINNER_LABELS[idx]}
                </p>
                {winner ? (
                  <>
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-white/20 flex items-center justify-center ring-2 sm:ring-4 ${WINNER_RINGS[idx]} shadow-xl`}>
                      <span className="text-xl sm:text-2xl lg:text-3xl font-black text-black">{winner}</span>
                    </div>
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 mt-1 sm:mt-2" />
                  </>
                ) : isDrawingThis ? (
                  <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full border-4 border-indigo-400 border-t-transparent animate-spin" />
                ) : (
                  <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full border-2 border-dashed border-indigo-700 flex items-center justify-center">
                    <Star className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-700" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Draw Button */}
        {drawnNumbers.length < maxWinners ? (
          <button
            onClick={handleDraw}
            disabled={!canDraw || isDrawing}
            className={`w-full py-3 sm:py-4 lg:py-5 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 ${
              canDraw && !isDrawing
                ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 text-white shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isDrawing ? (
              <>
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm sm:text-base">Drawing {WINNER_LABELS[drawnNumbers.length]}...</span>
              </>
            ) : (
              <>
                <Sparkles size={20} className="animate-pulse" />
                Pick {WINNER_LABELS[drawnNumbers.length]}
              </>
            )}
          </button>
        ) : (
          <div className="w-full py-3 sm:py-4 lg:py-5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-2xl">
            <Trophy size={20} />
            All Winners Selected!
          </div>
        )}
      </div>
    </div>
  );
}

export default LotteryDrawer;
