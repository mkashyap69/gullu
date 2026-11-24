/**
 * Signature moment 2 · The answer (1.7, dusk). The onboarding payoff.
 * The dial ticks light up in a hue sweep around Gullu (60 ticks, 15ms apart), "3 of 4" counts,
 * Gullu celebrates with a small coin burst, and the goal rows cascade in with their status colour
 * sweeping across each row. The off-track goal pulses amber once. The disclaimer fades in last.
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { PrimaryButton } from '@/components/Buttons';
import { useCountUp } from '@/components/Count';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { goalAccent, ringProgress } from '@/dev/labData';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { labelYM } from '@/engine/dates';
import { effectiveRisk } from '@/engine/plan';
import type { GoalResult } from '@/engine/types';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import type { Expression } from '@/gullu/geometry';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { Dial } from '@/motion-kit/Dial';
import { GoalRing } from '@/motion-kit/GoalRing';
import { Particles } from '@/motion-kit/Particles';
import { usePlan, usePlanInput } from '@/plan/usePlan';
import { useSettingsStore } from '@/state/stores';
import { duration, easing, signature, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const PROFILE_NAMES = { safetyFirst: 'Safety-first', cautious: 'Cautious', balanced: 'Balanced', growth: 'Growth', aggressive: 'Aggressive' } as const;
const DIAL = 220;
const GULLU = 150;
const SWEEP = signature.dialTicks * signature.dialTickGap; // the dial's full sweep

function statusLine(g: GoalResult, today: number, hidden: boolean): { text: string; color: string } {
  if (!g.onTrack) return { text: `Short by ${formatINR(Math.round(g.shortBy / 1e5) * 1e5, { compact: true, hidden })}`, color: colors.stretch };
  if (g.couldStopAt) return { text: `Could stop at ${g.couldStopAt}`, color: colors.comfortable };
  const goalDate = today + g.months;
  const early = g.projectedDate != null ? goalDate - g.projectedDate : 0;
  if (g.projectedDate != null && early > 0) {
    return { text: `${labelYM(g.projectedDate)}, ${early} month${early === 1 ? '' : 's'} early`, color: colors.comfortable };
  }
  return { text: labelYM(goalDate), color: colors.comfortable };
}

function GoalLine({ g, index, accent, start, today }: { g: GoalResult; index: number; accent: string; start: number; today: number }) {
  const reduce = useReduceMotion();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const sweep = useSharedValue(reduce ? 1 : 0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!start) return;
    const d = index * stagger.cards * 2;
    if (reduce) {
      sweep.value = 1;
      return;
    }
    sweep.value = 0;
    sweep.value = withDelay(d, withTiming(1, { duration: duration.slow, easing: easing.out }));
    if (!g.onTrack) pulse.value = withDelay(d + duration.slow, withSequence(withTiming(1, { duration: duration.base }), withTiming(0, { duration: duration.slow })));
  }, [start, index, reduce, g.onTrack, sweep, pulse]);
  const st = statusLine(g, today, hidden);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: sweep.value }], opacity: 0.18 * (1 - sweep.value) + 0.04 }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value * 0.35 }));
  return (
    <Rise index={index} delay={0}>
      <View style={styles.goalRow}>
        <Animated.View style={[styles.sweep, { backgroundColor: st.color }, sweepStyle]} />
        <Animated.View style={[styles.sweep, { backgroundColor: colors.stretch }, pulseStyle]} />
        <GoalRing progress={ringProgress(g)} color={accent} size={40} stroke={5} index={index} />
        <Body color={colors.text} style={styles.goalName}>
          {g.name}
        </Body>
        <View style={[styles.dot, { backgroundColor: st.color }]} />
        <Caption color={st.color}>{st.text}</Caption>
      </View>
    </Rise>
  );
}

export default function AnswerMoment() {
  const { plan } = usePlan();
  const input = usePlanInput();
  const skin = useHabitSkin();
  const reduce = useReduceMotion();
  const gullu = useRef<GulluHandle>(null);
  const [run, setRun] = useState(1);
  const [expr, setExpr] = useState<Expression>('happy');
  const [burst, setBurst] = useState(0);
  const [rows, setRows] = useState(0);
  const counted = useCountUp(plan?.onTrack ?? 0, run, reduce ? 0 : SWEEP * 0.5);
  const hidden = useSettingsStore((s) => s.hideAmounts);

  useEffect(() => {
    setExpr('happy');
    setRows(0);
    const t1 = setTimeout(() => {
      setExpr('celebrate');
      gullu.current?.celebrate();
      setBurst((b) => b + 1);
      haptics.success();
    }, reduce ? 0 : SWEEP * 0.75);
    const t2 = setTimeout(() => setRows((r) => r + 1), reduce ? 0 : SWEEP * 0.6);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [run, reduce]);

  if (!plan || !input) return <Screen background="dusk">{null}</Screen>;
  const profileName = PROFILE_NAMES[effectiveRisk(input.profile)];
  const extra = plan.focus?.extraMonthly ?? 0;

  return (
    <Screen
      background="dusk"
      footer={
        <>
          <PrimaryButton label="Go to my plan" onPress={() => router.push('/dev/moments/home-rings')} />
          <Animated.View entering={reduce ? FadeIn.duration(duration.fast) : FadeIn.delay(SWEEP + duration.slow).duration(duration.slow)}>
            <Caption center>Profile: {profileName}. Not a guarantee or investment advice.</Caption>
          </Animated.View>
        </>
      }
    >
      <LabTop icon="none" onReplay={() => setRun((r) => r + 1)} />
      <View style={styles.hero} key={run}>
        <View style={styles.dial}>
          <Dial size={DIAL} value={plan.onTrack / Math.max(1, plan.total)} trigger={run} />
        </View>
        <Gullu ref={gullu} size={GULLU} expression={expr} skin={skin} />
        <Particles trigger={burst} kinds={['coin']} count={18} width={DIAL} height={DIAL} origin={{ x: DIAL / 2, y: DIAL / 2 - 20 }} lifeMs={duration.celebrate * 0.7} />
      </View>
      <H1 style={styles.headline}>
        {counted} of {plan.total} goals are on track.
      </H1>
      <Rise index={1} key={`b${run}`}>
        <Body>
          Your safety net is {plan.safetyNet?.full ? 'full' : 'filling'}.{' '}
          {extra > 0 ? `One goal needs ${formatINR(extra, { hidden })} more a month.` : 'Every goal is on track.'}
        </Body>
      </Rise>
      <View style={styles.list} key={`l${run}`}>
        {rows
          ? plan.goals.map((g, i) => <GoalLine key={g.goalId} g={g} index={i} accent={goalAccent(input, g.goalId)} start={rows} today={input.today} />)
          : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', height: DIAL, marginTop: -8 },
  dial: { position: 'absolute' },
  headline: { marginTop: 12 },
  list: { marginTop: 16, gap: 4 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: 16, paddingHorizontal: 4, overflow: 'hidden' },
  sweep: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, transformOrigin: 'left', borderRadius: 16 },
  goalName: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
