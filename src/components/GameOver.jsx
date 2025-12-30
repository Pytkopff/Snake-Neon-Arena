import { motion } from 'framer-motion';

const GameOver = ({ score, bestScore, isNewRecord, onRestart, onShare, onBackToMenu, endReason, applesCollected }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="glass rounded-2xl p-8 max-w-md w-full text-center"
      >
        {/* Title */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
        >
          <h2 className="text-4xl font-bold mb-2">
            {isNewRecord ? '🏆 NEW RECORD!' : endReason === 'timeup' ? "⏱️ Time's up" : '💀 Game Over'}
          </h2>
          {isNewRecord && (
            <p className="text-neon-purple text-lg mb-4">
              You crushed your previous best!
            </p>
          )}
          {endReason === 'timeup' && (
            <p className="text-gray-300 text-sm mb-4">Time's up — final score below</p>
          )}
        </motion.div>

        {/* Score Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="my-8"
        >
          <div className="text-6xl font-bold neon-text mb-2">
            {score.toLocaleString()}
          </div>
          <div className="text-gray-400">
            Best: <span className="text-neon-purple font-bold">{bestScore.toLocaleString()}</span>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-lg p-4 mb-6"
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-neon-blue">
                  {applesCollected}
                </div>
                <div className="text-xs text-gray-400">Apples</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-neon-purple">
                {Math.floor(score / 100)}
              </div>
              <div className="text-xs text-gray-400">Combos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-neon-pink">
                {score > bestScore ? '+' : ''}{score - bestScore}
              </div>
              <div className="text-xs text-gray-400">vs Best</div>
            </div>
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={onRestart}
              className="btn-primary w-full"
            >
              🔁 Play Again
            </button>
            <button
              onClick={onBackToMenu}
              className="btn-secondary w-full"
            >
              ↩️ Back to Menu
            </button>
          </div>
          <button
            onClick={onShare}
            className="btn-secondary w-full mt-3"
          >
            🔗 Share on Farcaster
          </button>
        </motion.div>

        {/* Tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-gray-500 mt-4"
        >
          💡 Tip: Build combos for massive score multipliers!
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

export default GameOver;