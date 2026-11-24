/**
 * 1.3 Risk check (dusk). Five questions; capacity and tolerance are scored separately and the
 * lower wins. Questions slide horizontally and the progress text cross-fades. On the ₹10 L
 * question the number counts down to ₹7.5 L while the line drops, so the fall is felt, not read.
 * Only Question 3 is from the designs; the other four are drafts for owner review.
 */
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { OptionCard } from '@/components/OptionCard';
import { Screen } from '@/components/Screen';
import { Caption, H1 } from '@/components/Text';
import { RISK_QUESTIONS } from '@/engine/onboarding';
import { useReduceMotion } from '@/motion/prefs';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { isRetired, useOnboarding } from '@/state/onboarding';
import { duration, easing } from '@/theme/motion';
import { colors, layout } from '@/theme/tokens';

const CHART_H = 140;

function FallChart({ width }: { width: number }) {
  const reduce = useReduceMotion();
  const draw = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) draw.value = withDelay(duration.fast, withTiming(1, { duration: duration.draw, easing: easing.out }));
  }, [reduce, draw]);
  const top = 24;
  const low = CHART_H - 34;
  const path = useMemo(
    () =>
      Skia.Path.MakeFromSVGString(
        `M0 ${top + 8} C${width * 0.18} ${top + 4}, ${width * 0.32} ${top + 4}, ${width * 0.38} ${top + 12} S${width * 0.48} ${low}, ${width * 0.51} ${low} L${width} ${top - 8}`,
      )!,
    [width, low],
  );
  const dotOpacity = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) dotOpacity.value = withDelay(duration.fast + duration.draw * 0.6, withTiming(1, { duration: duration.fast }));
  }, [reduce, dotOpacity]);
  return (
    <View style={{ height: CHART_H + 20 }}>
      <Caption>₹10 L</Caption>
      <Canvas style={{ width, height: CHART_H }} pointerEvents="none">
        <Path path={path} style="stroke" strokeWidth={3} strokeCap="round" color={colors.white} start={0} end={draw} />
        <Circle cx={width * 0.51} cy={low} r={7} color={colors.stretch} opacity={dotOpacity} />
      </Canvas>
      <View style={[styles.lowLabel, { left: width * 0.51 - 30 }]}>
        <Amount value={750000} countFrom={1000000} compact animate="countUp" countMs={duration.draw} variant="caption" color={colors.stretch} alwaysShow />
      </View>
    </View>
  );
}

export default function RiskCheck() {
  const s = useOnboarding();
  const { width } = useWindowDimensions();
  const [i, setI] = useState(0);
  const q = RISK_QUESTIONS[i];
  const chosen = s.risk[q.key];
  const web = Platform.OS === 'web';

  const choose = (idx: number) => {
    s.set({ risk: { ...s.risk, [q.key]: idx } });
    // Let the chosen card glow for a beat, then move on.
    setTimeout(() => {
      if (i < RISK_QUESTIONS.length - 1) setI(i + 1);
      else router.push(isRetired(s) ? '/onboarding/have' : '/onboarding/goals');
    }, duration.slow);
  };

  return (
    <Screen background="dusk" footer={<Caption center>There&apos;s no right answer. This sets how much ups and downs your plan takes on.</Caption>}>
      <OnboardingTop step="risk" onBack={() => (i > 0 ? setI(i - 1) : router.back())} />
      <Animated.View key={`p${i}`} entering={web ? undefined : FadeIn.duration(duration.base)} exiting={web ? undefined : FadeOut.duration(duration.fast)}>
        <Caption>
          Question {i + 1} of {RISK_QUESTIONS.length}
        </Caption>
      </Animated.View>
      <Animated.View
        key={q.key}
        entering={web ? undefined : SlideInRight.duration(duration.slow).easing(easing.out)}
        exiting={web ? undefined : SlideOutLeft.duration(duration.base).easing(easing.in)}
        style={styles.q}
      >
        <H1>{q.question}</H1>
        {q.key === 'fall' ? <FallChart width={width - layout.screenPadding.horizontal * 2} /> : <View style={styles.spacer} />}
        <View style={styles.options}>
          {q.options.map((o, idx) => (
            <OptionCard key={o.label} testID={`risk-${q.key}-${idx}`} label={o.label} selected={chosen === idx} onPress={() => choose(idx)} />
          ))}
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  q: { marginTop: 8 },
  spacer: { height: 20 },
  options: { gap: 12, marginTop: 8 },
  lowLabel: { position: 'absolute', top: CHART_H - 4, width: 60, alignItems: 'center' },
});
