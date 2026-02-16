import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 CONSTANTS
// 1. Full suffix for EOA (Manual Append) - Contains builder code + marker
const SUFFIX_FULL = '0x626f696b356e7771080080218021802180218021802180218021';

// 2. Exact 16-byte marker for Smart Wallet Capability (Base App Requirement)
// Coinbase Smart Wallet ignores suffixes > 16 bytes in capabilities.
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
    const [successHash, setSuccessHash] = useState(null); // For UI display

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
            console.log("✅ Mint Confirm Success (EOA fallback)", txHash);
            setSuccessHash(txHash);
            if (onSuccess) onSuccess(txHash);
        }
    }, [isConfirmed, txHash, onSuccess]);

    React.useEffect(() => {
        if (txError && onError) onError(txError);
    }, [txError, onError]);

    const handleMint = async (e) => {
        e?.stopPropagation();
        if (!address) return;

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

            // --- STRATEGY 1: Smart Wallet (Capability) ---
            // Requirement: EXACTLY 16 bytes marker in capability for Coinbase Smart Wallet.
            if (walletClient && walletClient.sendCalls) {
                try {
                    console.log('[MintBadge] 🚀 Trying EIP-5792 via dataSuffix capability');
                    console.log('[MintBadge] Using 16-byte marker for Coinbase Smart Wallet compatibility');
                    console.log('[MintBadge] Capabilities dataSuffix value:', MARKER_16_BYTES);

                    setIsCallsPending(true);

                    const id = await walletClient.sendCalls({
                        calls: [{
                            to: BADGE_ADDRESS,
                            data: cleanData,
                            value: price
                        }],
                        capabilities: {
                            dataSuffix: {
                                value: MARKER_16_BYTES // <--- 16 bytes ONLY
                            }
                        }
                    });

                    console.log('[MintBadge] sendCalls successful. Bundle ID:', id);
                    setCallsId(id);
                    setSuccessHash(id); // Use ID as hash/identifier for now
                    setIsCallsPending(false);
                    if (onSuccess) onSuccess(id);
                    return;

                } catch (err) {
                    console.warn('[MintBadge] sendCalls failed. Falling back to EOA manual append.', err);
                    setIsCallsPending(false);
                }
            }

            // --- STRATEGY 2: EOA Fallback (Manual Append) ---
            // Requirement: FULL suffix manually concatenated.
            console.log('[MintBadge] 🛠️ Fallback to EOA manual append');
            console.log('[MintBadge] Suffix:', SUFFIX_FULL);

            const fullData = concatHex([cleanData, SUFFIX_FULL]);

            console.log('[MintBadge] Final data last 32:', fullData.slice(-32));

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            if (onError) onError(err);
        }
    };

    const isWorking = isCallsPending || isTxPending || isWaiting;

    // --- UI RENDER ---

    if (successHash) {
        return (
            <div className="flex flex-col gap-2 p-2 bg-green-900/40 border border-green-500/50 rounded-lg">
                <div className="text-green-400 font-bold text-sm text-center">✅ MINT SUKCES!</div>
                <div className="text-[10px] text-gray-400 text-center break-all">{successHash.slice(0, 10)}...</div>

                <div className="flex gap-2 justify-center">
                    <a href={`https://basescan.org/tx/${successHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500">
                        Basescan
                    </a>
                    <a href={`https://builder-code-checker.vercel.app/?hash=${successHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 bg-purple-600 text-white text-[10px] rounded hover:bg-purple-500">
                        Sprawdź Checker
                    </a>
                </div>
            </div>
        );
    }

    return (
        <button
            onClick={handleMint}
            disabled={disabled || isWorking}
            className={className}
        >
            {typeof children === 'function'
                ? children({ isWorking, isSending: isWorking, isWaiting: isWaiting, isConfirmed: !!successHash })
                : (children || (isWorking ? 'Minting...' : 'Mint Badge (8021 Fix)'))
            }
        </button>
    );
};
