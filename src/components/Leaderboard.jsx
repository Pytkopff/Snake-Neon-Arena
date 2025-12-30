// src/components/Leaderboard.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabaseClient'; // Importujemy klienta bazy

const Leaderboard = ({ onClose, defaultTab = 'classic' }) => {
  const [tab, setTab] = useState(defaultTab);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pobieranie danych z Supabase (Live)
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        // ZMIANA: Pobieramy z nowego widoku (tylko najlepsze wyniki)
        const { data, error } = await supabase
          .from('view_best_scores') // <-- Tu jest zmiana
          .select(`
            score,
            mode,
            played_at,
            username,       
            wallet_address
          `)
          .eq('mode', tab)
          .order('score', { ascending: false })
          .limit(50);

        if (error) throw error;

        const formattedData = data.map(entry => ({
          // Teraz username jest bezpośrednio w głównym obiekcie, nie w 'profiles'
          name: entry.username || `Player ${entry.wallet_address?.slice(0,4)}...`,
          score: entry.score,
          date: entry.played_at,
          isMe: false 
        }));

        setItems(formattedData);
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setItems([]); // W razie błędu pusta lista
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [tab]); // Odśwież jak zmienisz zakładkę

  // Tab button component
  const TabButton = ({ mode, label, emoji }) => (
    <button
      onClick={() => setTab(mode)}
      className={`
        px-4 py-2 rounded-lg font-semibold transition-all flex-1 sm:flex-none
        ${tab === mode 
          ? 'bg-gradient-to-r from-neon-blue to-neon-purple text-black shadow-[0_0_15px_rgba(0,240,255,0.5)]' 
          : 'glass hover:bg-white/10 text-gray-400'
        }
      `}
    >
      <span className="mr-1">{emoji}</span>
      {label}
    </button>
  );

  const getMedal = (rank) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass rounded-2xl p-6 max-w-lg w-full max-h-[85vh] flex flex-col border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-2">
             <span className="text-2xl">🌍</span>
             <h3 className="text-2xl font-bold neon-text">Global Rankings</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6 shrink-0">
          <TabButton mode="classic" label="Classic" emoji="🏆" />
          <TabButton mode="walls" label="Time Blitz" emoji="⚡" />
          <TabButton mode="chill" label="Zen" emoji="🧘" />
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 uppercase font-bold tracking-wider mb-2 px-3 shrink-0">
           <div className="col-span-2 text-center">Rank</div>
           <div className="col-span-6">Player</div>
           <div className="col-span-4 text-right">Score</div>
        </div>

        {/* Leaderboard Entries (Scrollable) */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-neon-blue">
               <div className="animate-spin text-4xl mb-2">⏳</div>
               <div className="text-xs tracking-widest">LOADING DATA...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📡</div>
              <div className="text-sm">No signals found.</div>
              <div className="text-xs mt-1">Be the first to conquer this mode!</div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {items.map((entry, i) => (
                <motion.div
                  key={`${entry.date}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`
                    grid grid-cols-12 gap-2 items-center p-3 rounded-lg border
                    ${i < 3 ? 'bg-white/5 border-white/10' : 'bg-transparent border-transparent hover:bg-white/5'}
                  `}
                >
                  {/* Rank */}
                  <div className="col-span-2 flex justify-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                      ${i === 0 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : ''}
                      ${i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/50' : ''}
                      ${i === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : ''}
                      ${i > 2 ? 'text-gray-500' : ''}
                    `}>
                      {getMedal(i) || `#${i + 1}`}
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="col-span-6 min-w-0">
                    <div className="font-semibold text-white text-sm truncate">
                      {entry.name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {new Date(entry.date).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Score */}
                  <div className={`col-span-4 text-right font-mono font-bold text-lg ${i < 3 ? 'text-neon-blue' : 'text-gray-300'}`}>
                    {entry.score.toLocaleString()}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-white/10 text-center shrink-0">
           <p className="text-[10px] text-gray-500">
             Ranking powered by <span className="text-green-400">Supabase</span> ⚡
           </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Leaderboard;