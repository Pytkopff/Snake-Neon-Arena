import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useWalletClient, useSwitchChain } from 'wagmi';
import { ethers } from "ethers"; 
import { getAddress, parseEther } from 'viem'; 
import { SKINS, MISSIONS } from '../utils/constants';

const RAW_CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const BASE_CHAIN_ID = 8453; // ID sieci Base

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
  const [activeTab, setActiveTab] = useState('missions');
  const [isMinting, setIsMinting] = useState(false);

  const { address, chainId } = useAccount(); 
  const { data: walletClient } = useWalletClient(); 
  const { switchChainAsync } = useSwitchChain();

  const handleMint = async (tokenId) => {
    if (!address || !walletClient) return;

    setIsMinting(true);

    try {
      // 1. Sprawdź sieć
      if (chainId !== BASE_CHAIN_ID) {
          try {
              await switchChainAsync({ chainId: BASE_CHAIN_ID });
          } catch (e) {
              alert("Please switch to Base network manually.");
              setIsMinting(false);
              return;
          }
      }

      console.log("🛠️ Mint start...");
      const cleanContractAddress = getAddress(RAW_CONTRACT_ADDRESS.trim());
      const cleanCurrency = getAddress(NATIVE_TOKEN);

      let pricePerToken = 0n;
      let valueToSend = 0n;

      if (tokenId === 2) {
          pricePerToken = parseEther("0.00034"); 
          valueToSend = pricePerToken;
      }

      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: MAX_UINT256, // Nielimitowany mint (musi pasować do Unlimited w Thirdweb)
        pricePerToken: pricePerToken,
        currency: cleanCurrency
      };

      const txData = iface.encodeFunctionData("claim", [
        address, tokenId, 1, cleanCurrency, pricePerToken, allowlistProof, "0x"
      ]);

      const hash = await walletClient.sendTransaction({
        account: address,
        to: cleanContractAddress,
        data: txData,
        value: valueToSend,
      });

      console.log("✅ Hash:", hash);

      // 🔥 NOWOŚĆ: Powiadomienie o sukcesie!
      alert(`🎉 MINT STARTED!\n\nYour transaction has been sent.\nThe badge will appear in your wallet soon.\n\nTx Hash: ${hash.slice(0, 10)}...`);
      
      onClose(); // Zamknij panel, żeby gracz wrócił do gry

    } catch (err) {
      console.error("❌ Mint Error:", err);
      // 🔥 NOWOŚĆ: Obsługa błędów dla użytkownika
      if (err.message && err.message.includes("User rejected")) {
         // Użytkownik anulował, nic nie rób
      } else {
         alert("Mint failed. Check console for details or make sure you have enough ETH for gas.");
      }
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
    <div className="flex-1 flex flex-col min-h-0 bg-black/80 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden relative shadow-2xl">
      {/* TABS */}
      <div className="flex border-b border-white/10 shrink-0 bg-white/5">
         <button onClick={() => setActiveTab('skins')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'skins' ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'}`}>
           🎨 Skins
           {activeTab === 'skins' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-blue shadow-[0_0_10px_#00f0ff]" />}
         </button>
         <button onClick={() => setActiveTab('missions')} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'missions' ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>
           🎯 Missions
           {activeTab === 'missions' && <motion.div layoutId="tab-highlight" className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-400 shadow-[0_0_10px_#facc15]" />}
         </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* SKINS TAB */}
        {activeTab === 'skins' && (
           <div className="grid grid-cols-1 gap-3">
             <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Your Collection</span>
                <span className="text-xs font-mono text-neon-blue">{unlockedSkins.length} / {SKINS.length}</span>
             </div>
             {SKINS.map(skin => {
                const isUnlocked = unlockedSkins.includes(skin.id);
                const isSelected = currentSkinId === skin.id;
                return (
                  <button key={skin.id} disabled={!isUnlocked} onClick={() => onSelectSkin(skin.id)} 
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all group relative overflow-hidden
                    ${isSelected ? 'bg-neon-blue/10 border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]' : 'bg-white/5 border-white/5 hover:bg-white/10'} 
                    ${!isUnlocked && 'opacity-60 grayscale'}`}
                  >
                    <div className="flex items-center gap-4 z-10">
                      <div className="w-12 h-12 rounded-lg shadow-inner relative overflow-hidden border border-white/10 flex items-center justify-center bg-black/40">
                          <div className="w-8 h-8 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ background: `linear-gradient(135deg, ${skin.color[0]}, ${skin.color[1]})` }}></div>
                      </div>
                      <div className="text-left">
                        <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{skin.name}</div>
                        <div className="text-[10px] text-gray-500">{isUnlocked ? 'Tap to equip' : 'Complete missions to unlock'}</div>
                      </div>
                    </div>
                    
                    <div className="z-10">
                        {isSelected ? <span className="text-[10px] font-bold bg-neon-blue text-black px-2 py-1 rounded shadow-[0_0_10px_rgba(0,240,255,0.5)]">EQUIPPED</span> : isUnlocked ? <span className="text-neon-blue opacity-0 group-hover:opacity-100 transition-opacity text-xs">SELECT</span> : <span className="text-lg">🔒</span>}
                    </div>
                  </button>
                )
             })}
           </div>
        )}

        {/* MISSIONS TAB */}
        {activeTab === 'missions' && (
           <div className="space-y-4 pb-4">
             {MISSIONS.map(mission => {
               const { current, percent } = getProgress(mission);
               const isCompleted = percent >= 100;
               const rewardSkin = SKINS.find(s => s.id === mission.rewardId);
               const tokenId = getBadgeTokenId(mission.id);
               const isNftMission = tokenId !== null && mission.rewardType === 'badge';

               return (
                 <div key={mission.id} className={`relative p-4 rounded-xl border transition-all ${isCompleted ? 'bg-gradient-to-br from-green-900/20 to-black border-green-500/30' : 'bg-white/5 border-white/5'}`}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                       <div>
                          <div className="flex items-center gap-2 mb-1">
                             <h3 className={`font-bold text-sm tracking-wide ${isCompleted ? 'text-green-400' : 'text-white'}`}>{mission.title}</h3>
                             {mission.mode && <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-black/40 text-gray-400 border border-white/10">{mission.mode === 'walls' ? 'Blitz' : mission.mode === 'chill' ? 'Zen' : 'Classic'}</span>}
                          </div>
                          <p className="text-xs text-gray-400 leading-tight">{mission.desc}</p>
                       </div>
                       
                       {/* Reward Badge */}
                       <div className="flex flex-col items-end gap-1">
                          {rewardSkin && (
                            <div className="flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded border border-white/10">
                               <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ background: rewardSkin.color[1], color: rewardSkin.color[1] }}></div>
                               <span className="text-[10px] text-gray-300 font-bold">{rewardSkin.name}</span>
                            </div>
                          )}
                          {isNftMission && (
                              isCompleted ? (
                                <button
                                    onClick={() => handleMint(tokenId)}
                                    disabled={isMinting}
                                    className={`text-black text-[10px] font-bold px-3 py-1.5 rounded shadow-[0_0_10px_rgba(0,240,255,0.4)] transition-all
                                      ${(isMinting) ? 'bg-gray-400 cursor-wait' : 'bg-gradient-to-r from-neon-blue to-cyan-300 hover:scale-105'}`}
                                >
                                    {isMinting ? "MINTING..." : (tokenId === 2 ? "MINT (0.00034 ETH)" : "CLAIM FREE")}
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded border border-white/10 opacity-50">
                                    <span className="text-[10px]">🔒 Locked</span>
                                </div>
                              )
                          )}
                       </div>
                    </div>

                    {/* 🔥 NEON PROGRESS BAR 🔥 */}
                    <div className="relative pt-2">
                       <div className="flex justify-between text-[10px] font-mono mb-1 text-gray-400">
                           <span>Progress</span>
                           <span className={isCompleted ? "text-green-400" : "text-white"}>{current} / {mission.target} ({percent}%)</span>
                       </div>
                       <div className="w-full h-3 bg-black/60 rounded-full overflow-hidden border border-white/10 shadow-inner">
                          <motion.div 
                             initial={{ width: 0 }} 
                             animate={{ width: `${percent}%` }} 
                             transition={{ duration: 1.5, ease: "easeOut" }} 
                             className={`h-full relative ${isCompleted ? 'bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_10px_#10b981]' : 'bg-gradient-to-r from-yellow-600 to-yellow-400'}`}
                          >
                             {/* Błysk na pasku */}
                             <div className="absolute top-0 right-0 bottom-0 w-2 bg-white/50 blur-sm transform skew-x-12"></div>
                          </motion.div>
                       </div>
                    </div>
                 </div>
               )
             })}
           </div>
        )}
      </div>

      <div className="p-4 border-t border-white/10 shrink-0 bg-black/40">
         <button onClick={onClose} className="btn-secondary w-full py-3 text-sm hover:bg-white/10 border-white/20">Close Panel</button>
      </div>
    </div>
  );
};
export default SkinMissionsPanel;