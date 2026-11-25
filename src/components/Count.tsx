/**
 * A small integer that counts up and lands exactly (the 0 → 3 in "3 of 4"). Each step rolls its
 * digit column (spring), so a handful of steps reads as a count without per-frame updates.
 */
import { useEffect, useState } from 'react';

import { useReduceMotion } from '../motion/prefs';
import { duration } from '../theme/motion';
import { RollingText } from './Amount';

/** The current value of a stepped count-up, for counting inside a sentence. */
export function useCountUp(to: number, trigger = 1, delay = 0, ms: number = duration.slow, from = 0): number {
  const reduce = useReduceMotion();
  const [n, setN] = useState(reduce ? to : from);
  useEffect(() => {
    if (!trigger) return;
    if (reduce || to <= from) {
      setN(to);
      return;
    }
    setN(from);
    const steps = to - from;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps; i++) timers.push(setTimeout(() => setN(from + i), delay + (ms * i) / steps));
    return () => timers.forEach(clearTimeout);
  }, [to, trigger, delay, ms, reduce, from]);
  return n;
}

export function Count({ to, trigger = 1, delay = 0, ms = duration.slow, variant = 'h1', weight = '800' }: { to: number; trigger?: number; delay?: number; ms?: number; variant?: 'h1' | 'big' | 'body'; weight?: '400' | '700' | '800' }) {
  const reduce = useReduceMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!trigger) return;
    if (reduce || to <= 0) {
      setN(to);
      return;
    }
    setN(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= to; i++) timers.push(setTimeout(() => setN(i), delay + (ms * i) / to));
    return () => timers.forEach(clearTimeout);
  }, [to, trigger, delay, ms, reduce]);
  return <RollingText text={String(n)} variant={variant} weight={weight} />;
}
