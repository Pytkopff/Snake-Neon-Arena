import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { encodeFunctionData, parseEther, toHex } from 'viem';
import { Attribution } from 'ox/erc8021';

// --- CONFIGURATION ---
const BASE_CHAIN_ID = 8453;
const BADGE_ADDRESS = "0x720579D73BD6f9b16A4749D9D401f31ed9a418D7";
const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const MAX_UINT256 = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

// SUFFIX GENERATION
const S_CODES = ['boik5nwq'];
const DATA_SUFFIX = Attribution.toDataSuffix({ codes: S_CODES });

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

    const [successHash, setSuccessHash] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [debugInfo, setDebugInfo] = useState('');
    const [isCapabilitySending, setIsCapabilitySending] = useState(false);
    const [capabilityId, setCapabilityId] = useState(null);

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
        if ((isConfirmed && txHash) || capabilityId) {
            const hashToShow = txHash || capabilityId;
            console.log("✅ Mint Success!", hashToShow);
            setSuccessHash(hashToShow);
            if (onSuccess) onSuccess(hashToShow);
        }
    }, [isConfirmed, txHash, capabilityId, onSuccess]);

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
        setDebugInfo('');

        try {
            if (chainId !== BASE_CHAIN_ID) {
                try { await switchChainAsync({ chainId: BASE_CHAIN_ID }); }
                catch (e) { console.error(e); }
            }

            const price = parseEther(priceETH.toString());
            const allowlistProof = { proof: [], quantityLimitPerWallet: MAX_UINT256, pricePerToken: price, currency: NATIVE_TOKEN };

            const data = encodeFunctionData({
                abi: BADGE_ABI,
                functionName: 'claim',
                args: [address, BigInt(tokenId), 1n, NATIVE_TOKEN, price, allowlistProof, "0x"]
            });

            // --- CHECK CAPABILITIES ---
            let supportsSendCalls = false;
            try {
                if (walletClient && walletClient.request) {
                    supportsSendCalls = true;
                }
            } catch (e) { }

            if (supportsSendCalls && walletClient) {
                console.log('[MintBadge] 🚀 Sending via wallet_sendCalls (Capabilities)...');
                setDebugInfo('Trying Smart Wallet Attribution...');
                setIsCapabilitySending(true);
                try {
                    const id = await walletClient.request({
                        method: 'wallet_sendCalls',
                        params: [{
                            version: '1.0',
                            chainId: toHex(BASE_CHAIN_ID),
                            from: address,
                            calls: [{
                                to: BADGE_ADDRESS,
                                data: data,
                                value: toHex(price)
                            }],
                            capabilities: {
                                attribution: {
                                    dataSuffix: DATA_SUFFIX
                                }
                            }
                        }]
                    });
                    console.log('[MintBadge] SendCalls ID:', id);
                    setCapabilityId(id);
                    setDebugInfo('✅ Sent via Smart Wallet API');
                    setIsCapabilitySending(false);
                    return;
                } catch (err) {
                    console.warn('[MintBadge] wallet_sendCalls failed:', err);
                    setDebugInfo(`⚠️ API Error: ${err.message}. Fallback...`);
                    setIsCapabilitySending(false);
                }
            } else {
                setDebugInfo('⚠️ Smart Wallet API not found. Using Standard.');
            }

            // FALLBACK
            console.log('[MintBadge] 📦 Using Standard sendTransaction');
            sendTransaction({
                to: BADGE_ADDRESS,
                data: data,
                value: price,
            });

        } catch (err) {
            console.error("[MintBadge] Error:", err);
            setErrorMessage(err.message || "Błąd wykonania");
            setIsCapabilitySending(false);
            if (onError) onError(err);
        }
    };

    const isWorking = isTxPending || isWaiting || isCapabilitySending;

    if (successHash) {
        const isCapId = !String(successHash).startsWith('0x') || String(successHash).length < 60;

        return (
            <div className="flex flex-col gap-2 p-2 bg-green-900/40 border border-green-500/50 rounded-lg">
                <div className="text-green-400 font-bold text-sm text-center">✅ MINT SUKCES!</div>
                <div className="text-[10px] text-gray-400 text-center break-all">{String(successHash).slice(0, 10)}...</div>
                {debugInfo && <div className="text-[9px] text-yellow-300 text-center">{debugInfo}</div>}

                <div className="flex gap-2 justify-center flex-wrap">
                    {!isCapId && (
                        <a href={`https://basescan.org/tx/${successHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-500">
                            Basescan
                        </a>
                    )}
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
                    : (children || (isWorking ? 'Minting...' : 'Mint Badge (V4 Config)'))
                }
            </button>
            {debugInfo && (
                <div className="text-yellow-400 text-[9px] text-center px-1 break-words">
                    {debugInfo}
                </div>
            )}
            {errorMessage && (
                <div className="text-red-400 text-[10px] text-center px-1 break-words">
                    {errorMessage.slice(0, 100)}
                </div>
            )}
        </div>
    );
};
