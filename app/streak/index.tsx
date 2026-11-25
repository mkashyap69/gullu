/**
 * 10.4 Streak and challenges (violet). Month cells fill left to right; a shield month glints.
 * Challenge bars fill. Tap a challenge to stop it (neutral, no guilt). Only the user sees these.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { GhostButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { MAX_ACTIVE, isActive, type ChallengeData, type ChallengeStatus } from '@/engine/challenges';
import { monthName, shortMonth } from '@/engine/habits';
import { maskRupees } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useAmbient, useReduceMotion } from '@/motion/prefs';
import { useChallenges, useStreakState } from '@/plan/selectors';
import { useHabitsStore, useSettingsStore } from '@/state/stores';
import { duration, signature, spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

type Kind = 'placed' | 'shield' | 'now' | 'empty';

function Cell({ i, kind, label }: { i: number; kind: Kind; label: string }) {
  const reduce = useReduceMotion();
  const ambient = useAmbient();
  const f = useSharedValue(reduce ? 1 : 0);
  const glint = useSharedValue(0);
  useEffect(() => {
    if (!reduce) f.value = withDelay(i * stagger.list, withSpring(1, spring.snappy));
    if (kind === 'shield' && !reduce) glint.value = withDelay(duration.draw, withRepeat(withSequence(withTiming(1, { duration: duration.slow }), withTiming(0, { duration: duration.slow }), withTiming(0, { duration: signature.ambientDrift / 2 })), ambient ? -1 : 1, false));
  }, [reduce, ambient, i, kind, f, glint]);
  const fill = useAnimatedStyle(() => ({ opacity: f.value, transform: [{ scale: 0.6 + 0.4 * f.value }] }));
  const shine = useAnimatedStyle(() => ({ opacity: 0.15 + 0.6 * glint.value }));
  return (
    <View style={styles.cellCol}>
      <View style={[styles.cell, kind === 'now' && styles.now]}>
        {kind === 'placed' ? <Animated.View style={[styles.cellFill, fill]} /> : null}
        {kind === 'shield' ? (
          <Animated.View style={[styles.cellShield, fill]}>
            <Animated.View style={[styles.shieldGlint, shine]} />
            <Icon name="shield" size={16} />
          </Animated.View>
        ) : null}
      </View>
      <Caption center>{label}</Caption>
    </View>
  );
}

function Bar({ f }: { f: number }) {
  const reduce = useReduceMotion();
  const w = useSharedValue(reduce ? f : 0);
  useEffect(() => {
    w.value = reduce ? f : withDelay(duration.slow, withTiming(f, { duration: duration.draw }));
  }, [f, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.barFill, a]} />
    </View>
  );
}

export default function Streak() {
  const { s, placed, today } = useStreakState();
  const challenges = useChallenges();
  const hidden = useSettingsStore((st) => st.hideAmounts);
  const add = useHabitsStore((st) => st.add);
  const [stop, setStop] = useState<{ c: ChallengeData; status: ChallengeStatus } | null>(null);
  const cells = Array.from({ length: 12 }, (_, i) => today - 11 + i).map((m) => ({
    m,
    kind: (s.shielded.includes(m) ? 'shield' : placed.has(m) ? 'placed' : m === today ? 'now' : 'empty') as Kind,
  }));
  const lastShield = s.shielded.at(-1);
  const latestPlaced = placed.size ? Math.max(...placed) : today;
  const shieldLine = [
    lastShield != null ? `Your shield covered ${monthName(lastShield)}.` : null,
    s.shieldHeld ? 'You have a shield ready.' : `Next shield in ${monthName(latestPlaced + s.nextShieldIn)}.`,
    'A short month still counts.',
  ]
    .filter(Boolean)
    .join(' ');
  const shown = challenges.filter((x) => isActive(x.c) || (x.status.done && !x.c.done) || (x.c.done && x.c.start?.month === today));
  const active = challenges.filter((x) => isActive(x.c) && !x.status.done && !x.status.ended).length;

  return (
    <View style={styles.fill}>
      <Screen background="violet" scroll footer={<Caption>Only you see these. No prizes, no leaderboards.</Caption>}>
        <LabTop icon="back" />
        <Caption>Payday streak</Caption>
        <H1 style={styles.big}>{s.streak === 1 ? '1 month' : s.streak ? `${s.streak} months` : 'Starts with your next payday'}</H1>
        <View style={styles.cells}>
          {cells.map((c, i) => (
            <Cell key={c.m} i={i} kind={c.kind} label={shortMonth(c.m).slice(0, 1)} />
          ))}
        </View>
        <Body style={styles.note}>{shieldLine}</Body>
        <Caption style={styles.section}>Your challenges</Caption>
        {shown.map(({ c, status }) => (
          <PressScale key={c.id} style={styles.card} onPress={() => setStop({ c, status })} accessibilityRole="button" accessibilityLabel={`${c.name}, ${maskRupees(status.label, hidden)}`}>
            <View style={styles.cardTop}>
              <Label weight="800" style={styles.fill}>
                {c.name}
              </Label>
              <Body>{status.done ? 'Done ✓' : maskRupees(status.label, hidden)}</Body>
            </View>
            <Bar f={status.done ? 1 : Math.min(1, status.progress / status.target)} />
          </PressScale>
        ))}
        {active < MAX_ACTIVE ? (
          <GhostButton label="+ Pick a challenge" color={colors.text} onPress={() => router.push('/streak/pick')} />
        ) : (
          <Caption style={styles.note}>Two at a time. Finish or stop one to pick another.</Caption>
        )}
      </Screen>
      <Sheet open={stop != null} onClose={() => setStop(null)}>
        {stop ? (
          <View style={styles.sheet}>
            <Label>{stop.c.name}</Label>
            <Body>{stop.status.done ? 'Done. Nicely kept.' : 'Stopping is fine. You can pick it again any time.'}</Body>
            {!stop.status.done ? (
              <GhostButton
                label="Stop this challenge"
                onPress={async () => {
                  haptics.selection();
                  await add({ kind: 'challenge', data: { ...stop.c, ended: true }, at: today });
                  setStop(null);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  big: { fontSize: 56, lineHeight: 62 },
  cells: { flexDirection: 'row', gap: 4, marginTop: 16 },
  cellCol: { flex: 1, gap: 4 },
  cell: { height: 28, borderRadius: 6, backgroundColor: colors.glass, overflow: 'hidden' },
  now: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textCaption, backgroundColor: 'transparent' },
  cellFill: { flex: 1, backgroundColor: colors.white, opacity: 0.85 },
  cellShield: { flex: 1, borderWidth: 1.5, borderColor: colors.white, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  shieldGlint: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.white },
  note: { marginTop: 16 },
  section: { marginTop: 32, marginBottom: 12 },
  card: { backgroundColor: colors.glass, borderRadius: radius.md, padding: 16, gap: 12, marginBottom: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bar: { height: 5, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: radius.pill, backgroundColor: colors.white },
  sheet: { gap: 12 },
});
