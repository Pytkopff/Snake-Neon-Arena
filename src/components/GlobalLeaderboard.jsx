import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../utils/supabaseClient';

const GlobalLeaderboard = ({ onClose, defaultTab = 'classic', currentCanonicalId, farcasterUser }) => {
  const [tab, setTab] = useState(defaultTab);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  const VIEW_MAPPING = {
    classic: 'leaderboard_classic',
    walls: 'leaderboard_walls',
    chill: 'leaderboard_chill',
    apples: 'leaderboard_total_apples'
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [tab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const viewName = VIEW_MAPPING[tab];
      console.log('🔍 Fetching leaderboard:', viewName);
      
      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(50);

      console.log('📊 Leaderboard response:', { viewName, data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Scores fetched:', data?.length || 0, 'records');
      setScores(data || []);
    } catch (err) {
      console.error('❌ Leaderboard fetch error:', err);
      setScores([]);
    } finally {
      setLoading(false);
    }
  };

  const getAvatar = (player) => {
    if (player.avatar_url) return player.avatar_url;
    return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${player.canonical_user_id}&backgroundColor=0a0e27`;
  };

  const getDisplayLabel = (player) => {
    if (player.display_name && player.display_name !== 'Guest Player') {
      return player.display_name;
    }
    return 'Anonymous';
  };

  const top3 = scores.slice(0, 3);
  const rest = scores.slice(3);

  const myRankIndex = scores.findIndex(p => p.canonical_user_id === currentCanonicalId);
  const myData = myRankIndex !== -1 ? scores[myRankIndex] : null;

  const getScoreValue = (player) => {
    // Widoki zwracają 'score' dla rankingów i 'total_apples' dla zakładki jabłek
    const value = tab === 'apples' ? (player.total_apples || 0) : (player.score || 0);
    return value;
  };

  const TabButton = ({ mode, label, emoji }) => (
    <button
      onClick={() => setTab(mode)}
      className={`px-3 py-2 rounded-lg font-semibold transition-all flex-1 sm:flex-none text-xs sm:text-sm whitespace-nowrap
        ${tab === mode 
          ? 'bg-gradient-to-r from-neon-blue to-purple-600 text-white shadow-[0_0_15px_rgba(0,240,255,0.5)]' 
          : 'glass hover:bg-white/10 text-gray-400'}`}
    >
      <span className="mr-1">{emoji}</span>
      {label}
    </button>
  );

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
        className="glass rounded-2xl max-w-lg w-full h-[85vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌍</span>
            <h3 className="text-2xl font-bold neon-text">Global Rankings</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all">✕</button>
        </div>

        <div className="px-6 flex gap-2 mb-4 shrink-0 overflow-x-auto pb-2 custom-scrollbar">
          <TabButton mode="classic" label="Neon Ranked" emoji="🏆" />
          <TabButton mode="walls" label="Time Blitz" emoji="⚡" />
          <TabButton mode="chill" label="Zen Flow" emoji="🧘" />
          <TabButton mode="apples" label="Total Apples" emoji="🍎" />
        </div>

        <div className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-neon-blue">
              <div className="animate-spin text-4xl mb-2">⏳</div>
              <div className="text-xs tracking-widest uppercase">Syncing Arena...</div>
            </div>
          ) : scores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-2">📡</div>
              <div className="text-sm">No signals found in this sector.</div>
            </div>
          ) : (
            <div className="flex flex-col h-full w-full overflow-hidden">
              {/* Podium Top 3 */}
              <div className="flex justify-around items-end p-6 pt-10 bg-gradient-to-b from-neon-blue/10 to-transparent shrink-0">
                {top3.map((player, i) => {
                  const isYou = player.canonical_user_id === currentCanonicalId;
                  return (
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      key={player.canonical_user_id} 
                      className={`flex flex-col items-center gap-2 ${i === 0 ? 'order-2 scale-125 z-10' : i === 1 ? 'order-1 pb-2' : 'order-3 pb-2'}`}
                    >
                      <div className={`relative p-1 rounded-full ${i === 0 ? 'bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]' : i === 1 ? 'bg-gray-300' : 'bg-orange-400'} ${isYou ? 'ring-2 ring-white animate-pulse' : ''}`}>
                        <img src={getAvatar(player)} className="w-12 h-12 rounded-full bg-black object-cover border-2 border-black" alt="avatar" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-inherit border-2 border-[#0a0e27] flex items-center justify-center text-[10px] font-bold text-black">{i + 1}</div>
                      </div>
                      <span className={`text-[10px] font-bold truncate max-w-[80px] text-center ${isYou ? 'text-neon-blue' : 'text-white'}`}>
                        {isYou ? '⭐ YOU' : getDisplayLabel(player)}
                      </span>
                      <span className="text-xs font-mono text-neon-blue">{getScoreValue(player).toLocaleString()}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Lista 4+ */}
              <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2 custom-scrollbar">
                {rest.map((player, index) => {
                  const isYou = player.canonical_user_id === currentCanonicalId;
                  return (
                    <div key={player.canonical_user_id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${isYou ? 'bg-neon-blue/20 border-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.2)] scale-[1.02]' : 'bg-white/5 border-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-gray-500 w-5">#{index + 4}</span>
                        <img src={getAvatar(player)} className={`w-8 h-8 rounded-full border ${isYou ? 'border-neon-blue' : 'border-white/10'}`} alt="avatar" />
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold ${isYou ? 'text-neon-blue' : 'text-white'}`}>
                            {isYou ? '⭐ YOU' : getDisplayLabel(player)}
                            {isYou && <span className="ml-2 text-[8px] bg-neon-blue text-black px-1 rounded uppercase font-black">Online</span>}
                          </span>
                          {isYou && <span className="text-[9px] text-neon-blue/60 uppercase tracking-tighter">Your current position</span>}
                        </div>
                      </div>
                      <span className="font-mono text-neon-blue text-sm font-bold">{getScoreValue(player).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Sticky Footer */}
              {myData && (
                <motion.div 
                  initial={{ y: 50 }} 
                  animate={{ y: 0 }}
                  className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0e27] to-transparent pointer-events-none"
                >
                  <div className="bg-[#0ef0ff]/20 backdrop-blur-xl border border-[#0ef0ff]/50 p-3 rounded-2xl flex justify-between items-center shadow-[0_0_20px_rgba(14,240,255,0.3)] pointer-events-auto">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#0ef0ff] text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                        Rank #{myRankIndex + 1}
                      </div>
                      <span className="text-[#0ef0ff] text-xs font-bold uppercase tracking-widest">Your Stats</span>
                    </div>
                    <div className="text-white font-mono font-black text-lg drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
                      {getScoreValue(myData).toLocaleString()} {tab === 'apples' ? '🍎' : '⭐'}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 text-center bg-black/20 shrink-0">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">
            Ranking secured by <span className="text-green-400">Supabase DB</span> ⚡
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GlobalLeaderboard;
