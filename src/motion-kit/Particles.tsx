/**
 * One reusable Skia particle system (04-MOTION.md "Particles").
 * Types: coin (gold disc), petal (marigold orange/yellow ellipse), dot (Holi colours, Holi skin only).
 * Physics: upward velocity cone (burst) or a fall from the top (rain), gravity, slight drag, random
 * spin, fade out in the last 30% of life. ≤ 60 particles, ≤ duration.celebrate. Simulated in a
 * frame-callback worklet and drawn as one Skia picture per frame. Reduced motion: renders nothing.
 */
import { Canvas, Picture, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { useReduceMotion } from '../motion/prefs';
import { duration, signature } from '../theme/motion';
import { gullu as gTokens } from '../theme/tokens';

export type ParticleKind = 'coin' | 'petal' | 'dot';
type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number; kind: number; color: number; life: number; age: number };

const PETAL_COLORS = ['#FF8A1F', '#FFC21A', '#FF6A00'];
const HOLI_COLORS = ['#FF4FA3', '#3BE08A', '#4C7DFF', '#FFD25A'];
const GRAVITY = 900; // px/s²
const DRAG = 0.9; // per second

export type ParticlesProps = {
  /** Increment to fire a new burst. 0 = idle. */
  trigger: number;
  kinds: ParticleKind[];
  count?: number;
  mode?: 'burst' | 'rain';
  /** Burst origin in px within the canvas. */
  origin?: { x: number; y: number };
  width: number;
  height: number;
  /** Seconds of life (≤ duration.celebrate). */
  lifeMs?: number;
};

function rand(seed: { s: number }) {
  seed.s = (seed.s * 1664525 + 1013904223) % 4294967296;
  return seed.s / 4294967296;
}

export function Particles({ trigger, kinds, count = 40, mode = 'burst', origin, width, height, lifeMs = duration.celebrate }: ParticlesProps) {
  const reduce = useReduceMotion();
  const parts = useSharedValue<P[]>([]);
  const tick = useSharedValue(0);
  const seed = useRef({ s: 12345 });
  const n = Math.min(count, signature.particleBudget);

  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const arr = parts.value;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.age += dt * 1000;
      p.vy += GRAVITY * dt * (p.kind === 1 ? 0.35 : 1); // petals float
      p.vx *= 1 - (1 - DRAG) * dt * 4;
      p.vy *= 1 - (1 - DRAG) * dt * (p.kind === 1 ? 6 : 1);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    tick.value = tick.value + 1;
  }, false);

  useEffect(() => {
    if (!trigger || reduce) return;
    const out: P[] = [];
    const o = origin ?? { x: width / 2, y: height / 2 };
    for (let i = 0; i < n; i++) {
      const r = () => rand(seed.current);
      const kindName = kinds[i % kinds.length];
      const kind = kindName === 'coin' ? 0 : kindName === 'petal' ? 1 : 2;
      const life = lifeMs * (0.7 + 0.3 * r());
      if (mode === 'burst') {
        const ang = -Math.PI / 2 + (r() - 0.5) * (Math.PI * 0.8); // upward cone
        const sp = 420 + r() * 520;
        out.push({ x: o.x, y: o.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: r() * 6.28, vr: (r() - 0.5) * 12, size: kind === 0 ? 6 + r() * 4 : 5 + r() * 4, kind, color: Math.floor(r() * 4), life, age: 0 });
      } else {
        out.push({ x: r() * width, y: -20 - r() * height * 0.4, vx: (r() - 0.5) * 80, vy: 60 + r() * 160, rot: r() * 6.28, vr: (r() - 0.5) * 8, size: kind === 0 ? 6 + r() * 4 : 5 + r() * 4, kind, color: Math.floor(r() * 4), life: life * 1.0, age: -r() * lifeMs * 0.3 });
      }
    }
    parts.value = out;
    frame.setActive(true);
    const t = setTimeout(() => {
      frame.setActive(false);
      parts.value = [];
      tick.value = tick.value + 1;
    }, lifeMs * 1.4);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduce]);

  const picture = useDerivedValue<SkPicture>(() => {
    // eslint-disable-next-line no-unused-expressions
    tick.value; // read so the picture redraws every frame while particles are live
    const rec = Skia.PictureRecorder();
    const c = rec.beginRecording(Skia.XYWHRect(0, 0, width, height));
    const paint = Skia.Paint();
    const stroke = Skia.Paint();
    stroke.setStyle(1);
    stroke.setStrokeWidth(1.5);
    stroke.setColor(Skia.Color(gTokens.coin.stroke));
    const arr = parts.value;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.age < 0 || p.age > p.life) continue;
      const t = p.age / p.life;
      const alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      c.save();
      c.translate(p.x, p.y);
      c.rotate((p.rot * 180) / Math.PI, 0, 0);
      if (p.kind === 0) {
        // Coins tumble: squash horizontally with the spin.
        c.scale(Math.max(0.2, Math.abs(Math.cos(p.rot))), 1);
        paint.setColor(Skia.Color(gTokens.coin.fill));
        paint.setAlphaf(alpha);
        stroke.setAlphaf(alpha);
        c.drawCircle(0, 0, p.size, paint);
        c.drawCircle(0, 0, p.size, stroke);
      } else if (p.kind === 1) {
        paint.setColor(Skia.Color(PETAL_COLORS[p.color % 3]));
        paint.setAlphaf(alpha);
        c.drawOval(Skia.XYWHRect(-p.size, -p.size * 0.5, p.size * 2, p.size), paint);
      } else {
        paint.setColor(Skia.Color(HOLI_COLORS[p.color % 4]));
        paint.setAlphaf(alpha * 0.85);
        c.drawCircle(0, 0, p.size * 0.8, paint);
      }
      c.restore();
    }
    return rec.finishRecordingAsPicture();
  });

  if (reduce) return null;
  return (
    <Canvas style={StyleSheet.flatten([StyleSheet.absoluteFill, { width, height }])} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
}
