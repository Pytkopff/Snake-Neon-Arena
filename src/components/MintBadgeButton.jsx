import React, { useCallback } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { encodeFunctionData, parseEther, concatHex } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 Suffix
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

    const {
        data: hash,
        sendTransaction,
        isPending: isSending,
        error: sendError
    } = useSendTransaction();

    const {
        isLoading: isWaiting,
        isSuccess: isConfirmed
    } = useWaitForTransactionReceipt({ hash });

    React.useEffect(() => {
        if (isConfirmed && hash) {
            console.log("✅ Mint Success! Hash:", hash);
            if (onSuccess) onSuccess(hash);

            // Delay opening windows slightly
            setTimeout(() => {
                window.open(`https://basescan.org/tx/${hash}`, '_blank');
                window.open(`https://builder-code-checker.vercel.app/?hash=${hash}`, '_blank');
            }, 2000);
        }
    }, [isConfirmed, hash, onSuccess]);

    React.useEffect(() => {
        if (sendError && onError) onError(sendError);
    }, [sendError, onError]);

    const handleMint = useCallback(async (e) => {
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
                    return;
                }
            }

            const price = parseEther(priceETH.toString());

            const allowlistProof = {
                proof: [],
                quantityLimitPerWallet: MAX_UINT256,
                pricePerToken: price,
                currency: NATIVE_TOKEN
            };

            // 1. Encode CLEAN calldata (args end with "0x" empty bytes)
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

            console.log('Clean data (hex):', cleanData);
            console.log('Clean data length (hex chars):', cleanData.length);

            // 2. Append using concatHex (User's preferred method)
            const fullData = concatHex([cleanData, SUFFIX]);

            console.log('Full data (z suffixem):', fullData);
            console.log('Ostatnie 32 znaki:', fullData.slice(-32));

            // VALIDATION
            if (fullData.slice(-32).toLowerCase() !== '80218021802180218021802180218021') {
                alert('FATAL: Suffix nie jest na końcu! Coś poszło nie tak z append.');
                return;
            }

            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullData,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            if (onError) onError(err);
        }
    }, [address, chainId, tokenId, priceETH, switchChainAsync, sendTransaction, onError]);

    const isWorking = isSending || isWaiting;
    const isSmartWallet = connector?.name?.includes("Coinbase") || connector?.id === 'coinbaseWalletSDK';

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleMint}
                disabled={disabled || isWorking}
                className={className}
            >
                {typeof children === 'function'
                    ? children({ isWorking, isSending, isWaiting, isConfirmed })
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (Manual EOA)'))
                }
            </button>

            {isSmartWallet && (
                <p className="text-[10px] text-orange-400 text-center px-1">
                    ⚠️ Uwaga: Smart Wallet wykryty. To może nie działać z checkerem.
                    Dla 100% pewności użyj MetaMask/Rabby.
                </p>
            )}
        </div>
    );
};
