import React, { useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';

// Constants
const BASE_CHAIN_ID = 8453;
const CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// Minimal ABI
const CLAIM_ABI = [
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
 * MintBadgeButton (Refactored for Wallet-Side Attribution)
 * 
 * Why this works for Base App / Coinbase Smart Wallet (Feb 2026):
 * 1. We configured `coinbaseWallet({ attribution: { auto: true } })` in main.jsx.
 * 2. This treats the tx as a "Smart Wallet" intent.
 * 3. The Wallet itself intercepts the `eth_sendTransaction` or `wallet_sendCalls`.
 * 4. It AUTOMATICALLY appends the builder ID suffix (ERC-8021) to the calldata 
 *    inside the UserOperation (executeBatch).
 * 
 * Result: 
 * - We use standard `useWriteContract`.
 * - NO manual `encodeFunctionData`.
 * - NO manual suffix appending (which breaks batching).
 * - Logs show "Wallet-Side Auto-Attribution Active".
 */
const MintBadgeButton = ({
    tokenId,
    onSuccess,
    onError,
    priceETH = "0",
    className = '',
    disabled,
    children
}) => {
    const { address } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    // Standard Wagmi Hook
    const {
        data: hash,
        writeContract,
        isPending: isSending,
        error: sendError
    } = useWriteContract();

    const {
        isLoading: isWaiting,
        isSuccess: isConfirmed
    } = useWaitForTransactionReceipt({ hash });

    useEffect(() => {
        if (isConfirmed && hash) {
            if (onSuccess) onSuccess(hash);
        }
    }, [isConfirmed, hash, onSuccess]);

    useEffect(() => {
        if (sendError && onError) onError(sendError);
    }, [sendError, onError]);

    const handleMint = async (e) => {
        e?.stopPropagation();

        if (!address) {
            console.warn("Wallet not connected");
            return;
        }

        try {
            if (chainId !== BASE_CHAIN_ID) {
                try {
                    await switchChainAsync({ chainId: BASE_CHAIN_ID });
                } catch (switchError) {
                    console.error("Failed to switch chain:", switchError);
                    // Try to continue anyway
                }
            }

            const price = parseEther(priceETH.toString());

            const allowlistProof = {
                proof: [],
                quantityLimitPerWallet: MAX_UINT256,
                pricePerToken: price,
                currency: NATIVE_TOKEN
            };

            console.log(`[MintBadge] Sending Transaction via useWriteContract...`);
            console.log(`[MintBadge] EXPECTATION: Coinbase Smart Wallet will AUTO-APPEND 8021 suffix.`);

            writeContract({
                address: CONTRACT_ADDRESS,
                abi: CLAIM_ABI,
                functionName: 'claim',
                args: [
                    address,
                    BigInt(tokenId),
                    1n, // quantity
                    NATIVE_TOKEN,
                    price,
                    allowlistProof,
                    "0x" // data is empty, wallet appends suffix here!
                ],
                value: price,
                chain: null
            });

        } catch (err) {
            console.error("[MintBadge] Implementation Error:", err);
            if (onError) onError(err);
        }
    };

    const isWorking = isSending || isWaiting;

    return (
        <button
            onClick={handleMint}
            disabled={disabled || isWorking}
            className={className}
        >
            {/* Render Props Support */}
            {typeof children === 'function'
                ? children({ isWorking, isSending, isWaiting, isConfirmed })
                : (children || (isWorking ? 'Minting...' : 'Mint Badge'))
            }
        </button>
    );
};

export default MintBadgeButton;
