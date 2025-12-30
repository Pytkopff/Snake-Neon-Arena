// src/main.jsx
import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// --- IMPORTY WEB3 ---
import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { base } from 'wagmi/chains'; 
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

// --- IMPORTY THIRDWEB ---
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Base } from "@thirdweb-dev/chains"; 

const config = getDefaultConfig({
  appName: 'Snake Neo Arena',
  projectId: 'YOUR_PROJECT_ID', 
  chains: [base],
  ssr: false,
});

const queryClient = new QueryClient();

// Opcje SDK (zostawiamy fix z RPC, bo nie zaszkodzi, a pomaga stabilności)
const thirdwebOptions = {
  readonlySettings: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org" 
  }
};

ReactDOM.createRoot(document.getElementById('root')).render(
  // ❌ USUNIĘTO: <React.StrictMode>
  // Zostawiamy tylko "mięso":
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
  // ❌ USUNIĘTO: </React.StrictMode>
);