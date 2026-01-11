import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDailyStatus, claimDaily, repairStreakWithApples, resetStreakToZero, DAILY_REWARDS, getPlayerStats } from '../utils/storage';

const DailyCheckIn = ({ onClose, walletAddress, onRewardClaimed }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [userApples, setUserApples] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Pobranie danych przy starcie
  useEffect(() => {
    loadData();
  }, [walletAddress]);

  const loadData = async () => {
    setLoading(true);
    const s = await getDailyStatus(walletAddress);
    setStatus(s);
    
    // ZAWSZE pobieraj aktualny stan jabłek (nie tylko gdy isMissed)
    const stats = await getPlayerStats(walletAddress);
    setUserApples(stats.totalApples);
    console.log('🍎 Daily Check-in: User has', stats.totalApples, 'apples');
    
    setLoading(false);
  };

  const handleClaim = async () => {
    setClaiming(true);
    const result = await claimDaily(walletAddress);
    if (result.success) {
        if (onRewardClaimed) onRewardClaimed(result.reward);
        // Po sukcesie zamykamy okno po krótkim opóźnieniu dla efektu
        setTimeout(() => onClose(), 2000);
    }
    setClaiming(false);
  };

  const handleRepair = async () => {
    setClaiming(true);
    setErrorMsg('');
    
    console.log('🔧 Attempting to repair streak. User has:', userApples, 'apples');
    
    const success = await repairStreakWithApples(walletAddress);
    
    if (success) {
        console.log('✅ Streak repaired!');
        await loadData(); // Odświeżamy - teraz powinno być "canClaim: true"
    } else {
        console.error('❌ Repair failed - not enough apples');
        setErrorMsg('Not enough apples! Need 500 🍎');
    }
    setClaiming(false);
  };

  const handleReset = async () => {
      setClaiming(true);
      await resetStreakToZero(walletAddress);
      await loadData();
      setClaiming(false);
  };

  const renderDay = (dayIndex) => {
    const reward = DAILY_REWARDS[dayIndex];
    const currentDayInCycle = status ? status.dayIndex : 0;
    
    let state = 'locked'; 
    if (!status) state = 'locked';
    else if (status.isMissed && dayIndex === currentDayInCycle) state = 'missed';
    else if (dayIndex < currentDayInCycle) state = 'claimed';
    else if (dayIndex === currentDayInCycle && status.canClaim) state = 'current';
    
    const isJackpot = dayIndex === 6;

    return (
      <div 
        key={dayIndex}
        className={`
          relative flex flex-col items-center justify-center rounded-xl border transition-all
          ${isJackpot ? 'col-span-2 row-span-2 aspect-auto' : 'aspect-square'}
          ${state === 'current' ? 'bg-white/10 border-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.3)] scale-105 z-10' : ''}
          ${state === 'locked' ? 'bg-black/40 border-white/5 opacity-50' : ''}
          ${state === 'claimed' ? 'bg-green-500/10 border-green-500/30' : ''}
          ${state === 'missed' ? 'bg-red-500/10 border-red-500/50' : ''}
        `}
      >
        <span className={`text-[10px] font-bold uppercase mb-1 ${state === 'current' ? 'text-neon-blue' : 'text-gray-500'}`}>
            {isJackpot ? 'BIG DAY' : `Day ${dayIndex + 1}`}
        </span>

        <div className="text-center">
            {state === 'claimed' && <div className="text-2xl">✅</div>}
            {state === 'missed' && <div className="text-2xl animate-pulse">❌</div>}
            {(state === 'locked' || state === 'current') && (
                <>
                    <div className={`mb-1 ${isJackpot ? 'text-4xl animate-bounce' : 'text-2xl'}`}>
                        {isJackpot ? '🎁' : '🍎'}
                    </div>
                    <div className={`font-mono font-bold ${isJackpot ? 'text-xl text-yellow-400' : 'text-sm text-white'}`}>
                        {reward}
                    </div>
                </>
            )}
        </div>

        {state === 'current' && (
            <div className="absolute inset-0 border-2 border-neon-blue rounded-xl animate-pulse pointer-events-none"></div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-2xl relative"
            onClick={e => e.stopPropagation()}
        >
             <div className="text-center mb-6">
                <h2 className="text-2xl font-bold neon-text mb-1">Daily Rewards</h2>
                <p className="text-xs text-gray-400">Come back every day for more apples!</p>
            </div>

            {loading ? (
                <div className="h-40 flex items-center justify-center text-neon-blue">
                   <div className="animate-spin text-2xl mr-2">⏳</div> Loading...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-4 grid-rows-2 gap-3 mb-6">
                        {renderDay(0)}
                        {renderDay(1)}
                        {renderDay(2)}
                        {renderDay(3)}
                        <div className="col-span-2 grid grid-cols-2 gap-3">
                            {renderDay(4)}
                            {renderDay(5)}
                        </div>
                        {renderDay(6)} 
                    </div>

                    <div className="mt-4">
                        {!status.isMissed ? (
                            <button
                                onClick={handleClaim}
                                disabled={!status.canClaim || claiming}
                                className={`
                                    w-full py-3 rounded-lg font-bold text-lg tracking-wider transition-all
                                    ${status.canClaim 
                                        ? 'bg-gradient-to-r from-neon-blue to-purple-600 text-white shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:scale-[1.02]' 
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                                `}
                            >
                                {claiming ? 'CLAIMING...' : status.canClaim ? 'CLAIM REWARD' : 'COME BACK TOMORROW'}
                            </button>
                        ) : (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                                <h3 className="text-red-400 font-bold mb-1">STREAK BROKEN! 😱</h3>
                                <p className="text-xs text-gray-400 mb-4">
                                    You missed a day! Repair it to keep your progress towards the BIG PRIZE.
                                </p>
                                
                                <div className="flex gap-3">
                                    <button 
                                        onClick={handleReset}
                                        className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        Give up &<br/>Reset
                                    </button>

                                    <button 
                                        onClick={handleRepair}
                                        disabled={claiming}
                                        className="flex-[2] py-2 rounded-lg bg-yellow-600/20 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-600/30 transition-all flex flex-col items-center justify-center"
                                    >
                                        <span className="font-bold text-sm">RECOVER STREAK</span>
                                        <span className="text-[10px] opacity-80">Cost: 500 🍎 (You have: {userApples})</span>
                                    </button>
                                </div>
                                {errorMsg && <p className="text-red-500 text-xs mt-2 font-bold">{errorMsg}</p>}
                            </div>
                        )}
                    </div>
                </>
            )}

            <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center bg-white/5 rounded-full"
            >
                ✕
            </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DailyCheckIn;