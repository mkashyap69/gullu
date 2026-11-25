/**
 * 8.1 You (night). Profile, the risk meter, and the way into levels, the risk check, assumptions,
 * privacy, notifications and Learn. The meter fills to the profile in use, with ghost markers for
 * capacity and tolerance. Moving above the lower of the two shows 8.5 first.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { OptionCard } from '@/components/OptionCard';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { GlassCard, Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { labelYM } from '@/engine/dates';
import { LEVELS } from '@/engine/habits';
import { computePlanFast, currentAge, effectiveRisk } from '@/engine/plan';
import { RISK_ORDER, type RiskProfile } from '@/engine/types';
import { GulluStill } from '@/gullu/Gullu';
import { RISK_NAME, STAGE_NAME, WORK_NAME } from '@/lib/labels';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { useLevel } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useProfileStore, useSettingsStore } from '@/state/stores';
import { spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function Segment({ i, on }: { i: number; on: boolean }) {
  const reduce = useReduceMotion();
  const f = useSharedValue(reduce && on ? 1 : 0);
  useEffect(() => {
    f.value = reduce ? (on ? 1 : 0) : withDelay(i * stagger.rings, withSpring(on ? 1 : 0, spring.gentle));
  }, [on, reduce, i, f]);
  const a = useAnimatedStyle(() => ({ width: `${f.value * 100}%` }));
  return (
    <View style={styles.seg}>
      <Animated.View style={[styles.segFill, a]} />
    </View>
  );
}

/** Five segments filled up to the profile in use; ghost markers show capacity and tolerance. */
function RiskMeter({ use, capacity, tolerance }: { use: RiskProfile; capacity: RiskProfile; tolerance: RiskProfile }) {
  const at = RISK_ORDER.indexOf(use);
  const marks = [
    { k: 'Capacity', i: RISK_ORDER.indexOf(capacity) },
    { k: 'Answers', i: RISK_ORDER.indexOf(tolerance) },
  ];
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`Risk profile ${RISK_NAME[use]}, ${at + 1} of 5`}>
      <View style={styles.meter}>
        {RISK_ORDER.map((r, i) => (
          <Segment key={r} i={i} on={i <= at} />
        ))}
      </View>
      <View style={styles.marks}>
        {RISK_ORDER.map((r, i) => {
          const here = marks.filter((m) => m.i === i).map((m) => m.k);
          return (
            <View key={r} style={styles.mark}>
              {here.length ? <Caption center>{here.join(' · ')}</Caption> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function YouTab() {
  const input = usePlanInput();
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const settings = useSettingsStore();
  const level = useLevel();
  const [sheet, setSheet] = useState<'change' | 'warn' | 'feel' | null>(null);
  const [want, setWant] = useState<RiskProfile | null>(null);
  if (!input || !profile) return null;

  const use = effectiveRisk(profile);
  const lower = effectiveRisk({ ...profile, riskOverride: null });
  const age = currentAge(profile, input.today);
  const lvl = LEVELS.find((l) => l.n === level);
  const explain =
    profile.riskOverride && profile.riskOverride !== lower
      ? `You chose ${RISK_NAME[use]}. Your answers say ${RISK_NAME[profile.riskTolerance]} and your capacity says ${RISK_NAME[profile.riskCapacity]}.`
      : profile.riskCapacity === profile.riskTolerance
        ? `Your capacity and your answers both say ${RISK_NAME[use]}.`
        : `Your capacity says ${RISK_NAME[profile.riskCapacity]}. Your answers say ${RISK_NAME[profile.riskTolerance]}. I go with the lower one.`;

  const choose = async (r: RiskProfile) => {
    if (RISK_ORDER.indexOf(r) > RISK_ORDER.indexOf(lower)) {
      setWant(r);
      setSheet('warn');
      return;
    }
    haptics.selection();
    await setProfile({ ...profile, riskOverride: r === lower ? null : r });
    setSheet(null);
  };
  const allOnTrack = (() => {
    const p = computePlanFast(input);
    return p.onTrack === p.total;
  })();

  return (
    <View style={styles.fill}>
      <Screen background="night" scroll>
        <H1>You</H1>
        <View style={styles.who}>
          <View style={styles.avatar}>
            <H1>{(profile.name || 'Y').slice(0, 1).toUpperCase()}</H1>
          </View>
          <View style={styles.fill}>
            <Label>
              {profile.name ? `${profile.name}, ${age}` : `${age}`}
            </Label>
            <Body>
              {STAGE_NAME[profile.stage]} · {WORK_NAME[profile.work]}
              {profile.dependents ? ` · ${profile.dependents} dependent${profile.dependents === 1 ? '' : 's'}` : ''}
            </Body>
          </View>
        </View>
        <GlassCard style={styles.card}>
          <Caption>Risk profile</Caption>
          <H1 testID="you-risk">{RISK_NAME[use]}</H1>
          <Body>{explain}</Body>
          <RiskMeter use={use} capacity={profile.riskCapacity} tolerance={profile.riskTolerance} />
        </GlassCard>
        <Row title="Levels and streak" detail={lvl ? `Level ${lvl.n} · ${lvl.name}` : 'Your first payday starts it'} chevron onPress={() => router.push('/levels')} />
        <Row title="Retake the risk check" detail={profile.riskCheckedAt != null ? `Last done ${labelYM(profile.riskCheckedAt)}` : 'Five questions'} chevron onPress={() => router.push({ pathname: '/onboarding/risk', params: { retake: '1' } })} />
        <Row title="Change risk profile" detail={RISK_NAME[use]} chevron onPress={() => setSheet('change')} />
        <Row title="Assumptions" detail="Returns and inflation" chevron onPress={() => router.push('/you/assumptions')} />
        <Row title="Privacy and data" detail={settings.appLock ? 'App lock is on' : 'App lock is off'} chevron onPress={() => router.push('/you/privacy')} />
        <Row title="Notifications" detail={settings.notifications ? 'At most 2 a week' : 'Off'} chevron onPress={() => router.push('/you/notifications')} />
        <Row title="Learn with Gullu" detail="24 short explainers" chevron onPress={() => router.push('/you/learn')} />
        <Row title="Motion and haptics" detail={settings.reduceMotion ? 'Calmer motion' : 'Full motion'} chevron onPress={() => setSheet('feel')} />
        {__DEV__ ? <GhostButton label="Dev tools" onPress={() => router.push('/dev')} /> : null}
      </Screen>
      <Sheet open={sheet != null} onClose={() => setSheet(null)}>
        {sheet === 'change' ? (
          <View style={styles.sheet}>
            <Label>Change risk profile</Label>
            <Body>Your answers and capacity suggest {RISK_NAME[lower]}. Lower is always fine.</Body>
            {RISK_ORDER.map((r) => (
              <OptionCard key={r} label={r === lower ? `${RISK_NAME[r]} · suggested` : RISK_NAME[r]} selected={r === use} onPress={() => choose(r)} testID={`risk-pick-${r}`} />
            ))}
          </View>
        ) : null}
        {sheet === 'warn' && want ? (
          <View style={styles.sheet}>
            <GulluStill size={72} expression="concern" aura={false} />
            <H1>{RISK_NAME[want]} is more than your goals need.</H1>
            <Body>
              {allOnTrack
                ? `Your answers said ${RISK_NAME[lower]}, and your goals are on track with it. ${RISK_NAME[want]} means deeper falls in bad years, for gains this plan doesn't need.`
                : `Your answers said ${RISK_NAME[lower]}. ${RISK_NAME[want]} means deeper falls in bad years. A little more each month is the steadier way to close a gap.`}
            </Body>
            <Body>It&apos;s your call. You can switch back any time.</Body>
            <PrimaryButton label={`Stay ${RISK_NAME[lower]}`} onPress={() => setSheet(null)} testID="warn-stay" />
            <GhostButton
              label={`Switch to ${RISK_NAME[want]} anyway`}
              onPress={async () => {
                await setProfile({ ...profile, riskOverride: want });
                setSheet(null);
              }}
            />
          </View>
        ) : null}
        {sheet === 'feel' ? (
          <View style={styles.sheet}>
            <Toggle label="Reduce animations" value={settings.reduceMotion} onChange={(v) => settings.update({ reduceMotion: v })} />
            <Toggle label="Haptics" value={settings.haptics} onChange={(v) => settings.update({ haptics: v })} />
            <Caption>Your phone&apos;s reduce-motion setting is always followed too.</Caption>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center' },
  card: { marginTop: 24, marginBottom: 12, gap: 6 },
  meter: { flexDirection: 'row', gap: 4, marginTop: 10 },
  seg: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' },
  segFill: { height: 5, borderRadius: radius.pill, backgroundColor: colors.white },
  marks: { flexDirection: 'row', gap: 4, marginTop: 4 },
  mark: { flex: 1, alignItems: 'center' },
  sheet: { gap: 12 },
});
