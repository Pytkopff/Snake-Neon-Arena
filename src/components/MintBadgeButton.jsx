import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// CONSTANTS
const SUFFIX_FULL = '0x626f696b356e7771080080218021802180218021802180218021'; // 26 bytes
const MARKER_16_BYTES = '0x80218021802180218021802180218021'; // 16 bytes

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
    const { address, connector } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const { data: walletClient } = useWalletClient();

    const [successHash, setSuccessHash] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [isCallsPending, setIsCallsPending] = useState(false);

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
            console.log("✅ Mint Success (EOA fallback)", txHash);
            setSuccessHash(txHash);
            if (onSuccess) onSuccess(txHash);
        }
    }, [isConfirmed, txHash, onSuccess]);

    React.useEffect(() => {
        if (txError) {
            console.error("Tx Error", txError);
            setErrorMessage(txError.message || "Błąd transakcji");
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

            const cleanData = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [address, BigInt(tokenId), 1n, NATIVE_TOKEN, price, allowlistProof, "0x"]
            });

            // Detect Coinbase Smart Wallet
            const isSmartWallet = connector?.id === 'coinbaseWalletSDK' || connector?.name === 'Coinbase Wallet';

            // --- PATH A: AGGRESSIVE SMART WALLET ATTRIBUTION ---
            if (isSmartWallet && walletClient && walletClient.sendCalls) {
                try {
                    console.log('[MintBadge] 🚀 Sending via walletClient.sendCalls (EIP-5792)');
                    console.log('[MintBadge] enforcing dataSuffix capability');

                    setIsCallsPending(true);

                    // AGGRESSIVE: Append full suffix to internal data too (safeguard)
                    const internalDataWithSuffix = concatHex([cleanData, SUFFIX_FULL]);

                    const id = await walletClient.sendCalls({
                        calls: [{
                            to: BADGE_ADDRESS,
                            data: internalDataWithSuffix, // Internal append
                            value: price
                        }],
                        capabilities: {
                            dataSuffix: {
                                value: MARKER_16_BYTES, // External append (Marker only)
                                optional: false // FORCE IT
                            }
                        }
                    });

                    console.log('[MintBadge] sendCalls successful. ID:', id);

                    let idAsString = typeof id === 'object' ? (id.id || JSON.stringify(id)) : String(id);
                    setSuccessHash(idAsString);
                    setIsCallsPending(false);
                    if (onSuccess) onSuccess(idAsString);
                    return;

                } catch (err) {
                    console.warn('[MintBadge] sendCalls attempt failed. Trying fallback...', err);
                    setIsCallsPending(false);
                    // Fall through to Path B
                }
            }

            // --- PATH B: STANDARD / EOA ---
            // Wagmi global config should handle suffix, but we can double-check
            // or just send standard tx. 
            // User reported that global config alone had mixed results, 
            // but for EOA manual works best.

            console.log('[MintBadge] 🛠️ Sending via standard sendTransaction');

            // We rely on Global Config for suffix here (as per Step 394 request simplified logic)
            // BUT if we want to be paranoid and ensure EOA works:
            // Let's manually append if we are not smart wallet?
            // No, user's last request was "Simplified MintBadgeButton".
            // But now "Checker is red".
            // For EOA, "Global Only" (Step 394) was deployed. User says "Rabby... sukces".
            // So EOA path is FINE with global config.

            // Just use standard call.
            sendTransaction({
                to: BADGE_ADDRESS,
                data: cleanData, // Wagmi + Main.jsx Global Suffix handles this
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            setErrorMessage(err.message || "Błąd wykonania");
            setIsCallsPending(false);
            if (onError) onError(err);
        }
    };

    const isWorking = isCallsPending || isTxPending || isWaiting;

    // UI Render
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
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (Attribution Fix)'))
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
