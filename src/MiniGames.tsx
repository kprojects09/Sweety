import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Music, Brain, X, CheckCircle2, AlertCircle, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, User, Bot } from 'lucide-react';

export type GameType = 'ludo' | 'none';

interface MiniGamesProps {
  gameType: GameType;
  onClose: () => void;
  onGameEvent: (event: string, score: number) => void;
  theme: {
    primary: string;
    secondary: string;
    accent?: string;
    glow?: string;
  };
}

const BOARD_SIZE = 15; // Small linear board for quick play

const DICE_ICONS = [Dice1, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

export function MiniGames({ gameType, onClose, onGameEvent, theme }: MiniGamesProps) {
  // --- Ludo State ---
  const [playerPos, setPlayerPos] = useState(0);
  const [sweetyPos, setSweetyPos] = useState(0);
  const [turn, setTurn] = useState<'player' | 'sweety'>('player');
  const [diceRoll, setDiceRoll] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState<'player' | 'sweety' | null>(null);

  const rollDice = () => {
    if (isRolling || winner || turn !== 'player') return;
    performRoll('player');
  };

  const performRoll = (who: 'player' | 'sweety') => {
    setIsRolling(true);
    let rolls = 0;
    const interval = setInterval(() => {
      setDiceRoll(Math.floor(Math.random() * 6) + 1);
      rolls++;
      if (rolls > 10) {
        clearInterval(interval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceRoll(finalValue);
        setIsRolling(false);
        movePiece(who, finalValue);
      }
    }, 80);
  };

  const movePiece = (who: 'player' | 'sweety', value: number) => {
    if (who === 'player') {
      const next = Math.min(BOARD_SIZE, playerPos + value);
      setPlayerPos(next);
      onGameEvent('player_moved', next);
      if (next === BOARD_SIZE) {
        setWinner('player');
        onGameEvent('player_won', 100);
      } else {
        setTurn('sweety');
      }
    } else {
      const next = Math.min(BOARD_SIZE, sweetyPos + value);
      setSweetyPos(next);
      onGameEvent('sweety_moved', next);
      if (next === BOARD_SIZE) {
        setWinner('sweety');
        onGameEvent('sweety_won', 0);
      } else {
        setTurn('player');
      }
    }
  };

  // Sweety's AI Turn
  useEffect(() => {
    if (turn === 'sweety' && !winner && gameType === 'ludo') {
      const timer = setTimeout(() => {
        performRoll('sweety');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [turn, winner, gameType]);

  if (gameType === 'none') return null;

  const DiceIcon = DICE_ICONS[diceRoll];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 font-mono"
    >
      <div 
        className="relative w-full max-w-xl bg-black border p-6 shadow-[0_0_30px_rgba(0,255,65,0.2)] flex flex-col rounded-none"
        style={{ borderColor: theme.primary }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b rounded-none" style={{ borderColor: `${theme.primary}33` }}>
          <div className="flex items-center gap-3">
            <Trophy className="animate-pulse" style={{ color: theme.primary }} />
            <h2 className="text-sm font-bold tracking-[3px] uppercase matrix-text-glow" style={{ color: theme.primary }}>SWEETY'S NEO LUDO</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 border bg-black transition-all cursor-pointer rounded-none hover:bg-red-500/10"
            style={{ borderColor: `${theme.primary}44`, color: theme.primary }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Board View */}
        <div className="py-8 px-2 flex-1 flex flex-col items-center justify-center gap-12 rounded-none">
          
          {/* Track */}
          <div 
            className="w-full relative flex items-center justify-between h-20 bg-black border p-4 rounded-none overflow-hidden"
            style={{ borderColor: `${theme.primary}55` }}
          >
            <div className="absolute inset-0 flex divide-x rounded-none" style={{ borderColor: `${theme.primary}15` }}>
              {[...Array(BOARD_SIZE + 1)].map((_, i) => (
                <div key={i} className="flex-1 h-full rounded-none" style={{ borderColor: `${theme.primary}15` }} />
              ))}
            </div>
            
            {/* Player Piece (Square Retro Block) */}
            <motion.div 
              animate={{ x: `${(playerPos / BOARD_SIZE) * 88}%` }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="absolute z-20 top-2 rounded-none"
            >
              <div 
                className="w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs"
                style={{ 
                  backgroundColor: 'black', 
                  borderColor: theme.primary, 
                  color: theme.primary,
                  boxShadow: `0 0 10px ${theme.primary}` 
                }}
              >
                U
              </div>
              <div className="text-[8px] uppercase font-bold text-center mt-0.5" style={{ color: theme.primary }}>YOU</div>
            </motion.div>

            {/* Sweety Piece (Square Retro Block) */}
            <motion.div 
              animate={{ x: `${(sweetyPos / BOARD_SIZE) * 88}%` }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="absolute z-20 bottom-2 rounded-none"
            >
              <div 
                className="w-8 h-8 rounded-none flex items-center justify-center border font-bold text-xs"
                style={{ 
                  backgroundColor: 'black', 
                  borderColor: theme.secondary, 
                  color: theme.secondary,
                  boxShadow: `0 0 10px ${theme.secondary}` 
                }}
              >
                S
              </div>
              <div className="text-[8px] uppercase font-bold text-center mt-0.5" style={{ color: theme.secondary }}>SWEETY</div>
            </motion.div>

            {/* Finish Line Indicator */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-black flex items-center justify-center border-l rounded-none" style={{ borderColor: `${theme.primary}44` }}>
               <Trophy size={14} style={{ color: theme.primary }} className="opacity-50" />
            </div>
          </div>

          {/* Dice & Status */}
          <div className="flex flex-col items-center gap-6 rounded-none">
            <AnimatePresence mode="wait">
              {winner ? (
                <motion.div 
                  key="winner"
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 rounded-none"
                >
                  <Trophy size={40} style={{ color: theme.primary }} className="animate-bounce" />
                  <h3 className="text-xl font-bold uppercase matrix-text-glow" style={{ color: theme.primary }}>
                    {winner === 'player' ? "SYSTEM DEFEATED (YOU WON!)" : "SWEETY DEFEATED YOU"}
                  </h3>
                  <button 
                    onClick={() => { setPlayerPos(0); setSweetyPos(0); setWinner(null); setTurn('player'); }}
                    className="mt-4 px-6 py-2 bg-black border hover:bg-white/5 text-xs font-bold uppercase tracking-widest transition-all rounded-none"
                    style={{ borderColor: theme.primary, color: theme.primary }}
                  >
                    RESTART_GAME
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="gameplay-active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-12 rounded-none"
                >
                   <div className={`flex flex-col items-center gap-2 transition-opacity ${turn === 'player' ? 'opacity-100' : 'opacity-30'}`}>
                      <User style={{ color: theme.primary }} />
                      <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: theme.primary }}>USER</span>
                   </div>

                   <motion.button
                     whileHover={{ scale: turn === 'player' ? 1.05 : 1 }}
                     whileTap={{ scale: turn === 'player' ? 0.95 : 1 }}
                     onClick={rollDice}
                     disabled={turn !== 'player' || isRolling}
                     className={`w-24 h-24 rounded-none flex flex-col items-center justify-center gap-2 border transition-all cursor-pointer relative
                       ${turn === 'player' ? 'bg-black' : 'opacity-40 bg-black/20'}
                       ${isRolling ? 'animate-pulse' : ''}
                     `}
                     style={{ 
                       borderColor: turn === 'player' ? theme.primary : `${theme.primary}33`,
                       color: theme.primary,
                       boxShadow: turn === 'player' ? `0 0 15px ${theme.glow}` : 'none'
                     }}
                   >
                     <motion.div
                       animate={isRolling ? { rotate: [0, 90, 180, 270, 360] } : {}}
                       transition={{ duration: 0.2, repeat: Infinity, ease: 'linear' }}
                     >
                       <DiceIcon size={36} style={{ color: turn === 'player' ? theme.primary : `${theme.primary}80` }} />
                     </motion.div>
                     <span className="text-[8px] uppercase font-bold tracking-[1px]">
                       {isRolling ? 'ROLLING...' : turn === 'player' ? 'TAP TO ROLL' : "SWEETY_CPU..."}
                     </span>
                   </motion.button>

                   <div className={`flex flex-col items-center gap-2 transition-opacity ${turn === 'sweety' ? 'opacity-100' : 'opacity-30'}`}>
                      <Bot style={{ color: theme.secondary }} />
                      <span className="text-[9px] uppercase font-bold tracking-widest" style={{ color: theme.secondary }}>SWEETY</span>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-center rounded-none" style={{ borderColor: `${theme.primary}15` }}>
          <p className="text-[9px] tracking-wider uppercase opacity-60" style={{ color: theme.primary }}>
            MODULE // LUDO: A race against the core companion.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
