# 🐍 Snake Neon Arena

**A casual arcade game with neon aesthetics — play instantly in your browser.**

🎮 **[Play Now → snake-neon-arena.vercel.app](https://snake-neon-arena.vercel.app)**

Built as a Farcaster miniapp on Base. No downloads, no wallet required — just play.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏆 **3 Game Modes** | Neon Ranked (classic), Time Blitz (60s survival), Zen Flow (relaxing) |
| ⚡ **Power-ups** | Speed Boost, Score Multiplier, Magnet, Shield, Time Freeze |
| 🎨 **Skins & Missions** | Unlock snake skins by completing gameplay challenges |
| 🎁 **Daily Rewards** | 7-day streak system, up to 1000 bonus apples |
| 🌐 **Global Leaderboard** | Compete worldwide with cross-platform identity |
| 🪪 **Unified Identity** | Farcaster, wallet, and guest sessions merge into one profile |
| 📱 **Mobile Support** | Full touch controls with virtual D-pad |
| 🏅 **NFT Badges** | Optional on-chain badge minting on Base |

## 🎮 Game Modes

**Neon Ranked** — Classic snake with increasing difficulty. Hit walls or yourself = game over.

**Time Blitz** — 60-second survival. Walls wrap around, power-ups extend time.

**Zen Flow** — Relaxing 2-minute session. No death, walls wrap, chill music.

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, Framer Motion |
| Backend | Supabase (PostgreSQL + Real-time) |
| Web3 | RainbowKit, Wagmi, Viem, Thirdweb (Base chain) |
| Farcaster | Frame SDK for miniapp integration |
| Audio | Howler.js for sound effects and music |

## 🗺️ Project Status

- [x] Core Gameplay — Classic, Time Blitz, and Zen Flow modes
- [x] Mobile Support — Full touch control optimization
- [x] Farcaster Frame & Wallet Connect integration
- [x] Global Leaderboards & Daily Rewards
- [x] NFT Badge minting on Base
- [ ] Multi-chain expansion 🔜
- [ ] Seasonal Skins & Community Events 🎨

---

<details>
<summary><strong>🔧 Developer Setup</strong></summary>

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_WALLET_CONNECT_PROJECT_ID=your-walletconnect-project-id
```

**Get your credentials:**
- Supabase: https://app.supabase.com/project/_/settings/api
- WalletConnect: https://cloud.walletconnect.com/

### 3. Database Setup

Execute the SQL migration in your Supabase dashboard (SQL Editor):

```bash
# The migration file is located at:
SUPABASE_MIGRATION.sql
```

This will create:
- `player_profiles` table (TEXT-based identity system)
- `game_sessions` table (stores all game results)
- 4 leaderboard views (neon_ranked, time_blitz, zen_flow, total_apples)
- Performance indexes

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

</details>

<details>
<summary><strong>🔑 Identity System</strong></summary>

The game uses a **TEXT-based identity system** with priority:

1. **Farcaster FID** (`fc:123`) - Highest priority
2. **Wallet Address** (`0x...`) - Second priority
3. **Guest UUID** (`guest:uuid`) - Fallback for anonymous players

All game sessions are aggregated by `canonical_user_id` for unified identity:

- Play as a guest, then connect your wallet → scores merge
- Connect Farcaster later → all previous games attributed to your FID
- One identity, multiple login methods

</details>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
src/
├── components/
│   ├── GlobalLeaderboard.jsx  # Main leaderboard component
│   ├── GameBoard.jsx           # Game rendering
│   ├── DailyCheckIn.jsx        # Daily rewards system
│   └── ...
├── hooks/
│   └── useSnakeGame.js         # Core game logic
├── utils/
│   ├── storage.js              # Database sync & local storage
│   ├── supabaseClient.js       # Supabase configuration
│   ├── playerSync.js           # Player profile synchronization
│   └── constants.js            # Game configuration
└── App.jsx                     # Main application component
```

</details>

<details>
<summary><strong>🚀 Build & Deployment</strong></summary>

```bash
npm run build
```

Output will be in the `dist/` directory.

**Deployment notes:**
- **Vercel**: `vercel.json` is configured for SPA routing and Farcaster Frame manifest
- **Environment Variables**: Add all `VITE_*` variables to your hosting platform
- **Farcaster Manifest**: Update `public/.well-known/farcaster.json` with your production URL

**Dev tips:**
- Linting: `npm run lint`
- Preview build: `npm run preview`
- Mobile testing: dev server runs on `0.0.0.0:5173`

</details>

---

## License

MIT

## Credits

Built by [@Pytkopff](https://github.com/Pytkopff) for the Farcaster ecosystem on Base.
