import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface Petal {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  swayWidth: number;
  rotateDirection: number;
}

export function CherryBlossomRain() {
  const [petals, setPetals] = useState<Petal[]>([]);

  useEffect(() => {
    // Generate a set of 24 floating cherry blossom petals
    const newPetals: Petal[] = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage of container width
      y: -10 - Math.random() * 20, // start above screen
      size: 6 + Math.random() * 12, // size in pixels
      delay: Math.random() * 8, // staggered start
      duration: 6 + Math.random() * 10, // speed of descent
      swayWidth: 15 + Math.random() * 30, // side-to-side sway range
      rotateDirection: Math.random() > 0.5 ? 1 : -1,
    }));
    setPetals(newPetals);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {petals.map((petal) => (
        <motion.div
          key={petal.id}
          initial={{ 
            opacity: 0, 
            x: `${petal.x}%`, 
            y: `${petal.y}vh`, 
            rotate: 0 
          }}
          animate={{
            opacity: [0, 0.9, 0.9, 0],
            y: ['0vh', '110vh'],
            x: [
              `${petal.x}%`, 
              `${petal.x + petal.swayWidth / 2}%`, 
              `${petal.x - petal.swayWidth / 2}%`, 
              `${petal.x + petal.swayWidth / 4}%`
            ],
            rotate: [0, 180 * petal.rotateDirection, 360 * petal.rotateDirection, 540 * petal.rotateDirection]
          }}
          transition={{
            duration: petal.duration,
            delay: petal.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute"
          style={{
            width: petal.size,
            height: petal.size,
          }}
        >
          {/* A beautiful organic cherry blossom petal shape */}
          <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full drop-shadow-[0_1px_3px_rgba(255,182,193,0.4)]"
          >
            <path
              d="M50 0C65 20 100 35 100 65C100 85 80 100 50 100C20 100 0 85 0 65C0 35 35 20 50 0Z"
              fill="url(#sakuraGradient)"
            />
            <path
              d="M50 10C58 25 80 37 80 60C80 73 67 85 50 85C33 85 20 73 20 60C20 37 42 25 50 10Z"
              fill="#FFD1DC"
              opacity="0.6"
            />
            <defs>
              <linearGradient id="sakuraGradient" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF0F5" />
                <stop offset="50%" stopColor="#FFB7C5" />
                <stop offset="100%" stopColor="#FF91A4" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}
    </div>
  );
}
