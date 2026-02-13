import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { getAddress, parseEther } from 'viem';
import sdk from '@farcaster/frame-sdk';
import { useMiniKit } from '@farcaster/minikit';

// 🏆 Badge mint constants
const RAW_CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const BASE_CHAIN_ID = 8453;
const PAID_MINT_PRICE = parseEther("0.00034");
const iface = new ethers.utils.Interface([
  "function claim(address receiver, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, tuple(bytes32[] proof, uint256 quantityLimitPerWallet, uint256 pricePerToken, address currency) allowlistProof, bytes data)"
]);
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const GameOver = ({ score, maxCombo, bestScore, isNewRecord, onRestart, onShare, onBackToMenu, endReason, applesCollected }) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  // 🔥 FIX 1: Stan blokady przycisków (Anti-Rage Click)
  const [canInteract, setCanInteract] = useState(false);

  // 🏆 Badge mint state (osobny stan dla każdego badge'a)
  const [mintingId, setMintingId] = useState(null); // null | 0 | 2 (który badge się mintuje)
  const [mintResults, setMintResults] = useState({}); // { 0: 'success', 2: 'error' }
  const [walletBalance, setWalletBalance] = useState(0n);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const miniKit = useMiniKit();
  const isMiniKitReady = !!miniKit?.wallet && miniKit?.isReady !== false;

  // Sprawdź balans walleta (potrzebne dla paid mint)
  useEffect(() => {
    let isMounted = true;
    const loadBalance = async () => {
      if (!publicClient || !address) return;
      try {
        const balance = await publicClient.getBalance({ address });
        if (isMounted) { setWalletBalance(balance); setBalanceLoaded(true); }
      } catch { if (isMounted) { setWalletBalance(0n); setBalanceLoaded(false); } }
    };
    loadBalance();
    return () => { isMounted = false; };
  }, [publicClient, address, chainId]);

  const handleMintBadge = async (tokenId) => {
    if (!address) return;

    if (!miniKit || !miniKit.wallet) {
      alert("Open this app in Base App to mint badges.");
      return;
    }

    if (miniKit.isReady === false) {
      alert("MiniKit wallet is not ready yet. Please try again in a moment.");
      return;
    }

    const isPaid = tokenId === 2;
    const price = isPaid ? PAID_MINT_PRICE : 0n;

    setMintingId(tokenId);
    setMintResults(prev => ({ ...prev, [tokenId]: null }));
    try {
      if (chainId !== BASE_CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: BASE_CHAIN_ID });
        } catch {
          alert("Please switch to Base network manually.");
          setMintingId(null);
          return;
        }
      }

      const cleanContractAddress = getAddress(RAW_CONTRACT_ADDRESS.trim());
      const cleanCurrency = getAddress(NATIVE_TOKEN);
      const allowlistProof = {
        proof: [],
        quantityLimitPerWallet: MAX_UINT256,
        pricePerToken: price,
        currency: cleanCurrency
      };

      const txData = iface.encodeFunctionData("claim", [
        address, tokenId, 1, cleanCurrency, price, allowlistProof, "0x"
      ]);

      // Konwersja wartości na hex zgodny z przykładem MiniKit/Base
      const valueHex = `0x${price.toString(16)}`;

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

      // Próbujemy wyciągnąć hash transakcji z wyniku MiniKit (zostawiamy elastyczną obsługę)
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

      if (publicClient && hash) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error("Transaction failed");
      }

      setMintResults(prev => ({ ...prev, [tokenId]: 'success' }));
    } catch (err) {
      console.error("❌ Badge Mint Error (MiniKit):", err);
      if (!err.message?.includes("User rejected")) {
        setMintResults(prev => ({ ...prev, [tokenId]: 'error' }));
      }
    } finally {
      setMintingId(null);
    }
  };

  // 1. EFEKT KASYNA (Ticker)
  useEffect(() => {
    let start = 0;
    const duration = 1500; 
    const steps = 60;
    const increment = score / steps;
    const stepTime = duration / steps;

    if (score === 0) return;

    const timer = setInterval(() => {
      start += increment;
      if (start >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [score]);

  // 🔥 FIX 2: Timer odblokowujący przyciski (1.5 sekundy opóźnienia)
  useEffect(() => {
    setCanInteract(false);
    const timer = setTimeout(() => {
      setCanInteract(true);
    }, 1500); // 1500ms czasu na "ochłonięcie"

    return () => clearTimeout(timer);
    }, [score]);
  

  // 2. OBLICZENIA PASKA "CHASE"
  const progressToBest = bestScore > 0 ? Math.min(100, (score / bestScore) * 100) : 100;
  const missingPoints = bestScore - score;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
        className="glass rounded-2xl p-6 w-full max-w-sm text-center border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden my-auto shrink-0"
      >
        
        {/* Tło dla Nowego Rekordu */}
        {isNewRecord && (
           <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/10 via-purple-500/10 to-transparent animate-pulse pointer-events-none" />
        )}

        {/* --- NAGŁÓWEK --- */}
        <div className="mb-6 relative z-10">
          {isNewRecord ? (
            <motion.div 
              animate={{ scale: [1, 1.05, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <div className="text-5xl mb-2 drop-shadow-lg">🏆</div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] uppercase italic">
                New Record!
              </h2>
              <p className="text-sm text-yellow-200 font-bold mt-1">LEGENDARY RUN!</p>
            </motion.div>
          ) : (
            <div>
              <div className="text-5xl mb-2 grayscale opacity-80">
                 {endReason === 'timeup' ? "⏱️" : "💀"}
              </div>
              <h2 className="text-3xl font-black text-white drop-shadow-md uppercase">
                 {endReason === 'timeup' ? "Time's Up" : "Game Over"}
              </h2>
              <p className="text-sm text-gray-400 mt-1">Don't give up! Try again.</p>
            </div>
          )}
        </div>

        {/* --- WYNIK GŁÓWNY (Licznik) --- */}
        <div className="mb-6 relative z-10">
          <div className="text-6xl font-black text-white drop-shadow-[0_0_20px_rgba(0,240,255,0.4)] font-mono tracking-tighter">
            {displayScore.toLocaleString()}
          </div>
          <div className="text-xs text-neon-blue font-bold tracking-widest uppercase mt-1">Final Score</div>
        </div>

        {/* --- PASEK POŚCIGU (Tylko jak przegrasz) --- */}
        {!isNewRecord && bestScore > 0 && (
          <div className="mb-6 bg-black/40 rounded-xl p-3 border border-white/5 relative z-10 mx-2">
             <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-bold">
                <span>Progress to Best</span>
                <span className="text-white">{Math.floor(progressToBest)}%</span>
             </div>
             <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${progressToBest}%` }} 
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-gray-600 via-gray-400 to-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                />
             </div>
             <p className="text-[10px] text-gray-400 mt-2">
                You were only <span className="text-red-400 font-bold">{missingPoints} pts</span> away from glory!
             </p>
          </div>
        )}

        {/* --- STATYSTYKI --- */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-bold text-red-400 drop-shadow-sm">{applesCollected}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Apples</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="text-2xl font-bold text-yellow-400 drop-shadow-sm">x{maxCombo || 0}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Max Combo</div>
          </div>
        </div>

        {/* --- 🏆 BADGE MINT SECTION --- */}
        {address && (
          <div 
            className="space-y-2 mb-4 relative z-10"
            style={{
              opacity: canInteract ? 1 : 0,
              transition: 'opacity 0.5s ease-in'
            }}
          >
            {!isMiniKitReady ? (
              <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-[11px] text-yellow-200">
                {/* Fallback poza Base App / MiniKit */}
                Open this app in Base App to mint badges.
              </div>
            ) : (
            <>
            {/* Hello World Badge (FREE) */}
            {mintResults[0] === 'success' ? (
              <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <span className="text-base">✅</span>
                <span className="text-xs font-bold text-green-400">Hello World Claimed!</span>
              </div>
            ) : (
              <button
                onClick={() => handleMintBadge(0)}
                disabled={mintingId !== null}
                className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl border transition-all
                  ${mintingId === 0 
                    ? 'bg-white/5 border-white/10 cursor-wait' 
                    : 'bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:border-yellow-400/50 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white leading-tight">Hello World Badge</div>
                    <div className="text-[10px] text-gray-400">Free mint on Base</div>
                  </div>
                </div>
                <div className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all
                  ${mintingId === 0 
                    ? 'bg-gray-600 text-gray-300' 
                    : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                  }`}>
                  {mintingId === 0 ? 'MINTING...' : mintResults[0] === 'error' ? 'RETRY' : 'CLAIM FREE'}
                </div>
              </button>
            )}

            {/* Supporter Badge (PAID) */}
            {mintResults[2] === 'success' ? (
              <div className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-500/10 border border-green-500/30">
                <span className="text-base">✅</span>
                <span className="text-xs font-bold text-green-400">Supporter Badge Claimed!</span>
              </div>
            ) : (
              <button
                onClick={() => handleMintBadge(2)}
                disabled={mintingId !== null || (balanceLoaded && walletBalance < PAID_MINT_PRICE)}
                className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl border transition-all
                  ${mintingId === 2 
                    ? 'bg-white/5 border-white/10 cursor-wait' 
                    : (balanceLoaded && walletBalance < PAID_MINT_PRICE)
                      ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 hover:border-cyan-400/50 hover:scale-[1.01] active:scale-[0.99]'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">💎</span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-white leading-tight">Supporter Badge</div>
                    <div className="text-[10px] text-gray-400">
                      {balanceLoaded && walletBalance < PAID_MINT_PRICE ? 'Not enough ETH' : 'Support the Dev'}
                    </div>
                  </div>
                </div>
                <div className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all
                  ${mintingId === 2 
                    ? 'bg-gray-600 text-gray-300' 
                    : (balanceLoaded && walletBalance < PAID_MINT_PRICE)
                      ? 'bg-gray-700 text-gray-400'
                      : 'bg-gradient-to-r from-cyan-500 to-teal-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                  }`}>
                  {mintingId === 2 ? 'MINTING...' : mintResults[2] === 'error' ? 'RETRY' : '0.00034 ETH'}
                </div>
              </button>
            )}
            </>
            )}
          </div>
        )}

        {/* --- PRZYCISKI Z OCHRONĄ PRZED RAGE-CLICK --- */}
        <div 
            className="space-y-3 relative z-10"
            style={{
                opacity: canInteract ? 1 : 0,           // Niewidoczne -> Widoczne
                pointerEvents: canInteract ? 'auto' : 'none', // Klikalne -> Nieklikalne
                filter: canInteract ? 'none' : 'grayscale(100%)', // Opcjonalnie: Szare na start
                transition: 'opacity 0.5s ease-in, filter 0.5s ease-in' // Płynne wejście
            }}
        >
          <button
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-neon-blue text-black font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(0,240,255,0.4)]"
          >
            🔄 PLAY AGAIN
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={onBackToMenu}
              className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold text-sm border border-white/10 hover:bg-white/10 transition-colors"
            >
              ↩️ Menu
            </button>
            <button
              onClick={onShare}
              className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2
                ${isNewRecord 
                  ? 'bg-purple-600 border-purple-400 text-white animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                  : 'bg-transparent border-white/10 text-gray-300 hover:bg-white/5'
                }`}
            >
              🚀 Share
            </button>
          </div>
        </div>

        {/* Tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-[10px] text-gray-500 mt-4"
        >
          💡 Tip: Grab magnets to collect apples from a distance!
        </motion.p>

      </motion.div>
    </motion.div>
  );
};

export default GameOver;