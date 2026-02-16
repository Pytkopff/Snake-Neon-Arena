import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 Suffix / Marker
// Full valid suffix for attribution
const SUFFIX = '0x626f696b356e7771080080218021802180218021802180218021';

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
 * MintBadgeButton (Universal: EOA + AA)
 * 
 * Logic / How it works:
 * 1. Checks for Smart Wallet support via `walletClient.sendCalls` (EIP-5792).
 * 2. If supported (e.g. Coinbase Base App), uses `capabilities: { dataSuffix: ... }`.
 *    - Wallet appends suffix AFTER `executeBatch` wrapper -> ✅ Green Checker.
 * 3. If NOT supported or fails (e.g. MetaMask/EOA), falls back to `useSendTransaction`.
 *    - Manually appends suffix via `concatHex` -> ✅ Green Checker (for EOA).
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

    // State for tracking EIP-5792 call
    const [callsId, setCallsId] = useState(null);
    const [isCallsPending, setIsCallsPending] = useState(false);

    // Wagmi Hook for EOA Fallback
    const {
        data: txHash,
        sendTransaction,
        isPending: isTxPending,
        error: txError
    } = useSendTransaction();

    // Wait for Receipt (works for fallback hash)
    const {
        isLoading: isWaiting,
        isSuccess: isConfirmed
    } = useWaitForTransactionReceipt({ hash: txHash });

    React.useEffect(() => {
        // Handle Success (Fallback Path)
        if (isConfirmed && txHash) {
            handleSuccess(txHash);
        }
    }, [isConfirmed, txHash]);

    // Handler for success actions
    const handleSuccess = (hashOrId) => {
        console.log("✅ Mint Success! ID/Hash:", hashOrId);
        if (onSuccess) onSuccess(hashOrId);

        setTimeout(() => {
            // If it's a long hash, assume it's a tx hash and open explorer
            if (hashOrId.length > 40) {
                window.open(`https://basescan.org/tx/${hashOrId}`, '_blank');
            }
            // Always try checker (might need hash if it was a batch ID, but likely hash for single op)
            window.open(`https://builder-code-checker.vercel.app/`, '_blank');
        }, 2000);
    };

    const handleMint = async (e) => {
        e?.stopPropagation();

        if (!address) {
            console.warn("Wallet not connected");
            return;
        }

        try {
            // 0. Network Check
            if (chainId !== BASE_CHAIN_ID) {
                try {
                    await switchChainAsync({ chainId: BASE_CHAIN_ID });
                } catch (switchError) {
                    console.error("Failed to switch chain:", switchError);
                    // Try to proceed, or return
                }
            }

            const price = parseEther(priceETH.toString());

            const allowlistProof = {
                proof: [],
                quantityLimitPerWallet: MAX_UINT256,
                pricePerToken: price,
                currency: NATIVE_TOKEN
            };

            // 1. Prepare CLEAN data (args end with "0x" empty bytes)
            const cleanData = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [
                    address,
                    BigInt(tokenId),
                    1n,
                    NATIVE_TOKEN,
                    price,
                    allowlistProof,
                    "0x"
                ]
            });

            // --- PATH A: Smart Wallet (EIP-5792) ---
            if (walletClient && walletClient.sendCalls) {
                try {
                    console.log('[MintBadge] 🚀 Trying EIP-5792 via dataSuffix capability (Smart Wallet Path)');
                    console.log('[MintBadge] Suffix:', SUFFIX);

                    setIsCallsPending(true);

                    const id = await walletClient.sendCalls({
                        calls: [{
                            to: BADGE_ADDRESS,
                            data: cleanData, // Clean data here! Suffix goes in capabilities.
                            value: price
                        }],
                        capabilities: {
                            dataSuffix: {
                                value: SUFFIX,
                                optional: true // Try to append, but don't fail hard if ignored (though we want it!)
                            }
                        }
                    });

                    console.log('[MintBadge] sendCalls successful. Bundle ID:', id);
                    setCallsId(id);
                    setIsCallsPending(false);
                    handleSuccess(id);
                    return; // EXIT if successful

                } catch (err) {
                    console.warn('[MintBadge] sendCalls failed or rejected. Falling back to EOA method.', err);
                    setIsCallsPending(false);
                    // Proceed to Path B
                }
            }

            // --- PATH B: EOA (Manual Append) ---
            console.log('[MintBadge] 🛠️ Fallback to EOA Manual Append');

            const fullData = concatHex([cleanData, SUFFIX]);

            console.log('Final data last 32:', fullData.slice(-32));

            if (fullData.slice(-32).toLowerCase() !== '80218021802180218021802180218021') {
                alert('Local Validation Error: Suffix missing!');
                return;
            }

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Implementation Error:", err);
            if (onError) onError(err);
        }
    };

    const isWorking = isCallsPending || isTxPending || isWaiting;

    return (
        <button
            onClick={handleMint}
            disabled={disabled || isWorking}
            className={className}
        >
            {typeof children === 'function'
                ? children({ isWorking, isSending: isWorking, isWaiting: isWaiting, isConfirmed: isConfirmed || !!callsId })
                : (children || (isWorking ? 'Minting...' : 'Mint Badge (8021 – Universal)'))
            }
        </button>
    );
};
