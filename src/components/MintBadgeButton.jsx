import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';
import { Attribution } from 'ox/erc8021';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// CONSTANTS for ATTRIBUTION
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: ['boik5nwq'] }); // 26 bytes

// ALIGNMENT MATH:
// ABI Encoded data = 4 bytes (Selector) + N * 32 bytes (Args).
// Total currently = 4 (mod 32).
// We want Total + Padding + Suffix = 0 (mod 32).
// 4 + P + 26 = 32.
// 30 + P = 32.
// P = 2 bytes.
const PADDING = '0x0000'; // 2 bytes
const ALIGNED_SUFFIX = concatHex([PADDING, DATA_SUFFIX]); // Total 28 bytes

// Result:
// InnerData = 4 + 32*N.
// FinalData = InnerData + 28 = 32 + 32*N = 32*(N+1).
// Since FinalData is a multiple of 32, the outer SmartWallet ABI encoder 
// (which wraps this as `bytes`) will NOT add any trailing zero padding.
// The Suffix will be the exact end of the payload.

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

    const [successHash, setSuccessHash] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

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
            console.log("✅ Mint Success (Aligned)", txHash);
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

            const cleanData = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [address, BigInt(tokenId), 1n, NATIVE_TOKEN, price, allowlistProof, "0x"]
            });

            // --- MATH ALIGNMENT FIX ---
            // Suffix (26) + Padding (2) = 28 bytes.
            // cleanData (4 + N*32) + 28 = 32 + N*32 = 32*(N+1).
            // PERFECT 32-byte ALIGNMENT.

            const fullData = concatHex([cleanData, ALIGNED_SUFFIX]);

            console.log('[MintBadge] 📐 Sending perfectly aligned data (Modulo 32)');
            console.log('[MintBadge] Suffix Block:', ALIGNED_SUFFIX);

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            setErrorMessage(err.message || "Błąd wykonania");
            if (onError) onError(err);
        }
    };

    const isWorking = isTxPending || isWaiting;

    if (successHash) {
        return (
            <div className="flex flex-col gap-2 p-2 bg-green-900/40 border border-green-500/50 rounded-lg">
                <div className="text-green-400 font-bold text-sm text-center">✅ MINT SUKCES!</div>
                <div className="text-[10px] text-gray-400 text-center break-all">{successHash.slice(0, 10)}...</div>

                <div className="flex gap-2 justify-center flex-wrap">
                    <a href={`https://basescan.org/tx/${successHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500">
                        Basescan
                    </a>
                    <a href={`https://builder-code-checker.vercel.app/?hash=${successHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="px-2 py-1 bg-purple-600 text-white text-[10px] rounded hover:bg-purple-500">
                        Checker
                    </a>
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
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (Align Fix)'))
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
