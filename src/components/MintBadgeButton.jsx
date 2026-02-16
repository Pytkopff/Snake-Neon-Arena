import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';
// We don't need to import Attribution here for the suffix string if we use constants, 
// but we can log the logic.

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 CONSTANTS
const SUFFIX_FULL = '0x626f696b356e7771080080218021802180218021802180218021';
const MARKER_16_BYTES = '0x80218021802180218021802180218021';

// Minimal ABI
const BADGE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "receiver", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "uint256", "name": "quantity", "type": "uint256" },
            { "internalType": "address", "name": "currency", "type": "address" },
            { "internalType": "uint256", "name": "pricePerToken", "type": "uint256" },
            {
                "components": [
                    { "internalType": "bytes32[]", "name": "proof", "type": "bytes32[]" },
                    { "internalType": "uint256", "name": "quantityLimitPerWallet", "type": "uint256" },
                    { "internalType": "uint256", "name": "pricePerToken", "type": "uint256" },
                    { "internalType": "address", "name": "currency", "type": "address" }
                ],
                "internalType": "struct IDrop.AllowlistProof",
                "name": "allowlistProof",
                "type": "tuple"
            },
            { "internalType": "bytes", "name": "data", "type": "bytes" }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
];

/**
 * MintBadgeButton with Hybrid ERC-8021 Attribution
 * 
 * Strategy:
 * 1. Global `dataSuffix` configured in wagmi config (via ox/erc8021).
 *    - This helps standard auto-attribution where supported.
 * 2. Smart Wallet (Base App) specific fix:
 *    - Uses `sendCalls` with `capabilities`.
 *    - Passes ONLY the 16-byte marker (`0x8021...`) because longer suffixes are ignored by Coinbase Smart Wallet.
 * 3. EOA Fallback (MetaMask/Rabby):
 *    - Uses `sendTransaction`.
 *    - Manually appends the FULL suffix (`0x626f...`) effectively double-patching if global fails, ensuring green checker.
 */
export default function MintBadgeButton({
    tokenId,
    onSuccess,
    onError,
    priceETH = "0",
    className = '',
    disabled,
    children
}) {
    const { address } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const { data: walletClient } = useWalletClient();

    // State
    const [callsId, setCallsId] = useState(null);
    const [isCallsPending, setIsCallsPending] = useState(false);
    const [successHash, setSuccessHash] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Fallback (EOA) Hooks
    const {
        data: txHash,
        sendTransaction,
        isPending: isTxPending,
        error: txError
    } = useSendTransaction();

    const {
        isLoading: isWaiting,
        isSuccess: isConfirmed
    } = useWaitForTransactionReceipt({ hash: txHash });

    React.useEffect(() => {
        if (isConfirmed && txHash) {
            console.log("✅ Mint Confirm Success (EOA switch)", txHash);
            setSuccessHash(txHash);
            if (onSuccess) onSuccess(txHash);
        }
    }, [isConfirmed, txHash, onSuccess]);

    React.useEffect(() => {
        if (txError) {
            console.error("Tx Error", txError);
            setErrorMessage(txError.message || "Transakcja nieudana");
            if (onError) onError(txError);
        }
    }, [txError, onError]);

    const handleMint = async (e) => {
        e?.stopPropagation();
        if (!address) return;

        setErrorMessage(null);

        try {
            if (chainId !== BASE_CHAIN_ID) {
                try { await switchChainAsync({ chainId: BASE_CHAIN_ID }); }
                catch (e) { console.error(e); }
            }

            const price = parseEther(priceETH.toString());
            const allowlistProof = { proof: [], quantityLimitPerWallet: MAX_UINT256, pricePerToken: price, currency: NATIVE_TOKEN };

            // Base Clean Data
            const cleanData = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [address, BigInt(tokenId), 1n, NATIVE_TOKEN, price, allowlistProof, "0x"]
            });

            // --- STRATEGY 1: Smart Wallet (Capability + 16-byte Marker) ---
            if (walletClient && walletClient.sendCalls) {
                try {
                    console.log('[MintBadge] 🚀 Trying EIP-5792 via dataSuffix capability');
                    console.log('[MintBadge] Using 16-byte marker for Coinbase Smart Wallet compatibility');
                    console.log('[MintBadge] Marker:', MARKER_16_BYTES);

                    setIsCallsPending(true);

                    const sendCallsResult = await walletClient.sendCalls({
                        calls: [{
                            to: BADGE_ADDRESS,
                            data: cleanData,
                            value: price
                        }],
                        capabilities: {
                            dataSuffix: {
                                value: MARKER_16_BYTES, // <--- 16 bytes ONLY
                                optional: true
                            }
                        }
                    });

                    console.log('[MintBadge] sendCalls successful. Result:', sendCallsResult);

                    let idAsString = null;
                    if (typeof sendCallsResult === 'string') {
                        idAsString = sendCallsResult;
                    } else if (typeof sendCallsResult === 'object' && sendCallsResult !== null) {
                        idAsString = sendCallsResult.id || JSON.stringify(sendCallsResult);
                    } else {
                        idAsString = String(sendCallsResult);
                    }

                    setCallsId(idAsString);
                    setSuccessHash(idAsString);
                    setIsCallsPending(false);
                    if (onSuccess) onSuccess(idAsString);
                    return;

                } catch (err) {
                    console.warn('[MintBadge] sendCalls failed/unsupported. Falling back to EOA.', err);
                    setIsCallsPending(false);
                }
            }

            // --- STRATEGY 2: EOA Fallback (Manual Full Suffix) ---
            console.log('[MintBadge] 🛠️ Fallback to EOA manual append');
            console.log('[MintBadge] Suffix:', SUFFIX_FULL);

            const fullData = concatHex([cleanData, SUFFIX_FULL]);

            if (typeof fullData === 'string') {
                console.log('[MintBadge] Final data last 32:', fullData.slice(-32));
            }

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Global Error:", err);
            setErrorMessage(err.message || "Błąd wykonania");
            if (onError) onError(err);
            setIsCallsPending(false);
        }
    };

    const isWorking = isCallsPending || isTxPending || isWaiting;

    // --- UI RENDER ---
    if (successHash) {
        const displayHash = typeof successHash === 'string' ? successHash : 'Bundle Sent';
        const isTxHash = typeof successHash === 'string' && successHash.startsWith('0x') && successHash.length === 66;

        return (
            <div className="flex flex-col gap-2 p-2 bg-green-900/40 border border-green-500/50 rounded-lg">
                <div className="text-green-400 font-bold text-sm text-center">✅ MINT SUKCES!</div>
                <div className="text-[10px] text-gray-400 text-center break-all">{displayHash.slice(0, 10)}...</div>

                <div className="flex gap-2 justify-center flex-wrap">
                    {isTxHash && (
                        <a href={`https://basescan.org/tx/${successHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500">
                            Basescan
                        </a>
                    )}
                    {isTxHash && (
                        <a href={`https://builder-code-checker.vercel.app/?hash=${successHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 bg-purple-600 text-white text-[10px] rounded hover:bg-purple-500">
                            Checker
                        </a>
                    )}
                    <button
                        onClick={() => { navigator.clipboard.writeText(String(successHash)); alert('Skopiowano!'); }}
                        className="px-2 py-1 bg-gray-600 text-white text-[10px] rounded hover:bg-gray-500">
                        Kopiuj
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleMint}
                disabled={disabled || isWorking}
                className={className}
            >
                {typeof children === 'function'
                    ? children({ isWorking, isSending: isWorking, isWaiting: isWaiting, isConfirmed: !!successHash })
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (8021 Hybrid)'))
                }
            </button>
            {errorMessage && (
                <div className="text-red-400 text-[10px] text-center px-1 break-words">
                    {errorMessage.slice(0, 100)}
                </div>
            )}
        </div>
    );
};
