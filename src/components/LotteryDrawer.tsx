import { useState } from 'react';
import { Sparkles, Award, TrendingUp } from 'lucide-react';

interface LotteryDrawerProps {
  selectedCount: number;
  drawnNumbers: number[];
  onDraw: () => void;
  canDraw: boolean;
}

function LotteryDrawer({
  selectedCount,
  drawnNumbers,
  onDraw,
  canDraw,
}: LotteryDrawerProps) {
  const [isDrawing, setIsDrawing] = useState(false);

  const playSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Success sound with multiple tones
    const playTone = (frequency: number, startTime: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    // Play a pleasant chord
    playTone(523.25, audioContext.currentTime, 0.15); // C5
    playTone(659.25, audioContext.currentTime + 0.05, 0.15); // E5
    playTone(783.99, audioContext.currentTime + 0.1, 0.2); // G5
  };

  const handleDraw = async () => {
    if (isDrawing) return;
    setIsDrawing(true);

    await new Promise(resolve => setTimeout(resolve, 1000));
    playSound();
    onDraw();

    setIsDrawing(false);
  };

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-xl shadow-lg">
          <Award className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Draw Winners</h2>
          <p className="text-slate-600 text-sm">
            {selectedCount > 0 ? `${selectedCount} numbers in the pool` : 'Select numbers to begin'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={handleDraw}
          disabled={!canDraw || isDrawing}
          className={`w-full py-5 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 transform ${
            canDraw && !isDrawing
              ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 hover:from-emerald-600 hover:via-green-600 hover:to-teal-600 text-white shadow-2xl hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isDrawing ? (
            <>
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              Drawing Winner...
            </>
          ) : (
            <>
              <Sparkles size={24} className={canDraw ? 'animate-pulse' : ''} />
              Draw Winner
            </>
          )}
        </button>

        {!canDraw && selectedCount === 0 && (
          <p className="text-center text-slate-500 text-sm mt-3">
            Please select at least one number to draw
          </p>
        )}
      </div>

      {drawnNumbers.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-emerald-400 rounded-xl p-6 shadow-inner">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <p className="text-emerald-900 font-bold text-lg">
              Winning Numbers ({drawnNumbers.length})
            </p>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
            {drawnNumbers.map((num, idx) => (
              <div
                key={idx}
                className="relative flex flex-col items-center justify-center aspect-square bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 text-white rounded-xl font-bold text-2xl sm:text-3xl shadow-xl animate-bounce border-2 border-white"
                style={{ 
                  animationDelay: `${idx * 100}ms`,
                  animationDuration: '1s',
                  animationIterationCount: '3'
                }}
              >
                <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                  #{idx + 1}
                </div>
                {num}
              </div>
            ))}
          </div>

          <div className="mt-5 pt-5 border-t border-emerald-200">
            <p className="text-center text-emerald-800 text-sm font-medium">
              🎉 Congratulations to all winners! 🎉
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default LotteryDrawer;
