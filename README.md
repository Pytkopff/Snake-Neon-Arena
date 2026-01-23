# Snake Neon Arena 🐍

A modern Snake game with neon aesthetics, built for Farcaster Frames using React + Vite. Features multiple game modes, power-ups, skins, missions, and a global leaderboard system.

## Features

- **3 Game Modes**: Classic, Time Blitz (60s), and Zen Flow
- **Power-ups**: Speed boost, Score multiplier, Magnet, Shield, and Time Freeze
- **Skins & Missions**: Unlock new snake skins by completing challenges
- **Daily Rewards**: Log in daily for bonus apples (up to 1000 on day 7!)
- **Global Leaderboard**: Compete with players worldwide
- **Cross-Platform Identity**: Your progress follows you across Farcaster and wallet login

## Setup

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

## Leaderboard System

The game uses a **TEXT-based identity system** with priority:

1. **Farcaster FID** (`fc:123`) - Highest priority
2. **Wallet Address** (`0x...`) - Second priority
3. **Guest UUID** (`guest:uuid`) - Fallback for anonymous players

All game sessions are stored in the `game_sessions` table and aggregated by `canonical_user_id` for unified player identity across platforms. This means:

- Play as a guest, then connect your wallet → your scores merge
- Connect Farcaster later → all your previous games are attributed to your FID
- One identity, multiple login methods

## Game Modes

### 🏆 Neon Ranked (Classic)
Traditional snake gameplay with increasing difficulty. Hit walls or yourself = game over.

### ⚡ Time Blitz
Survive for 60 seconds! Walls wrap around, collect power-ups to extend time.

### 🧘 Zen Flow
Relaxing 2-minute mode with chill music. No death, walls wrap, pure vibes.

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Web3**: RainbowKit, Wagmi, Ethers.js (Base chain)
- **Farcaster**: Frame SDK for miniapp integration
- **Audio**: Howler.js for sound effects and music

## Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory, ready to deploy to Vercel or any static hosting.

## Deployment Notes

- **Vercel**: The `vercel.json` is configured for SPA routing and Farcaster Frame manifest
- **Environment Variables**: Add all `VITE_*` variables to your hosting platform's environment settings
- **Farcaster Manifest**: Update `public/.well-known/farcaster.json` with your production URL

## Project Structure

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

## Development Tips

- **Linting**: `npm run lint` to check for code issues
- **Preview Build**: `npm run preview` to test production build locally
- **Mobile Testing**: The dev server runs on `0.0.0.0:5173` for network access

## 🗺️ Project Status

The core game mechanics are fully implemented and optimized for Base.

- [x] **Core Gameplay:** Classic, Time Blitz, and Zen Flow modes
- [x] **Mobile Support:** Full touch control optimization
- [x] **Integration:** Farcaster Frame & Wallet Connect
- [x] **Social:** Global Leaderboards & Daily Rewards
- [ ] **Upcoming:** Seasonal Skins & Community Events 🎨

## License

MIT

## Credits

Built with ❤️ for the Farcaster ecosystem on Base.
