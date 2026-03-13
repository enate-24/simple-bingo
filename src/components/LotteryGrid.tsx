import { Check } from 'lucide-react';

interface LotteryGridProps {
  selectedNumbers: Set<number>;
  onToggleNumber: (num: number) => void;
}

function LotteryGrid({ selectedNumbers, onToggleNumber }: LotteryGridProps) {
  const totalNumbers = 20;
  const selectionPercentage = (selectedNumbers.size / totalNumbers) * 100;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">
            Select Numbers
          </h2>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
            {selectedNumbers.size} / {totalNumbers}
          </div>
        </div>
        <p className="text-slate-600 text-sm sm:text-base">
          Choose numbers from 1 to {totalNumbers} for the draw
        </p>
        
        {/* Progress Bar */}
        <div className="mt-4 bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
            style={{ width: `${selectionPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-2 sm:gap-3">
        {Array.from({ length: totalNumbers }, (_, i) => i + 1).map(num => {
          const isSelected = selectedNumbers.has(num);
          return (
            <button
              key={num}
              onClick={() => onToggleNumber(num)}
              className={`relative aspect-square flex items-center justify-center rounded-xl font-bold text-base sm:text-lg transition-all duration-300 transform ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl scale-105 ring-4 ring-indigo-300/50'
                  : 'bg-slate-50 text-slate-700 border-2 border-slate-300 hover:border-indigo-400 hover:bg-slate-100 hover:scale-105 active:scale-95'
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5 shadow-lg">
                  <Check size={12} className="text-white" strokeWidth={3} />
                </div>
              )}
              {num}
            </button>
          );
        })}
      </div>

      {selectedNumbers.size > 0 && (
        <div className="mt-6 p-4 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg">
          <p className="text-sm text-indigo-900 font-medium">
            ✓ {selectedNumbers.size} {selectedNumbers.size === 1 ? 'number' : 'numbers'} selected and ready for drawing
          </p>
        </div>
      )}
    </div>
  );
}

export default LotteryGrid;
