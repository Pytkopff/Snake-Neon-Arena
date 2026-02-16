import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 CONSTANTS
const SUFFIX_RAW = '0x626f696b356e7771080080218021802180218021802180218021'; // 26 bytes
// We need to align the suffix to 32 bytes to prevent ABI encoders from adding trailing zeros
// 32 - 26 = 6 bytes of padding needed.
// We prepend 6 bytes of zeros (`00` * 6 = 12 chars).
const PREFIX_PADDING = '0x000000000000';
const ALIGNED_SUFFIX_32_BYTES = concatHex([PREFIX_PADDING, SUFFIX_RAW]);

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

            // --- LOGIC: ALIGNED SUFFIX ---
            // We manually append a 32-byte aligned suffix to the INTERNAL calldata.
            // This prevents ABI encoders (in Smart Wallets) from adding trailing zero-padding.
            // Result: The ERC-8021 marker stays at the very end of the UserOperation calldata.

            console.log('[MintBadge] 📏 Using 32-byte Aligned Suffix strategy');
            console.log('[MintBadge] Suffix Raw:', SUFFIX_RAW);
            console.log('[MintBadge] Aligned Suffix (32b):', ALIGNED_SUFFIX_32_BYTES);

            const fullData = concatHex([cleanData, ALIGNED_SUFFIX_32_BYTES]);

            const isSmartWallet = connector?.id === 'coinbaseWalletSDK' || connector?.name === 'Coinbase Wallet';

            if (isSmartWallet && walletClient && walletClient.sendCalls) {
                try {
                    console.log('[MintBadge] 🚀 Sending via walletClient.sendCalls');

                    setIsCallsPending(true);

                    // We send the 'fullData' (internal append) directly.
                    // We DO NOT use capabilities here, because "manual internal" is safer 
                    // once we handle the padding issue.

                    const id = await walletClient.sendCalls({
                        calls: [{
                            to: BADGE_ADDRESS,
                            data: fullData,
                            value: price
                        }]
                    });

                    console.log('[MintBadge] sendCalls successful. ID:', id);

                    let idAsString = typeof id === 'object' ? (id.id || JSON.stringify(id)) : String(id);
                    setSuccessHash(idAsString);
                    setIsCallsPending(false);
                    if (onSuccess) onSuccess(idAsString);
                    return;

                } catch (err) {
                    console.warn('[MintBadge] sendCalls failed. Fallback...', err);
                    setIsCallsPending(false);
                }
            }

            // Fallback EOA
            console.log('[MintBadge] 🛠️ Sending via standard sendTransaction (Manual Aligned Append)');

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData, // Using the aligned suffix here too, safe for EOA as well.
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
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (32b Fix)'))
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
