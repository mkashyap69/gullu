/**
 * <Gullu expression skin size /> — the clay gullak, drawn in Skia part by part (reference/gullu.js)
 * so every part can move. One Canvas per instance; all animation runs on the UI thread.
 *
 * Ambient: idleBreathe (3s; 5s when sleepy) and blink (every 3.5–6s, 20% double) start by themselves.
 * Imperative (ref): land, hop, wave, celebrate, spin, catchCoin, lookAt, lookReset, concern.
 * Props: expression (cross-fades the face, arms morph on spring.snappy), skin (new extras draw on,
 * body gradient cross-fades), pull (stretchPull: a shared value 0..1 from pull-to-refresh).
 * Reduced motion: no breathe/hop/land/spin/particles; blink stays; changes become cross-fades.
 */
import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  RoundedRect,
  Skia,
  Text as SkText,
  rect,
  useFont,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '../motion/haptics';
import { useAmbient, useReduceMotion } from '../motion/prefs';
import { interBoldTtf } from '../theme/fonts';
import { duration, easing, gulluMotion, spring } from '../theme/motion';
import { gullu as tokens } from '../theme/tokens';
import {
  ARMS,
  ARM_L,
  ARM_R,
  BAND_PATH,
  BEADS,
  BODY_PATH,
  BUILDER_FLOWERS,
  CELEBRATE_COINS,
  CELEBRATE_SPARKS,
  CHEEK,
  CLOSED_EYES,
  CONCERN_BROWS,
  DEEP,
  DIWALI_FLOWERS,
  DIYA_INNER,
  DIYA_OUTER,
  GROUND,
  HOLI_SPLASHES,
  INK,
  MOUTH,
  PUPILS,
  RIM,
  SLEEPY_Z,
  SLOT,
  SLOT_POS,
  SWEAT_DROP,
  THINK_BUBBLES,
  ZIGZAG,
  skinBand,
  skinBody,
  skinHas,
  zPath,
  type Expression,
  type Skin,
} from './geometry';

export type GulluHandle = {
  /** Drop in from −80px, squash on impact, settle on spring.bouncy; lid lags 40ms. Heavy haptic. */
  land: () => void;
  /** Small jump (−18px) with squash/stretch and a light haptic. */
  hop: () => void;
  /** Right arm oscillates between down and up, twice. */
  wave: () => void;
  /** Beads ripple (arms up comes from the `celebrate` expression; particles are a separate layer). */
  celebrate: () => void;
  /** 360° Y-rotation faked in 2D, face hidden at the edges, 900ms. */
  spin: (onHalf?: () => void) => void;
  /** Coin falls along an arc into the slot; on contact the body squashes, cheeks flush, heavy haptic. */
  catchCoin: (onCaught?: () => void) => void;
  /** Pupils look toward a point (px from Gullu's centre), up to 4px, spring.snappy. */
  lookAt: (x: number, y: number) => void;
  lookReset: () => void;
  /** Sweat drop slides down once. No shaking. */
  concern: () => void;
  /** Draw the skin's extras on again (stroke trim) — Collection, Level up. */
  drawSkin: () => void;
};

export type GulluProps = {
  expression?: Expression;
  skin?: Skin;
  size?: number;
  aura?: boolean;
  auraColor?: string;
  /** Extra canvas space above Gullu (fraction of size) for the falling coin. */
  headroom?: number;
  /** stretchPull progress 0..1 (pull-to-refresh). */
  pull?: SharedValue<number>;
  /** Freeze ambient motion (static tiles in the Collection grid). */
  still?: boolean;
  /** Shine sweep across the body, 0 → 1 (Level up). */
  shine?: SharedValue<number>;
  ref?: Ref<GulluHandle>;
  accessibilityLabel?: string;
};

const VB = 240;

function armPath(pts: number[]) {
  'worklet';
  return Skia.PathBuilder.Make().moveTo(pts[0], pts[1]).quadTo(pts[2], pts[3], pts[4], pts[5]).build();
}

function mix(a: number[], b: number[], t: number) {
  'worklet';
  return a.map((v, i) => v + (b[i] - v) * t);
}

function Coin({ x, y, r, font, opacity = 1 }: { x: number; y: number; r: number; font: SkFont | null; opacity?: number }) {
  const glyph = '₹';
  const w = font ? font.measureText(glyph).width * ((r * 1.2) / font.getSize()) : 0;
  return (
    <Group opacity={opacity}>
      <Circle cx={x} cy={y} r={r} color={tokens.coin.fill} />
      <Circle cx={x} cy={y} r={r} color={tokens.coin.stroke} style="stroke" strokeWidth={2} />
      {font ? (
        <Group transform={[{ translateX: x - w / 2 }, { translateY: y + r * 0.42 }, { scale: (r * 1.2) / font.getSize() }]}>
          <SkText x={0} y={0} text={glyph} font={font} color={tokens.coin.text} />
        </Group>
      ) : null}
    </Group>
  );
}

/** Face + expression extras for one expression; cross-faded by the parent. */
function Face({
  expression,
  pupilDX,
  pupilDY,
  blink,
  cheekFlush,
  sweat,
  zT,
  font,
}: {
  expression: Expression;
  pupilDX: SharedValue<number>;
  pupilDY: SharedValue<number>;
  blink: SharedValue<number>;
  cheekFlush: SharedValue<number>;
  sweat: SharedValue<number>;
  zT: SharedValue<number>;
  font: SkFont | null;
}) {
  const pupils = PUPILS[expression];
  const closed = CLOSED_EYES[expression];
  const mouth = MOUTH[expression];
  const eyeTransform = useDerivedValue(() => [{ scaleY: blink.value }]);
  const pupilTransform = useDerivedValue(() => [{ translateX: pupilDX.value }, { translateY: pupilDY.value }]);
  const cheekOpacity = useDerivedValue(() => 0.55 + 0.4 * cheekFlush.value);
  const sweatTransform = useDerivedValue(() => [{ translateY: -10 + 12 * sweat.value }]);
  const sweatOpacity = useDerivedValue(() => Math.min(1, sweat.value * 3));
  const z = SLEEPY_Z.map((zz, i) => ({ ...zz, path: zPath(zz.x, zz.y, zz.s), i }));
  return (
    <Group>
      {/* eyes */}
      {pupils ? (
        <Group transform={eyeTransform} origin={vec(120, 134)}>
          {[98, 142].map((x) => (
            <Oval key={x} rect={rect(x - 13, 134 - 15, 26, 30)} color="#FFFFFF" />
          ))}
          <Group transform={pupilTransform}>
            {pupils.map(([px, py]) => (
              <Group key={px}>
                <Circle cx={px} cy={py} r={7.5} color={INK} />
                <Circle cx={px + 3} cy={py - 4} r={2.6} color="#FFFFFF" />
              </Group>
            ))}
          </Group>
        </Group>
      ) : null}
      {closed
        ? closed.map((d) => <Path key={d} path={d} style="stroke" strokeWidth={5} strokeCap="round" color={INK} />)
        : null}
      {expression === 'concern'
        ? CONCERN_BROWS.map((d) => <Path key={d} path={d} style="stroke" strokeWidth={5} strokeCap="round" color={INK} />)
        : null}
      {/* mouth */}
      {mouth.fill ? <Path path={mouth.d} color={mouth.fill} /> : <Path path={mouth.d} style="stroke" strokeWidth={4.5} strokeCap="round" color={mouth.stroke} />}
      {expression === 'celebrate' ? <Oval rect={rect(113, 164, 14, 8)} color="#FF6F7F" /> : null}
      {/* cheeks (concern has none) */}
      {expression !== 'concern' ? (
        <Group opacity={cheekOpacity}>
          <Oval rect={rect(70, 152.5, 20, 11)} color={CHEEK} />
          <Oval rect={rect(150, 152.5, 20, 11)} color={CHEEK} />
        </Group>
      ) : null}
      {/* expression extras */}
      {expression === 'think'
        ? THINK_BUBBLES.map((b) => <Circle key={b.x} cx={b.x} cy={b.y} r={b.r} color="rgba(255,255,255,0.85)" />)
        : null}
      {expression === 'celebrate' ? (
        <Group>
          {CELEBRATE_COINS.map((c) => (
            <Coin key={c.x} x={c.x} y={c.y} r={c.r} font={font} />
          ))}
          {CELEBRATE_SPARKS.map((d) => (
            <Path key={d} path={d} style="stroke" strokeWidth={3} strokeCap="round" color="#FFE08A" />
          ))}
        </Group>
      ) : null}
      {expression === 'concern' ? (
        <Group transform={sweatTransform} opacity={sweatOpacity}>
          <Path path={SWEAT_DROP} color="#9FD8FF" />
        </Group>
      ) : null}
      {expression === 'sleepy' ? z.map((zz) => <SleepyZ key={zz.i} path={zz.path} index={zz.i} t={zT} width={zz.s / 6} />) : null}
      {expression === 'catch' ? (
        <Group>
          <Path path="M100 2 v10" style="stroke" strokeWidth={2.5} strokeCap="round" color="rgba(255,224,138,0.8)" />
          <Path path="M140 2 v10" style="stroke" strokeWidth={2.5} strokeCap="round" color="rgba(255,224,138,0.8)" />
        </Group>
      ) : null}
    </Group>
  );
}

function SleepyZ({ path, index, t, width }: { path: string; index: number; t: SharedValue<number>; width: number }) {
  // Each z floats up and fades, on its own phase.
  const tr = useDerivedValue(() => {
    const p = (t.value + index / 3) % 1;
    return [{ translateY: -p * 14 }, { translateX: p * 4 }];
  });
  const op = useDerivedValue(() => {
    const p = (t.value + index / 3) % 1;
    return p < 0.2 ? p * 5 : 1 - (p - 0.2) / 0.8;
  });
  return (
    <Group transform={tr} opacity={op}>
      <Path path={path} style="stroke" strokeWidth={Math.max(2.5, width)} strokeJoin="round" strokeCap="round" color="#FFFFFF" />
    </Group>
  );
}

function SkinExtras({ skin, draw }: { skin: Skin; draw: SharedValue<number> }) {
  const has = skinHas(skin);
  const pop = useDerivedValue(() => [{ scale: Math.min(1, draw.value * 1.2) }]);
  return (
    <Group>
      {has.rim ? (
        <Group>
          <Oval rect={rect(RIM.lid.cx - RIM.lid.rx, RIM.lid.cy - RIM.lid.ry, RIM.lid.rx * 2, RIM.lid.ry * 2)} style="stroke" strokeWidth={3} color={RIM.color} />
          <Path
            path={`M${RIM.knob.cx - RIM.knob.r} ${RIM.knob.cy}a${RIM.knob.r} ${RIM.knob.r} 0 1 0 ${2 * RIM.knob.r} 0a${RIM.knob.r} ${RIM.knob.r} 0 1 0 ${-2 * RIM.knob.r} 0`}
            style="stroke"
            strokeWidth={2.5}
            color={RIM.color}
            end={draw}
          />
        </Group>
      ) : null}
      {has.flowers || has.diwaliFlowers
        ? (has.flowers ? BUILDER_FLOWERS : DIWALI_FLOWERS).map((f) => (
            <Group key={f.centre.x} transform={pop} origin={vec(f.centre.x, f.centre.y)}>
              {f.petals.map((p, i) => (
                <Circle key={i} cx={p.x} cy={p.y} r={4.2} color="#FFB000" />
              ))}
              <Circle cx={f.centre.x} cy={f.centre.y} r={3.4} color="#C2410C" />
            </Group>
          ))
        : null}
      {has.zigzag ? <Path path={ZIGZAG} style="stroke" strokeWidth={2.5} strokeJoin="round" color="#FFC83D" end={draw} /> : null}
      {has.splashes
        ? HOLI_SPLASHES.map((s) => (
            <Group key={s.x} transform={pop} origin={vec(s.x, s.y)}>
              <Circle cx={s.x} cy={s.y} r={s.r} color={s.c} opacity={s.o} />
            </Group>
          ))
        : null}
    </Group>
  );
}

function DiyaFlame({ flicker }: { flicker: SharedValue<number> }) {
  const tr = useDerivedValue(() => [{ scaleY: 1 + 0.08 * Math.sin(flicker.value * Math.PI * 2) }, { scaleX: 1 - 0.05 * Math.sin(flicker.value * Math.PI * 4) }]);
  return (
    <Group transform={tr} origin={vec(120, 34)}>
      <Path path={DIYA_OUTER} color="#FFB000" />
      <Path path={DIYA_INNER} color="#FFF1A8" />
    </Group>
  );
}

export function Gullu({
  expression = 'happy',
  skin = 'base',
  size = 220,
  aura = true,
  auraColor = tokens.aura,
  headroom = 0,
  pull,
  still = false,
  shine,
  ref,
  accessibilityLabel,
}: GulluProps) {
  const reduce = useReduceMotion();
  const ambientOn = useAmbient();
  const ambient = ambientOn && !still;
  const font = useFont(interBoldTtf, 24);
  const scale = size / VB;
  const top = headroom * VB;
  const lookMax = gulluMotion.lookMax / scale;

  // ---- shared values ----
  const breathe = useSharedValue(0);
  const blink = useSharedValue(1);
  const squashX = useSharedValue(1);
  const squashY = useSharedValue(1);
  const lift = useSharedValue(0); // wrapper translateY (px)
  const appear = useSharedValue(1);
  const lid = useSharedValue(0);
  const spinX = useSharedValue(1);
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const cheek = useSharedValue(0);
  const sweat = useSharedValue(1);
  const zT = useSharedValue(0);
  const ripple = useSharedValue(1);
  const draw = useSharedValue(1);
  const bodyFade = useSharedValue(1);
  const flicker = useSharedValue(0);
  const coinY = useSharedValue(-1); // -1 = no coin; otherwise viewBox y
  const coinX = useSharedValue(SLOT_POS.x);
  const armLT = useSharedValue(1);
  const armRT = useSharedValue(1);
  const faceT = useSharedValue(1);

  // Expression cross-fade + arm morph.
  const [faces, setFaces] = useState<{ prev: Expression | null; cur: Expression }>({ prev: null, cur: expression });
  const armTo = useSharedValue<{ l: number[]; r: number[]; lf: number[]; rf: number[] }>({
    l: ARM_L[ARMS[expression][0]],
    r: ARM_R[ARMS[expression][1]],
    lf: ARM_L[ARMS[expression][0]],
    rf: ARM_R[ARMS[expression][1]],
  });
  const lastExpr = useRef(expression);
  useEffect(() => {
    if (lastExpr.current === expression) return;
    const from = lastExpr.current;
    lastExpr.current = expression;
    setFaces({ prev: from, cur: expression });
    faceT.value = 0;
    faceT.value = withTiming(1, { duration: duration.fast, easing: easing.inOut });
    const lf = ARM_L[ARMS[from][0]];
    const rf = ARM_R[ARMS[from][1]];
    armTo.value = { l: ARM_L[ARMS[expression][0]], r: ARM_R[ARMS[expression][1]], lf, rf };
    armLT.value = 0;
    armRT.value = 0;
    armLT.value = reduce ? withTiming(1, { duration: duration.fast }) : withSpring(1, spring.snappy);
    armRT.value = reduce ? withTiming(1, { duration: duration.fast }) : withSpring(1, spring.snappy);
    if (expression === 'concern') {
      sweat.value = 0;
      sweat.value = withTiming(1, { duration: duration.slow, easing: easing.out });
    }
    if (expression === 'catch' || expression === 'celebrate') cheek.value = withSequence(withTiming(1, { duration: duration.fast }), withTiming(0, { duration: duration.slow }));
  }, [expression, reduce, faceT, armTo, armLT, armRT, sweat, cheek]);

  // Skin change: extras draw on, body gradient cross-fades.
  const [skins, setSkins] = useState<{ prev: Skin | null; cur: Skin }>({ prev: null, cur: skin });
  const lastSkin = useRef(skin);
  useEffect(() => {
    if (lastSkin.current === skin) return;
    const from = lastSkin.current;
    lastSkin.current = skin;
    setSkins({ prev: from, cur: skin });
    bodyFade.value = 0;
    bodyFade.value = withTiming(1, { duration: reduce ? duration.fast : duration.slow, easing: easing.inOut });
    draw.value = 0;
    draw.value = reduce ? 1 : withTiming(1, { duration: duration.slow, easing: easing.out });
  }, [skin, reduce, bodyFade, draw]);

  // Ambient: idleBreathe (or sleepy's slow breathe), z's, diya flicker.
  useEffect(() => {
    if (!ambient) {
      cancelAnimation(breathe);
      cancelAnimation(zT);
      cancelAnimation(flicker);
      breathe.value = withTiming(0, { duration: duration.fast });
      return;
    }
    const period = expression === 'sleepy' ? gulluMotion.sleepyPeriod : gulluMotion.breathePeriod;
    breathe.value = withRepeat(withTiming(1, { duration: period / 2, easing: easing.inOut }), -1, true);
    if (expression === 'sleepy') zT.value = withRepeat(withTiming(1, { duration: gulluMotion.sleepyPeriod, easing: Easing.linear }), -1, false);
    if (skin === 'diwali') flicker.value = withRepeat(withTiming(1, { duration: duration.draw, easing: Easing.linear }), -1, false);
    return () => {
      cancelAnimation(breathe);
      cancelAnimation(zT);
      cancelAnimation(flicker);
    };
  }, [ambient, expression, skin, breathe, zT, flicker]);

  // Blink: random 3.5–6s, 20% double. Tiny and non-vestibular, so it stays with reduced motion.
  useEffect(() => {
    if (still || (!ambientOn && !reduce)) return;
    let timer: ReturnType<typeof setTimeout>;
    const once = () => withSequence(withTiming(0.1, { duration: gulluMotion.blinkDuration / 2 }), withTiming(1, { duration: gulluMotion.blinkDuration / 2 }));
    const schedule = () => {
      const gap = gulluMotion.blinkMinGap + Math.random() * (gulluMotion.blinkMaxGap - gulluMotion.blinkMinGap);
      timer = setTimeout(() => {
        blink.value = Math.random() < gulluMotion.doubleBlinkChance ? withSequence(once(), withDelay(gulluMotion.blinkDuration / 2, once())) : once();
        schedule();
      }, gap);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [still, ambientOn, reduce, blink]);

  // ---- imperative animation library ----
  const api = useMemo<GulluHandle>(
    () => ({
      land: () => {
        if (reduce) {
          appear.value = 0;
          appear.value = withTiming(1, { duration: duration.fast });
          return;
        }
        appear.value = 1;
        lift.value = gulluMotion.landFrom;
        lift.value = withTiming(0, { duration: duration.base + duration.fast, easing: easing.in }, (done) => {
          if (!done) return;
          scheduleOnRN(haptics.heavy);
          squashY.value = gulluMotion.squashY;
          squashX.value = gulluMotion.squashX;
          squashY.value = withSpring(1, spring.bouncy);
          squashX.value = withSpring(1, spring.bouncy);
          lid.value = withDelay(gulluMotion.lidLag, withSequence(withTiming(4, { duration: duration.instant }), withSpring(0, spring.bouncy)));
        });
        lid.value = -6;
      },
      hop: () => {
        if (reduce) return;
        haptics.light();
        squashY.value = withSequence(withTiming(gulluMotion.squashY + 0.06, { duration: duration.instant }), withSpring(1.06, spring.press), withSpring(1, spring.bouncy));
        squashX.value = withSequence(withTiming(1.06, { duration: duration.instant }), withSpring(0.96, spring.press), withSpring(1, spring.bouncy));
        lift.value = withSequence(
          withDelay(duration.instant, withTiming(gulluMotion.hopHeight, { duration: duration.fast, easing: easing.out })),
          withTiming(0, { duration: duration.fast, easing: easing.in }),
        );
        lid.value = withSequence(withDelay(duration.instant + gulluMotion.lidLag, withTiming(-4, { duration: duration.fast })), withSpring(0, spring.bouncy));
      },
      wave: () => {
        if (reduce) return;
        const rest = ARM_R[ARMS[lastExpr.current][1]];
        armTo.value = { ...armTo.value, r: ARM_R.up, rf: ARM_R.down };
        armRT.value = 0;
        armRT.value = withRepeat(withSequence(withSpring(1, spring.snappy), withSpring(0, spring.snappy)), gulluMotion.waveCount, false, (done) => {
          if (!done) return;
          // Settle back into the current expression's pose.
          armTo.value = { ...armTo.value, r: rest, rf: ARM_R.down };
          armRT.value = withSpring(1, spring.snappy);
        });
      },
      celebrate: () => {
        if (reduce) return;
        ripple.value = 0;
        ripple.value = withTiming(1, { duration: duration.celebrate, easing: Easing.linear });
        cheek.value = withSequence(withTiming(1, { duration: duration.fast }), withTiming(0, { duration: duration.celebrate }));
      },
      spin: (onHalf) => {
        if (reduce) {
          if (onHalf) onHalf();
          return;
        }
        const q = gulluMotion.spinDuration / 4;
        spinX.value = withSequence(
          withTiming(0, { duration: q, easing: easing.in }),
          withTiming(-1, { duration: q, easing: easing.out }, (done) => {
            if (done && onHalf) scheduleOnRN(onHalf);
          }),
          withTiming(0, { duration: q, easing: easing.in }),
          withTiming(1, { duration: q, easing: easing.out }),
        );
      },
      catchCoin: (onCaught) => {
        const caught = () => {
          'worklet';
          coinY.value = -1;
          scheduleOnRN(haptics.heavy);
          cheek.value = withSequence(withTiming(1, { duration: duration.fast }), withTiming(0.2, { duration: duration.celebrate }));
          if (!reduce) {
            squashY.value = gulluMotion.squashY;
            squashX.value = gulluMotion.squashX;
            squashY.value = withSpring(1, spring.bouncy);
            squashX.value = withSpring(1, spring.bouncy);
            lid.value = withDelay(gulluMotion.lidLag, withSequence(withTiming(5, { duration: duration.instant }), withSpring(0, spring.bouncy)));
          }
          if (onCaught) scheduleOnRN(onCaught);
        };
        if (reduce) {
          caught();
          return;
        }
        coinX.value = SLOT_POS.x + 46;
        coinY.value = -top - 20;
        coinX.value = withTiming(SLOT_POS.x, { duration: duration.slow + duration.base, easing: easing.out });
        coinY.value = withTiming(SLOT_POS.y - 4, { duration: duration.slow + duration.base, easing: easing.in }, (done) => {
          if (done) caught();
        });
      },
      lookAt: (x, y) => {
        const d = Math.hypot(x, y) || 1;
        const k = Math.min(1, d / 40);
        lookX.value = withSpring((x / d) * lookMax * k, spring.snappy);
        lookY.value = withSpring((y / d) * lookMax * k, spring.snappy);
      },
      lookReset: () => {
        lookX.value = withSpring(0, spring.snappy);
        lookY.value = withSpring(0, spring.snappy);
      },
      concern: () => {
        sweat.value = 0;
        sweat.value = withTiming(1, { duration: duration.slow, easing: easing.out });
      },
      drawSkin: () => {
        draw.value = 0;
        draw.value = reduce ? 1 : withTiming(1, { duration: duration.slow, easing: easing.out });
      },
    }),
    [reduce, top, lookMax, appear, lift, squashX, squashY, lid, armTo, armRT, ripple, cheek, spinX, coinX, coinY, lookX, lookY, sweat, draw],
  );
  useImperativeHandle(ref, () => api, [api]);

  // ---- derived drawing values ----
  const bodyTransform = useDerivedValue(() => {
    const b = 1 + (gulluMotion.breatheScale - 1) * breathe.value;
    const p = pull ? pull.value : 0;
    const sy = squashY.value * b * (1 + (gulluMotion.stretchMax - 1) * p);
    const sx = squashX.value * b * (1 - 0.05 * p);
    return [{ scaleX: sx * spinX.value }, { scaleY: sy }];
  });
  const lidTransform = useDerivedValue(() => [{ translateY: lid.value }]);
  const auraOpacity = useDerivedValue(() => 0.85 + 0.15 * breathe.value + 0.15 * (1 - ripple.value) * (ripple.value > 0 ? 1 : 0));
  const faceOpacity = useDerivedValue(() => Math.max(0, Math.min(1, spinX.value * 1.6 - 0.2)));
  const prevFaceOpacity = useDerivedValue(() => 1 - faceT.value);
  const curFaceOpacity = useDerivedValue(() => faceT.value);
  // While a coin is falling, Gullu watches it; otherwise the pupils follow lookAt.
  const pupilDX = useDerivedValue(() =>
    coinY.value !== -1 ? Math.max(-lookMax, Math.min(lookMax, (coinX.value - SLOT_POS.x) * 0.1)) : lookX.value,
  );
  const pupilDY = useDerivedValue(() => (coinY.value !== -1 ? -lookMax : lookY.value));
  const leftArm = useDerivedValue(() => armPath(mix(armTo.value.lf, armTo.value.l, armLT.value)));
  const rightArm = useDerivedValue(() => armPath(mix(armTo.value.rf, armTo.value.r, armRT.value)));
  const beads = BEADS.map((b, i) => ({ ...b, i }));
  const bodyCur = skinBody(skins.cur);
  const bodyPrev = skins.prev ? skinBody(skins.prev) : null;
  const band = skinBand(skins.cur);
  const coinTransform = useDerivedValue(() => [{ translateX: coinX.value - 120 }, { translateY: coinY.value }]);
  const coinOpacity = useDerivedValue(() => (coinY.value === -1 ? 0 : 1));
  const wrapStyle = useAnimatedStyle(() => ({ opacity: appear.value, transform: [{ translateY: lift.value }] }));
  const prevSkinOpacity = useDerivedValue(() => 1 - bodyFade.value);

  const label = accessibilityLabel ?? `Gullu, ${expression}`;
  const height = size * (1 + headroom);

  return (
    <Animated.View style={[{ width: size, height }, wrapStyle]} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Canvas style={{ width: size, height }} pointerEvents="none">
        <Group transform={[{ scale }]}>
          <Group transform={[{ translateY: top }]}>
            {aura ? (
              <Group opacity={auraOpacity}>
                <Circle cx={120} cy={140} r={116}>
                  <RadialGradient c={vec(120, 140)} r={116} colors={[`${auraColor}99`, `${auraColor}00`]} />
                </Circle>
              </Group>
            ) : null}
            {skins.cur === 'diwali' ? <DiyaFlame flicker={flicker} /> : null}
            <Group transform={bodyTransform} origin={vec(GROUND.x, GROUND.y)}>
              {/* feet */}
              <Oval rect={rect(81, 208, 30, 14)} color={DEEP} />
              <Oval rect={rect(129, 208, 30, 14)} color={DEEP} />
              {/* arms */}
              <Path path={leftArm} style="stroke" strokeWidth={11} strokeCap="round" color={DEEP} />
              <Path path={rightArm} style="stroke" strokeWidth={11} strokeCap="round" color={DEEP} />
              {/* body */}
              {bodyPrev ? <BodyFill colors={bodyPrev} opacity={prevSkinOpacity} /> : null}
              <BodyFill colors={bodyCur} opacity={bodyFade} />
              {/* lid + knob (secondary motion) */}
              <Group transform={lidTransform}>
                <Oval rect={rect(101, 50, 38, 14)} color={DEEP} />
                <Circle cx={120} cy={45} r={10}>
                  <RadialGradient c={vec(117.6, 41.4)} r={15} colors={bodyCur} positions={[0, 0.45, 0.85, 1]} />
                </Circle>
              </Group>
              {/* coin slot */}
              <RoundedRect x={101} y={74} width={38} height={8} r={4} color={SLOT} />
              {/* highlight */}
              <Group transform={[{ rotate: (-32 * Math.PI) / 180 }]} origin={vec(84, 98)}>
                <Oval rect={rect(67, 89, 34, 18)} color="rgba(255,255,255,0.32)" />
              </Group>
              {/* band + beads */}
              <Path path={BAND_PATH} style="stroke" strokeWidth={2.5} color={band} opacity={0.85} />
              {beads.map((b) => (
                <Bead key={b.i} x={b.x} y={b.y} i={b.i} color={band} ripple={ripple} />
              ))}
              <SkinExtras skin={skins.cur} draw={draw} />
              {shine ? <Shine t={shine} /> : null}
              {/* face, hidden when Gullu is edge-on or turned away during a spin */}
              <Group opacity={faceOpacity}>
                {faces.prev && faces.prev !== faces.cur ? (
                  <Group opacity={prevFaceOpacity}>
                    <Face expression={faces.prev} pupilDX={pupilDX} pupilDY={pupilDY} blink={blink} cheekFlush={cheek} sweat={sweat} zT={zT} font={font} />
                  </Group>
                ) : null}
                <Group opacity={curFaceOpacity}>
                  <Face expression={faces.cur} pupilDX={pupilDX} pupilDY={pupilDY} blink={blink} cheekFlush={cheek} sweat={sweat} zT={zT} font={font} />
                </Group>
              </Group>
            </Group>
            {/* falling coin (Payday catch) */}
            <Group transform={coinTransform} opacity={coinOpacity}>
              <Coin x={120} y={0} r={13} font={font} />
            </Group>
          </Group>
        </Group>
      </Canvas>
    </Animated.View>
  );
}

/** A soft white band sweeping diagonally across the body (clipped to it). */
function Shine({ t }: { t: SharedValue<number> }) {
  const clip = useMemo(() => Skia.Path.MakeFromSVGString(BODY_PATH)!, []);
  const tr = useDerivedValue(() => [{ translateX: -120 + t.value * 300 }, { rotate: 0.5 }]);
  const op = useDerivedValue(() => (t.value <= 0 || t.value >= 1 ? 0 : 1));
  return (
    <Group clip={clip} opacity={op}>
      <Group transform={tr} origin={vec(120, 136)}>
        <RoundedRect x={0} y={20} width={44} height={240} r={22}>
          <LinearGradient start={vec(0, 0)} end={vec(44, 0)} colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} />
        </RoundedRect>
      </Group>
    </Group>
  );
}

function BodyFill({ colors, opacity }: { colors: string[]; opacity: SharedValue<number> | number }) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(BODY_PATH)!, []);
  return (
    <Group opacity={opacity as number}>
      <Path path={path}>
        <RadialGradient c={vec(100.8, 107.9)} r={124} colors={colors} positions={[0, 0.45, 0.85, 1]} />
      </Path>
    </Group>
  );
}

function Bead({ x, y, i, color, ripple }: { x: number; y: number; i: number; color: string; ripple: SharedValue<number> }) {
  const cy = useDerivedValue(() => {
    const r = ripple.value;
    if (r >= 1) return y;
    return y - Math.sin((r * 4 - i * 0.18) * Math.PI * 2) * 3 * (1 - r);
  });
  return <Circle cx={x} cy={cy} r={3} color={color} opacity={0.9} />;
}

/** A still Gullu (no ambient motion), for small tiles and chips. */
export function GulluStill(props: Omit<GulluProps, 'still' | 'ref'>) {
  return (
    <View>
      <Gullu {...props} still />
    </View>
  );
}

