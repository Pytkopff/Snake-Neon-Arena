import React, { useCallback } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { encodeFunctionData, parseEther } from 'viem';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
// Placeholder address - replace if needed, or keep provided default
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// ERC-8021 Suffix (Excatly 54 hex chars)
// '0x' + '626f696b356e7771' (bc_boik5nwq in hex) + '0800' (version?) + '8021...8021' (marker)
// This MUST be at the very end of input data.
const SUFFIX = '0x626f696b356e7771080080218021802180218021802180218021';

// Minimal ABI for mint/claim
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
 * MintBadgeButton
 * 
 * ⚠️ WAŻNE / IMPORTANT ⚠️
 * Ten komponent używa MANUALNEGO doklejania suffixu ERC-8021 do calldata.
 * Działa to poprawnie TYLKO w portfelach EOA (MetaMask, Rabby, Rainbow, Trust).
 * 
 * W Coinbase Smart Wallet (AA) to NIE zadziała (checker będzie czerwony),
 * ponieważ Smart Wallet owija transakcję w `executeBatch`, przez co nasz suffix 
 * ląduje w środku danych, a na końcu są zera (padding).
 * 
 * Jeśli używasz Base App (Smart Wallet), atrybucja wymaga EIP-5792 capabilities, 
 * których tu celowo NIE używamy, aby wymusić "zielony" wynik na klasycznych portfelach.
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
    const { address, connector } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();

    // Use LOW-LEVEL sending to prevent libraries from re-formatting our data
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

    // Callbacks
    React.useEffect(() => {
        if (isConfirmed && hash) {
            console.log("✅ Mint Success! Hash:", hash);
            // Open useful links
            window.open(`https://basescan.org/tx/${hash}`, '_blank');
            window.open(`https://builder-code-checker.vercel.app/`, '_blank');

            if (onSuccess) onSuccess(hash);
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
            // 1. Chain Check
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

            // 2. Prepare Standard Calldata (without suffix)
            const cleanData = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [
                    address,
                    BigInt(tokenId),
                    1n, // quantity
                    NATIVE_TOKEN,
                    price,
                    allowlistProof,
                    "0x" // Empty bytes, we append explicit suffix outside
                ]
            });

            console.log(`[MintBadge] Clean Data (Last 10): ...${cleanData.slice(-10)}`);

            // 3. Manual Append Suffix
            // Suffix format: 0x... -> we remove '0x' if strict concat is needed, 
            // but cleanData from viem starts with 0x.
            // logic: "0x123..." + "456..." (without 0x prefix)
            const suffixPayload = SUFFIX.startsWith('0x') ? SUFFIX.slice(2) : SUFFIX;
            const fullCalldata = `${cleanData}${suffixPayload}`;

            console.group("[MintBadge] ATTRIBUTION DEBUG");
            console.log("Suffix to append:", suffixPayload);
            console.log("Full Data Length:", fullCalldata.length);
            console.log("Last 32 chars (Should be 8021...):", fullCalldata.slice(-32));
            console.groupEnd();

            // 4. Send Low-Level Transaction
            sendTransaction({
                to: BADGE_ADDRESS,
                data: fullCalldata,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            if (onError) onError(err);
        }
    }, [address, chainId, tokenId, priceETH, switchChainAsync, sendTransaction, onError]);

    const isWorking = isSending || isWaiting;

    // Warning text if connector looks like Coinbase Smart Wallet (optional logic)
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
                    ⚠️ Uwaga: Jesteś w Smart Wallet. Atrybucja 8021 (Manual Append)
                    zwykle tu nie działa (checker = red). Użyj MetaMask/Rabby dla zielonego wyniku.
                </p>
            )}
        </div>
    );
};

export default MintBadgeButton;
