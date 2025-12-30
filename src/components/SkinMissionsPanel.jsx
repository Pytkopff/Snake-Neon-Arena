import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWalletClient } from 'wagmi'; 
import { ethers } from "ethers"; 
import { getAddress, parseEther } from 'viem'; 
import { SKINS, MISSIONS } from '../utils/constants';

const RAW_CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";

const iface = new ethers.utils.Interface([
  "function claim(address receiver, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) allowlistProof, bytes data)"
]);
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const SkinMissionsPanel = ({ 
  unlockedSkins, 
  currentSkinId, 
  onSelectSkin, 
  onClose, 
  playerStats 
}) => {
  const [activeTab, setActiveTab] = useState('skins');
  const [isMinting, setIsMinting] = useState(false);

  const { address } = useAccount(); 
  const { data: walletClient } = useWalletClient(); 

  const handleMint = async (tokenId) => {
    if (!address) return; // Cichy powrót, Farcaster i tak wymusi login
    if (!walletClient) return;

    setIsMinting(true);

    try {
      console.log("🛠️ Mint start...");
      const cleanContractAddress = getAddress(RAW_CONTRACT_ADDRESS.trim());
      const cleanCurrency = getAddress(NATIVE_TOKEN);

      let pricePerToken = 0n;
      let valueToSend = 0n;

      if (tokenId === 2) {
          // ZMIANA: Nowa cena dla supportera
          pricePerToken = parseEther("0.00034"); 
          valueToSend = pricePerToken;
      } else {
          pricePerToken = 0n;
          valueToSend = 0n;
      }

      const allowlistProof = {
  proof: [],
  quantityLimitPerWallet: MAX_UINT256,
  pricePerToken: pricePerToken,
  currency: cleanCurrency
};

const txData = iface.encodeFunctionData("claim", [
  address,           // receiver
  tokenId,           // tokenId
  1,                 // quantity
  cleanCurrency,     // currency
  pricePerToken,     // pricePerToken
  allowlistProof,    // allowlistProof struct
  "0x"               // data (empty bytes)
]);

      const hash = await walletClient.sendTransaction({
        account: address,
        to: cleanContractAddress,
        data: txData,
        value: valueToSend,
      });

      console.log("✅ Hash:", hash);
      
      // 🔇 USUNIĘTO ALERT SUKCESU
      // Na Farcasterze po prostu kończymy loading. 
      // Portfel sam wyświetli toast "Transaction Sent".
      
      // Opcjonalnie: Tu możesz dodać kod, który zamyka panel po sukcesie:
      // onClose(); 

    } catch (err) {
      console.error("❌ Błąd:", err);
      // Błędy zostawiam w alercie, żebyś wiedział jak user odrzuci transakcję
      // Ale na produkcji też można to zamienić na console.log
      // alert("Błąd: " + (err.shortMessage || "Anulowano"));
    } finally {
      setIsMinting(false);
    }
  };

  const getProgress = (mission) => {
    let current = 0;
    if (mission.type === 'games') current = playerStats.totalGames;
    else if (mission.type === 'apples') current = playerStats.totalApples;
    else if (mission.type === 'score') {
       if (mission.mode === 'classic') current = playerStats.bestScoreClassic || 0;
       else if (mission.mode === 'walls') current = playerStats.bestScoreWalls || 0;
       else if (mission.mode === 'chill') current = playerStats.bestScoreChill || 0;
       else current = playerStats.bestScore || 0;
    }
    const percent = Math.min(100, Math.floor((current / mission.target) * 100));
    return { current, percent };
  };

  const getBadgeTokenId = (missionId) => {
    if (missionId === 'm_newbie') return 0;      
    if (missionId === 'm_supporter') return 2;   
    return null; 
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden relative">
      <div className="flex border-b border-white/10 shrink-0">
         <button onClick={() => setActiveTab('skins')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'skins' ? 'text-neon-blue bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}>
           🎨 Skins
           {activeTab === 'skins' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue" />}
         </button>
         <button onClick={() => setActiveTab('missions')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'missions' ? 'text-yellow-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}>
           🎯 Missions
           {activeTab === 'missions' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400" />}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'skins' && (
           <div className="grid grid-cols-1 gap-3">
             <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-400">YOUR COLLECTION</span>
                <span className="text-xs text-neon-blue">{unlockedSkins.length} / {SKINS.length}</span>
             </div>
             {SKINS.map(skin => {
                const isUnlocked = unlockedSkins.includes(skin.id);
                const isSelected = currentSkinId === skin.id;
                return (
                  <button key={skin.id} disabled={!isUnlocked} onClick={() => onSelectSkin(skin.id)} className={`p-3 rounded-xl border flex items-center justify-between transition-all group ${isSelected ? 'bg-neon-blue/10 border-neon-blue shadow-[0_0_15px_rgba(0,240,255,0.2)]' : 'bg-white/5 border-white/5 hover:bg-white/10'} ${!isUnlocked && 'opacity-60 grayscale'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full shadow-lg relative overflow-hidden border border-white/20" style={{ background: `linear-gradient(135deg, ${skin.color[0]}, ${skin.color[1]})` }}>
                          {isSelected && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                      </div>
                      <div className="text-left">
                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{skin.name}</div>
                        <div className="text-[10px] text-gray-500">{isUnlocked ? 'Ready to equip' : 'Locked'}</div>
                      </div>
                    </div>
                    {isSelected ? <span className="text-[10px] font-bold bg-neon-blue text-black px-2 py-1 rounded">EQUIPPED</span> : isUnlocked ? <span className="text-neon-blue opacity-0 group-hover:opacity-100 transition-opacity">Select</span> : <span className="text-xl">🔒</span>}
                  </button>
                )
             })}
           </div>
        )}

        {activeTab === 'missions' && (
           <div className="space-y-4">
             {MISSIONS.map(mission => {
               const { current, percent } = getProgress(mission);
               const isCompleted = percent >= 100;
               const rewardSkin = SKINS.find(s => s.id === mission.rewardId);
               const tokenId = getBadgeTokenId(mission.id);
               const isNftMission = tokenId !== null && mission.rewardType === 'badge';

               return (
                 <div key={mission.id} className={`relative p-4 rounded-xl border ${isCompleted ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex justify-between items-start mb-2">
                       <div>
                          <div className="flex items-center gap-2">
                             <h3 className={`font-bold text-sm ${isCompleted ? 'text-green-400' : 'text-white'}`}>{mission.title}</h3>
                             {mission.mode && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-gray-400 border border-white/5">{mission.mode === 'walls' ? 'Blitz' : mission.mode === 'chill' ? 'Zen' : 'Classic'}</span>}
                          </div>
                          <p className="text-xs text-gray-400">{mission.desc}</p>
                       </div>
                       
                       <div className="flex flex-col items-end">
                          <span className="text-[9px] text-gray-500 uppercase mb-1">Reward</span>
                          {rewardSkin && (
                            <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/10">
                               <div className="w-3 h-3 rounded-full" style={{ background: `linear-gradient(135deg, ${rewardSkin.color[0]}, ${rewardSkin.color[1]})` }}></div>
                               <span className="text-[10px] text-gray-300">{rewardSkin.name}</span>
                            </div>
                          )}
                          {isNftMission && (
                              isCompleted ? (
                                <button
                                    onClick={() => handleMint(tokenId)}
                                    disabled={isMinting}
                                    className={`text-black text-[10px] font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                                      ${(isMinting) ? 'bg-gray-400' : 'bg-neon-blue hover:bg-cyan-300'}`}
                                >
                                    {isMinting ? "PENDING..." : (tokenId === 2 ? "MINT (0.00034 ETH)" : "CLAIM FREE")}
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/10 opacity-50">
                                    <span className="text-lg leading-none">🔒</span>
                                    <span className="text-[10px] text-gray-300">Locked</span>
                                </div>
                              )
                          )}
                          {!rewardSkin && !isNftMission && (
                             <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/10">
                                <span className="text-lg leading-none">🎖️</span>
                                <span className="text-[10px] text-gray-300">Badge</span>
                             </div>
                          )}
                       </div>
                    </div>
                    <div className="w-full h-2 bg-black/50 rounded-full mt-3 overflow-hidden relative">
                       <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 1, ease: "easeOut" }} className={`h-full ${isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-yellow-600 to-yellow-400'}`} />
                    </div>
                 </div>
               )
             })}
           </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 shrink-0">
         <button onClick={onClose} className="btn-secondary w-full py-3 text-sm">Close Panel</button>
      </div>
    </div>
  );
};
export default SkinMissionsPanel;