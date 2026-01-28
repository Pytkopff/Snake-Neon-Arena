import { motion } from 'framer-motion';

const Tutorial = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
      onTouchEnd={onClose} // ← DODANE dla mobile
      style={{
        touchAction: 'auto', // ← DODANE
        WebkitOverflowScrolling: 'touch', // ← DODANE dla iOS
      }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="glass rounded-2xl p-6 max-w-2xl w-full my-8"
        onClick={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()} // ← DODANE
        style={{
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 className="text-2xl md:text-3xl font-bold neon-text mb-4 text-center">
          🐍 How to Play
        </h2>

        <div className="space-y-4">
          {/* Controls */}
          <div>
            <h3 className="text-lg md:text-xl font-bold text-neon-purple mb-2">Controls</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="glass rounded-lg p-3">
                <div className="text-base font-semibold mb-1">🖱️ Desktop</div>
                <div className="text-sm text-gray-300">
                  Use <kbd className="px-2 py-1 bg-dark-card rounded text-xs">Arrow Keys</kbd> or{' '}
                  <kbd className="px-2 py-1 bg-dark-card rounded text-xs">WASD</kbd>
                </div>
              </div>
              <div className="glass rounded-lg p-3">
                <div className="text-base font-semibold mb-1">📱 Mobile</div>
                <div className="text-sm text-gray-300">
                  Use on-screen D-Pad
                </div>
              </div>
            </div>
          </div>

          {/* Power-ups */}
          <div>
            <h3 className="text-lg md:text-xl font-bold text-neon-purple mb-2">Power-ups</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="glass rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">⚡</div>
                <div className="font-semibold text-sm">Speed Boost</div>
                <div className="text-xs text-gray-400">Move faster for 5s</div>
              </div>
              <div className="glass rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">🛡️</div>
                <div className="font-semibold text-sm">Shield</div>
                <div className="text-xs text-gray-400">Extra life protection</div>
              </div>
              <div className="glass rounded-lg p-2 text-center">
                <div className="text-2xl mb-1">⭐</div>
                <div className="font-semibold text-sm">2x Score</div>
                <div className="text-xs text-gray-400">Double points for 8s</div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div>
            <h3 className="text-lg md:text-xl font-bold text-neon-purple mb-2">Tips</h3>
            <ul className="space-y-1 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-neon-green">●</span>
                <span>Collect apples in succession to build combo multipliers (3+ = 🔥)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green">●</span>
                <span>Speed increases as you score more - stay focused!</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green">●</span>
                <span>Shield power-ups protect you from collisions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-neon-green">●</span>
                <span>Share your high score with friends and compete!</span>
              </li>
            </ul>
          </div>
        </div>

        <button
          onClick={onClose}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="btn-primary w-full mt-4"
          style={{
            touchAction: 'manipulation',
            minHeight: '48px',
          }}
        >
          Got it! Let's Play 🚀
        </button>
      </motion.div>
    </motion.div>
  );
};

export default Tutorial;