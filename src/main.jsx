import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Minimalne importy – TYLKO to co działa w Base App
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Base } from "@thirdweb-dev/chains";

// VConsole zostaje
import VConsole from 'vconsole';
const vConsole = new VConsole();

const APP_NAME = 'Snake Neon Arena';
const APP_ORIGIN = globalThis?.location?.origin || 'https://snake-neon-arena.vercel.app';
const APP_LOGO_URL = `${APP_ORIGIN}/logo.png`;

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  ssr: false,
  connectors: [
    coinbaseWallet({ appName: APP_NAME, appLogoUrl: APP_LOGO_URL }),
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
  <ThirdwebProvider 
    activeChain={Base} 
    sdkOptions={thirdwebOptions}
  >
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </ThirdwebProvider>
);