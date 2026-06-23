'use client';

import { useState, useEffect } from 'react';

interface AnimatedDieProps {
  value: number | null;
  sides?: number;
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const DIE_FACES: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// 8 frames × 80ms interval (see useEffect below). The shake runs for this long
// before the die snaps to its final value.
export const DICE_ROLL_DURATION_MS = 640;

export function AnimatedDie({ value, sides = 6, rolling = false, size = 'md' }: AnimatedDieProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (rolling) {
      setAnimating(true);
      let frames = 0;
      const maxFrames = 8;
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * sides) + 1);
        frames++;
        if (frames >= maxFrames) {
          clearInterval(interval);
          setDisplayValue(value);
          setAnimating(false);
        }
      }, 80);
      return () => clearInterval(interval);
    } else {
      setDisplayValue(value);
    }
  }, [rolling, value, sides]);

  const sizeMap = { sm: '2rem', md: '3rem', lg: '4rem' };
  const fontMap = { sm: '1.25rem', md: '2rem', lg: '2.75rem' };

  const face = sides === 6 && displayValue && displayValue <= 6 ? DIE_FACES[displayValue] : displayValue;

  return (
    <div style={{
      width: sizeMap[size], height: sizeMap[size],
      backgroundColor: 'var(--color-surface)',
      border: `2px solid ${animating ? 'var(--color-gold)' : 'var(--color-border)'}`,
      borderRadius: '8px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fontMap[size],
      fontVariantNumeric: 'tabular-nums',
      color: animating ? 'var(--color-gold)' : 'var(--color-text)',
      transition: 'border-color 0.1s, color 0.1s',
      animation: animating ? 'diceShake 0.1s ease-in-out infinite' : 'none',
      userSelect: 'none',
    }}>
      {face ?? '?'}
    </div>
  );
}
