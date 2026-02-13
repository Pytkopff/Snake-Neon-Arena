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
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask, walletConnect } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// --- IMPORTY THIRDWEB ---
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Base } from "@thirdweb-dev/chains";

// 🔥 NAJWAŻNIEJSZE: MiniKitProvider z oficjalnej paczki Farcaster/Base
import { MiniKitProvider } from '@farcaster/minikit';

// 🔥 VCONSOLE - zostaje do debugowania
import VConsole from 'vconsole';
const vConsole = new VConsole();

const APP_NAME = 'Snake Neon Arena';
const APP_ORIGIN = globalThis?.location?.origin || 'https://snake-neon-arena.vercel.app';
const APP_LOGO_URL = `${APP_ORIGIN}/logo.png`;
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID';

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: false,
  connectors: [
    coinbaseWallet({ appName: APP_NAME, appLogoUrl: APP_LOGO_URL }),
    injected({ shimDisconnect: true }),
    metaMask(),
    walletConnect({ projectId: WALLET_CONNECT_PROJECT_ID }),
  ],
});

const queryClient = new QueryClient();

const thirdwebOptions = {
  readonlySettings: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org"
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
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