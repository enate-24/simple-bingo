import { Check, Lock, Sparkles } from 'lucide-react';

interface LotteryGridProps {
  selectedNumbers: Set<number>;
  onToggleNumber: (num: number) => void;
  disabled?: boolean;
}

function LotteryGrid({ selectedNumbers, onToggleNumber, disabled = false }: LotteryGridProps) {
  const totalNumbers = 20;
  const selectionPercentage = (selectedNumbers.size / totalNumbers) * 100;

  return (
    <div className="relative bg-gradient-to-br from-white via-indigo-50 to-purple-50 rounded-2xl shadow-2xl p-3 sm:p-4 lg:p-6 border-2 border-indigo-200 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-3xl -z-0" />
      <div className="absolute bottom-0 left-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-tr from-pink-200/30 to-orange-200/30 rounded-full blur-3xl -z-0" />

      <div className="relative z-10">
        {/* Header */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2">
              {disabled ? (
                <div className="bg-gradient-to-br from-slate-500 to-slate-600 p-1.5 sm:p-2 rounded-xl shadow-lg">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              ) : (
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 sm:p-2 rounded-xl shadow-lg animate-pulse">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-base sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {disabled ? 'Numbers Locked' : 'Select Numbers'}
                </h2>
                <p className="text-slate-600 text-xs hidden sm:block">
                  {disabled ? 'Ready to pick winners!' : 'Choose your lucky numbers 1–20'}
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-75 animate-pulse" />
              <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-bold text-sm sm:text-base shadow-xl">
                {selectedNumbers.size}/{totalNumbers}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white/80 rounded-full h-1.5 sm:h-2 overflow-hidden shadow-inner border border-indigo-200">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${selectionPercentage}%` }}
            />
          </div>
        </div>

        {/* Number Grid - 10 cols on all sizes */}
        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 lg:gap-2 mb-3">
          {Array.from({ length: totalNumbers }, (_, i) => i + 1).map(num => {
            const isSelected = selectedNumbers.has(num);
            return (
              <button
                key={num}
                onClick={() => onToggleNumber(num)}
                disabled={disabled}
                className={`relative aspect-square flex items-center justify-center rounded-lg sm:rounded-xl font-bold text-sm sm:text-base lg:text-lg transition-all duration-200 ${
                  isSelected
                    ? disabled
                      ? 'bg-gradient-to-br from-slate-400 to-slate-600 text-white shadow-lg scale-105 ring-2 ring-slate-300/50'
                      : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl scale-110 ring-2 ring-purple-300/50'
                    : disabled
                    ? 'bg-white/50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white text-slate-700 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 hover:scale-110 shadow-sm active:scale-95'
                }`}
              >
                {isSelected && (
                  <div className={`absolute -top-0.5 -right-0.5 rounded-full p-0.5 shadow z-10 ${disabled ? 'bg-slate-600' : 'bg-green-500'}`}>
                    <Check size={8} className="text-white" strokeWidth={3} />
                  </div>
                )}
                <span className="relative z-10">{num}</span>
              </button>
            );
          })}
        </div>

        {/* Status */}
        {selectedNumbers.size > 0 && !disabled && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" strokeWidth={3} />
              <p className="text-white font-semibold text-xs sm:text-sm">
                {selectedNumbers.size} {selectedNumbers.size === 1 ? 'number' : 'numbers'} selected
              </p>
            </div>
          </div>
        )}
        {disabled && (
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              <p className="text-white font-semibold text-xs sm:text-sm">Numbers locked — pick your winners!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LotteryGrid;
