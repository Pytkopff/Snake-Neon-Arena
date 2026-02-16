import React, { useCallback, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { encodeFunctionData, parseEther } from 'viem';

// ERC-8021 Attribution Suffix
const ATTRIBUTION_SUFFIX = '626f696b356e7771080080218021802180218021802180218021';
const BASE_CHAIN_ID = 8453;
const CONTRACT_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

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

    useEffect(() => {
        if (isConfirmed && hash) {
            if (onSuccess) onSuccess(hash);
        }
    }, [isConfirmed, hash, onSuccess]);

    useEffect(() => {
        if (sendError && onError) onError(sendError);
    }, [sendError, onError]);

    const handleMint = useCallback(async (e) => {
        e?.stopPropagation(); // Prevent bubbling if needed

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
                }
            }

            const price = parseEther(priceETH.toString());

            const allowlistProof = {
                proof: [],
                quantityLimitPerWallet: MAX_UINT256,
                pricePerToken: price,
                currency: NATIVE_TOKEN
            };

            const encodedData = encodeFunctionData({
                abi: CLAIM_ABI,
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

            const cleanSuffix = ATTRIBUTION_SUFFIX.startsWith('0x') ? ATTRIBUTION_SUFFIX.slice(2) : ATTRIBUTION_SUFFIX;
            const fullCalldata = `${encodedData}${cleanSuffix}`;

            console.log(`[MintBadge] Sending Transaction...`);
            console.log(`[MintBadge] Data Suffix: ${cleanSuffix}`);

            sendTransaction({
                to: CONTRACT_ADDRESS,
                data: fullCalldata,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Implementation Error:", err);
            if (onError) onError(err);
        }
    }, [address, chainId, tokenId, priceETH, switchChainAsync, sendTransaction, onError]);

    const isWorking = isSending || isWaiting;

    return (
        <button
            onClick={handleMint}
            disabled={disabled || isWorking}
            className={className}
        >
            {/* If children is a function, call it with state, else render children or default text */}
            {typeof children === 'function'
                ? children({ isWorking, isSending, isWaiting, isConfirmed })
                : (children || (isWorking ? 'Minting...' : 'Mint Badge'))
            }
        </button>
    );
};

export default MintBadgeButton;
