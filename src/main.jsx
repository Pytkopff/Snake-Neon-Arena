// src/main.jsx
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// --- IMPORTY WEB3 ---
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base, optimism } from 'wagmi/chains';
import { baseAccount } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// --- IMPORTY THIRDWEB ---
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Base } from "@thirdweb-dev/chains"; 

// --- IMPORT MINIKIT (KLUCZOWE!) ---
import { MiniKitProvider } from '@farcaster/minikit';

// --- VCONSOLE (DEBUGGING) ---
// Importujemy statycznie i odpalamy ZAWSZE (usuń to przed ostatecznym release!)
import VConsole from 'vconsole';

// Inicjalizacja vConsole bezwarunkowa - żebyś widział logi na telefonie w Base App
const vConsole = new VConsole();
console.log("vConsole zainicjowany - wersja PROD/DEV");

const APP_NAME = 'Snake Neo Arena';
const APP_ORIGIN = globalThis?.location?.origin || 'https://snake-neon-arena.vercel.app';
const APP_LOGO_URL = `${APP_ORIGIN}/logo.png`;
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const config = createConfig({
  chains: [base, optimism],
  transports: {
    [base.id]: http(),
    [optimism.id]: http(),
  },
  ssr: false,
  connectors: [
    // Base App / Farcaster Mini App auto-connectors
    farcasterMiniApp(),
    baseAccount({
      appName: APP_NAME,
      appLogoUrl: APP_LOGO_URL,
    }),
    // Standard web wallets
    injected({ shimDisconnect: true }),
    metaMask(),
    coinbaseWallet({ appName: APP_NAME, appLogoUrl: APP_LOGO_URL }),
    walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID }),
  ],
});

const queryClient = new QueryClient();

// Opcje SDK
const thirdwebOptions = {
  readonlySettings: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org" 
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  // 🔥 WRAPPER MINIKIT PROVIDER - BEZ TEGO NIE ZADZIAŁA!
  <MiniKitProvider>
    <ThirdwebProvider 
      activeChain={Base} 
      sdkOptions={thirdwebOptions}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme()} coolMode>
            <App />
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThirdwebProvider>
  </MiniKitProvider>
);