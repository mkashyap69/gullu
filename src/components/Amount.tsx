/**
 * <Amount>: every rupee figure on screen (03-DESIGN-SYSTEM.md, 04-MOTION.md "Numbers").
 * - countUp: first reveal eases out and lands on the exact value (UI thread, no per-frame setState).
 * - odometer: live edits roll each digit column independently; tabular figures keep widths fixed.
 * - none: just the value.
 * Hide amounts: digits fade/soften to "₹ ••••••" over duration.fast, and back.
 */
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { formatINR, HIDDEN_AMOUNT } from '../lib/formatINR';
import { useReduceMotion } from '../motion/prefs';
import { useSettingsStore } from '../state/stores';
import { duration, easing, spring } from '../theme/motion';
import { colors } from '../theme/tokens';
import { textStyle } from './Text';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type Variant = 'big' | 'h1' | 'body' | 'label' | 'caption' | 'micro';

export type AmountProps = {
  value: number;
  compact?: boolean;
  signed?: boolean;
  variant?: Variant;
  color?: string;
  weight?: '400' | '500' | '600' | '700' | '800';
  animate?: 'countUp' | 'odometer' | 'none';
  /** Count-up length: duration.slow … duration.draw. */
  countMs?: number;
  delay?: number;
  /** Ignore Hide amounts (never used for real rupee figures; only for dev galleries). */
  alwaysShow?: boolean;
  style?: TextStyle;
  accessibilityLabel?: string;
};

function CountUp({ value, compact, signed, style, countMs, delay = 0 }: { value: number; compact?: boolean; signed?: boolean; style: TextStyle[]; countMs: number; delay?: number }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      v.value = value;
      return;
    }
    v.value = withDelay(delay, withTiming(value, { duration: countMs, easing: easing.out }));
  }, [value, reduce, countMs, delay, v]);
  const animatedProps = useAnimatedProps(() => {
    // Round on the way, land exactly on the final value.
    const shown = Math.abs(v.value - value) < 0.5 ? value : Math.round(v.value);
    return { text: formatINR(shown, { compact, signed }) } as unknown as Record<string, unknown>;
  });
  // An invisible copy of the final value sizes the box, so the moving digits never reflow the layout.
  return (
    <View>
      <Animated.Text style={[...style, styles.sizer]} maxFontSizeMultiplier={1.15} importantForAccessibility="no">
        {formatINR(value, { compact, signed })}
      </Animated.Text>
      <AnimatedTextInput
        editable={false}
        underlineColorAndroid="transparent"
        defaultValue={formatINR(reduce ? value : 0, { compact, signed })}
        animatedProps={animatedProps}
        style={[...style, styles.input, styles.overlay]}
        maxFontSizeMultiplier={1.15}
      />
    </View>
  );
}

function DigitColumn({ digit, lineHeight, style }: { digit: number; lineHeight: number; style: TextStyle[] }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(-digit * lineHeight);
  useEffect(() => {
    y.value = reduce ? -digit * lineHeight : withSpring(-digit * lineHeight, spring.snappy);
  }, [digit, lineHeight, reduce, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={a}>
        {DIGITS.map((d) => (
          <Animated.Text key={d} style={[...style, { height: lineHeight }]} maxFontSizeMultiplier={1.15}>
            {d}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
}
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function Odometer({ text, style, lineHeight }: { text: string; style: TextStyle[]; lineHeight: number }) {
  // Key columns from the right so the units digit keeps its column when the length changes.
  const chars = [...text];
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      {chars.map((ch, i) => {
        const key = `${chars.length - i}`;
        return /\d/.test(ch) ? (
          <DigitColumn key={key} digit={Number(ch)} lineHeight={lineHeight} style={style} />
        ) : (
          <Animated.Text key={`${key}${ch}`} style={style} maxFontSizeMultiplier={1.15}>
            {ch}
          </Animated.Text>
        );
      })}
    </View>
  );
}

export function Amount({
  value,
  compact,
  signed,
  variant = 'body',
  color = colors.text,
  weight,
  animate = 'none',
  countMs = duration.draw,
  delay,
  alwaysShow,
  style,
  accessibilityLabel,
}: AmountProps) {
  const hiddenSetting = useSettingsStore((s) => s.hideAmounts);
  const hidden = hiddenSetting && !alwaysShow;
  const base = useMemo(() => [textStyle(variant, color, weight), { fontVariant: ['tabular-nums'] } as TextStyle, style ?? {}], [variant, color, weight, style]);
  const lineHeight = (base[0].lineHeight as number) ?? 24;
  const text = formatINR(value, { compact, signed });

  // Hide amounts: cross-fade the digits out and the mask in.
  const hideT = useSharedValue(hidden ? 1 : 0);
  const [showMask, setShowMask] = useState(hidden);
  useEffect(() => {
    if (hidden) setShowMask(true);
    hideT.value = withTiming(hidden ? 1 : 0, { duration: duration.fast, easing: Easing.out(Easing.quad) });
    if (!hidden) {
      // Keep the mask mounted until it has faded out.
      const t = setTimeout(() => setShowMask(false), duration.fast);
      return () => clearTimeout(t);
    }
  }, [hidden, hideT]);
  const digitsStyle = useAnimatedStyle(() => ({ opacity: 1 - hideT.value, transform: [{ scale: 1 - 0.04 * hideT.value }] }));
  const maskStyle = useAnimatedStyle(() => ({ opacity: hideT.value }));

  const label = hidden ? 'Amount hidden' : accessibilityLabel ?? text;
  return (
    <View accessible accessibilityLabel={label} style={styles.wrap}>
      <Animated.View style={digitsStyle} importantForAccessibility="no-hide-descendants">
        {animate === 'countUp' ? (
          <CountUp value={value} compact={compact} signed={signed} style={base} countMs={countMs} delay={delay} />
        ) : animate === 'odometer' ? (
          <Odometer text={text} style={base} lineHeight={lineHeight} />
        ) : (
          <Animated.Text style={base} maxFontSizeMultiplier={1.15}>
            {text}
          </Animated.Text>
        )}
      </Animated.View>
      {showMask ? (
        <Animated.Text style={[...base, styles.mask, maskStyle]} maxFontSizeMultiplier={1.15}>
          {HIDDEN_AMOUNT}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/**
 * Before → after (What if, Apply): a strike line draws through the old value, then the new value
 * slides in from the right.
 */
export function AmountChange({ from, to, compact, variant = 'label', color = colors.text }: { from: number; to: number; compact?: boolean; variant?: Variant; color?: string }) {
  const reduce = useReduceMotion();
  const strike = useSharedValue(0);
  const slide = useSharedValue(0);
  useEffect(() => {
    strike.value = 0;
    slide.value = 0;
    if (reduce) {
      strike.value = 1;
      slide.value = 1;
      return;
    }
    strike.value = withTiming(1, { duration: duration.fast, easing: easing.out });
    slide.value = withDelay(duration.fast, withSpring(1, spring.snappy));
  }, [from, to, reduce, strike, slide]);
  const strikeStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: strike.value }] }));
  const newStyle = useAnimatedStyle(() => ({ opacity: slide.value, transform: [{ translateX: (1 - slide.value) * 16 }] }));
  return (
    <View style={styles.change}>
      <View>
        <Amount value={from} compact={compact} variant={variant} color={colors.textCaption} />
        <Animated.View style={[styles.strike, strikeStyle]} />
      </View>
      <Animated.View style={newStyle}>
        <Amount value={to} compact={compact} variant={variant} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  input: { padding: 0, margin: 0, includeFontPadding: false },
  sizer: { opacity: 0 },
  overlay: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, textAlign: 'left' },
  mask: { position: 'absolute', left: 0, top: 0 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  strike: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '52%',
    height: 2,
    backgroundColor: colors.textCaption,
    transformOrigin: 'left',
  },
});

/** Rolling digits for non-rupee numbers ("4 of 7 done"): each digit column rolls on its own. */
export function RollingText({ text, variant = 'body', color = colors.text, weight }: { text: string; variant?: Variant; color?: string; weight?: AmountProps['weight'] }) {
  const base = [textStyle(variant, color, weight), { fontVariant: ['tabular-nums'] } as TextStyle];
  return <Odometer text={text} style={base} lineHeight={(base[0].lineHeight as number) ?? 24} />;
}
