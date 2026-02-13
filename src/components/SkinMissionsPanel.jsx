import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useSwitchChain, usePublicClient } from 'wagmi';
import { ethers } from "ethers"; 
import { getAddress, parseEther } from 'viem'; 
import { SKINS, MISSIONS } from '../utils/constants';
import sdk from '@farcaster/frame-sdk'; // Dodajemy SDK żeby otwierać linki
import { useMiniKit } from '@farcaster/minikit';

const RAW_CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const BASE_CHAIN_ID = 8453;

const iface = new ethers.utils.Interface([
  "function claim(address receiver, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) allowlistProof, bytes data)"
]);
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const PAID_MINT_PRICE = parseEther("0.00034");
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
  const [walletBalance, setWalletBalance] = useState(0n);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  
  // 🔥 NOWY STAN DLA SUKCESU 🔥
  const [mintSuccess, setMintSuccess] = useState(null); // null lub hash transakcji

  const { address, chainId } = useAccount(); 
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const miniKit = useMiniKit();
  const isMiniKitReady = !!miniKit?.wallet && miniKit?.isReady !== false;

  const openExternalUrl = (url) => {
    if (sdk?.actions?.openUrl) {
      sdk.actions.openUrl(url);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Pre-check balance for paid mint (professional UX)
  useEffect(() => {
    let isMounted = true;
    const loadBalance = async () => {
      if (!publicClient || !address) {
        if (isMounted) {
          setWalletBalance(0n);
          setBalanceLoaded(false);
        }
        return;
      }
      try {
        const balance = await publicClient.getBalance({ address });
        if (isMounted) {
          setWalletBalance(balance);
          setBalanceLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          setWalletBalance(0n);
          setBalanceLoaded(false);
        }
      }
    };
    loadBalance();
    return () => { isMounted = false; };
  }, [publicClient, address, chainId]);

  const handleMint = async (tokenId) => {
    if (!address) return;

    if (!miniKit || !miniKit.wallet) {
      alert("Open this app in Base App to mint badges.");
      return;
    }

    if (miniKit.isReady === false) {
      alert("MiniKit wallet is not ready yet. Please try again in a moment.");
      return;
    }

    setIsMinting(true);

    try {
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
          pricePerToken = PAID_MINT_PRICE; 
          valueToSend = pricePerToken;
      }

      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: MAX_UINT256,
        pricePerToken: pricePerToken,
        currency: cleanCurrency
      };

      const txData = iface.encodeFunctionData("claim", [
        address, tokenId, 1, cleanCurrency, pricePerToken, allowlistProof, "0x"
      ]);

      const valueHex = `0x${valueToSend.toString(16)}`;

      const result = await miniKit.wallet.sendCalls({
        calls: [
          {
            to: cleanContractAddress,
            data: txData,
            value: valueHex,
          },
        ],
        capabilities: {
          dataSuffix: {
            // Migracja na MiniKit – ERC-8021 attribution dodane
            // TODO: Wstaw tutaj suffix wygenerowany w Encode Attribution tool dla swojego builder code
            value: '0x07626f696b356e77710080218021802180218021802180218021',
            optional: true,
          },
        },
      });

      let hash = null;
      if (typeof result === 'string') {
        hash = result;
      } else if (Array.isArray(result) && result[0]?.hash) {
        hash = result[0].hash;
      } else if (result?.hash) {
        hash = result.hash;
      } else if (result?.transactions?.[0]?.hash) {
        hash = result.transactions[0].hash;
      }

      console.log("✅ Hash:", hash);

      // ✅ Poczekaj na potwierdzenie w chain (żeby nie pokazać fałszywego sukcesu)
      if (!publicClient) {
        throw new Error("Public client not available");
      }

      if (hash) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error("Transaction failed");
        }
      }

      // 🔥 ZAMIAST ALERTU -> USTAW STAN SUKCESU 🔥
      setMintSuccess(hash || null);

    } catch (err) {
      console.error("❌ Mint Error (MiniKit):", err);
      if (err.message && err.message.includes("User rejected")) {
         // User anulował
      } else {
         alert("Mint failed. Check console.");
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
      
      {/* 🔥 MODAL SUKCESU (NAKŁADKA) 🔥 */}
      <AnimatePresence>
        {mintSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-6 text-center"
          >
             <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500 shadow-[0_0_30px_#22c55e]">
                <div className="text-4xl">🎉</div>
             </div>
             
             <h2 className="text-2xl font-black text-white mb-2 tracking-wider">MINT SUCCESS!</h2>
             <p className="text-gray-400 text-sm mb-6">Your transaction is on its way to the blockchain.</p>
             
             <div className="flex flex-col gap-3 w-full">
               <button 
                 onClick={() => openExternalUrl(`https://basescan.org/tx/${mintSuccess}`)}
                 className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-neon-blue font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
               >
                 🔍 View on BaseScan
               </button>
               
               <button 
                 onClick={() => { setMintSuccess(null); onClose(); }}
                 className="w-full py-3 rounded-xl bg-green-500 text-black font-black tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(34,197,94,0.4)]"
               >
                 AWESOME!
               </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                                <>
                                  {!isMiniKitReady ? (
                                    <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/30 text-[10px] text-yellow-200 text-right">
                                      Open this app in Base App to mint badges.
                                    </div>
                                  ) : (
                                  <>
                                  {(() => {
                                    const isPaidMint = tokenId === 2;
                                    const hasEnoughBalance = !isPaidMint || (balanceLoaded && walletBalance >= PAID_MINT_PRICE);
                                    return (
                                      <>
                                        <button
                                            onClick={() => handleMint(tokenId)}
                                            disabled={isMinting || (isPaidMint && !hasEnoughBalance)}
                                            className={`text-black text-[10px] font-bold px-3 py-1.5 rounded shadow-[0_0_10px_rgba(0,240,255,0.4)] transition-all
                                              ${(isMinting || (isPaidMint && !hasEnoughBalance)) ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-neon-blue to-cyan-300 hover:scale-105'}`}
                                        >
                                            {isMinting ? "MINTING..." : (isPaidMint ? "MINT (0.00034 ETH)" : "CLAIM FREE")}
                                        </button>
                                        {isPaidMint && !hasEnoughBalance && (
                                          <div className="mt-1 text-[9px] text-red-400 text-right">
                                            Not enough ETH for mint
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  </>
                                  )}
                                </>
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