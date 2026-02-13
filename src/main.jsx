import { Buffer } from 'buffer';
window.Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// --- ONLY THIRDWEB – Base App sam daje wallet przez window.ethereum ---
import { ThirdwebProvider } from "@thirdweb-dev/react";
import { Base } from "@thirdweb-dev/chains";

// 🔥 VCONSOLE - zostaje do debugowania
import VConsole from 'vconsole';
const vConsole = new VConsole();

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
    <App />
  </ThirdwebProvider>
);