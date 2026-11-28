/**
 * 6.1 What if (sky). A sandbox over the plan: choose a chip, drag its slider, and every goal shows
 * before (struck through) and after (sliding in). Each change runs on the fast single-line path.
 * The plan never changes here until the user applies (6.2). Choosing a chip runs a quick "rewind"
 * shimmer over the rows. Reduced motion: values swap in place, no shimmer.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { Pill, SegmentedPills } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Slider } from '@/components/Slider';
import { Body, Caption, H1, Label, textStyle } from '@/components/Text';
import { TickCircle } from '@/components/TickCircle';
import { goalResultFast, planGoals, safetyNet } from '@/engine/plan';
import { applicableChanges, compareScenario, fixChanges, scenarioHeadline, scenarioName, type GoalOutcome, type ScenarioChanges } from '@/engine/scenario';
import { GulluStill } from '@/gullu/Gullu';
import { formatINR, maskRupees } from '@/lib/formatINR';
import { goalColor } from '@/lib/goalColors';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { ringName } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useProfileStore, useScenarioStore, useSettingsStore } from '@/state/stores';
import { distance, duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

type Chip = 'noIncome' | 'replay' | 'retire' | 'fix' | 'prepay';

/** The new value slides in whenever it changes. */
function SlideValue({ text, color }: { text: string; color: string }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    x.value = distance.enter;
    o.value = 0;
    x.value = withTiming(0, { duration: duration.base });
    o.value = withTiming(1, { duration: duration.base });
  }, [text, reduce, x, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={[styles.after, a]}>
      <Label color={color} weight="800">
        {text}
      </Label>
    </Animated.View>
  );
}

function Rows({ outcomes, rewind }: { outcomes: GoalOutcome[]; rewind: number }) {
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const sweep = useSharedValue(-1);
  useEffect(() => {
    if (reduce || !rewind) return;
    sweep.value = withSequence(withTiming(-1, { duration: 0 }), withTiming(1, { duration: duration.slow }));
  }, [rewind, reduce, sweep]);
  const band = useAnimatedStyle(() => ({ opacity: sweep.value > -1 && sweep.value < 1 ? 0.18 : 0, transform: [{ translateX: ((sweep.value + 1) / 2) * w - 60 }] }));
  if (!input) return null;
  return (
    <View style={styles.rows} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {outcomes.map((o) => {
        const g = input.goals.find((x) => x.id === o.goalId)!;
        return (
          <View key={o.goalId} style={styles.row} testID={`whatif-row-${o.goalId}`}>
            <View style={[styles.dot, { backgroundColor: goalColor(g) }]} />
            <Body color={colors.text} style={styles.name} numberOfLines={1} ellipsizeMode="clip">
              {ringName(o.name)}
            </Body>
            <Body style={styles.before}>{maskRupees(o.before, hidden)}</Body>
            <SlideValue text={maskRupees(o.after, hidden)} color={o.worse ? colors.stretch : colors.text} />
          </View>
        );
      })}
      <Animated.View pointerEvents="none" style={[styles.shimmer, band]} />
    </View>
  );
}

export default function WhatIf() {
  const params = useLocalSearchParams<{ prepay?: string }>();
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const upsertGoal = useGoalsStore((s) => s.upsertGoal);
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const saveScenario = useScenarioStore((s) => s.save);
  const retirement = input?.goals.find((g) => g.isRetirement)?.retirement;
  const retireDefault = retirement ? (retirement.retireAge > 55 ? 55 : retirement.retireAge - 3) : 55;
  const offTrack = useMemo(() => (input ? planGoals(input).some((g) => !goalResultFast(input, g).onTrack) : false), [input]);
  const prepayLoan = input?.loans.find((l) => l.id === params.prepay);

  const [chip, setChip] = useState<Chip>(prepayLoan ? 'prepay' : 'noIncome');
  const [months, setMonths] = useState(6);
  const [year, setYear] = useState<'2008' | '2020'>('2008');
  const [retireAge, setRetireAge] = useState(retireDefault);
  const [prepay, setPrepay] = useState(Math.min(100000, prepayLoan?.balance ?? 100000));
  const [rewind, setRewind] = useState(0);
  const [sheet, setSheet] = useState<'apply' | 'save' | null>(null);
  const [applied, setApplied] = useState(false);
  const [name, setName] = useState('');

  const changes: ScenarioChanges = useMemo(() => {
    if (!input) return {};
    switch (chip) {
      case 'noIncome':
        return { noIncomeMonths: months };
      case 'replay':
        return { replay: Number(year) as 2008 | 2020 };
      case 'retire':
        return { retireAge };
      case 'fix':
        return fixChanges(input);
      case 'prepay':
        return prepayLoan ? { prepay: { loanId: prepayLoan.id, amount: prepay } } : {};
    }
  }, [chip, months, year, retireAge, prepay, prepayLoan, input]);
  const result = useMemo(() => (input ? compareScenario(input, changes) : null), [input, changes]);
  if (!input || !result) return null;

  const pick = (c: Chip) => {
    haptics.selection();
    setChip(c);
    setRewind((n) => n + 1);
  };
  const chips: { key: Chip; label: string }[] = [
    ...(prepayLoan ? [{ key: 'prepay' as Chip, label: `Prepay ${prepayLoan.name}` }] : []),
    { key: 'noIncome', label: 'No income 6 months' },
    { key: 'replay', label: 'Replay 2008' },
    { key: 'retire', label: `Retire at ${retireDefault}` },
    ...(offTrack ? [{ key: 'fix' as Chip, label: 'Fix off-track goals' }] : []),
  ];
  const sn = safetyNet(input);
  const coveredMonths = sn && input.profile.monthlyExpenses > 0 ? Math.floor(sn.current / input.profile.monthlyExpenses) : 0;
  const apply = applicableChanges(input, changes);
  const monthlyFrom = input.profile.monthly;
  const monthlyTo = monthlyFrom + apply.filter((a) => a.field === 'Monthly amount').reduce((s, a) => s + a.to - a.from, 0);
  const fixed = result.outcomes.filter((o) => !o.beforeR.onTrack && o.afterR.onTrack).map((o) => ringName(o.name));

  const doApply = async () => {
    for (const a of apply) {
      const g = input.goals.find((x) => x.id === a.goalId);
      if (!g) continue;
      if (a.field === 'Monthly amount') await upsertGoal({ ...g, monthly: a.to });
      else if (g.retirement) await upsertGoal({ ...g, retirement: { ...g.retirement, retireAge: a.to } });
    }
    if (profile && monthlyTo !== monthlyFrom) await setProfile({ ...profile, monthly: monthlyTo });
    haptics.success();
    setApplied(true);
    setTimeout(() => {
      setSheet(null);
      router.navigate('/home');
    }, duration.celebrate);
  };

  return (
    <View style={styles.fill}>
      <Screen
        background="sky"
        footer={
          <View style={styles.footer}>
            <PrimaryButton label="Apply to my plan" onPress={() => { setApplied(false); setSheet('apply'); }} testID="whatif-apply" />
            <GhostButton label="Save this scenario" color={colors.text} onPress={() => { setName(scenarioName(changes)); setSheet('save'); }} />
          </View>
        }
      >
        <View style={styles.top}>
          <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="back" size={26} />
          </PressScale>
          <PressScale onPress={() => router.push('/what-if/scenarios')} accessibilityRole="button" accessibilityLabel="Your scenarios">
            <GulluStill size={56} expression="think" aura={false} />
          </PressScale>
        </View>
        <Body color={colors.text}>Sandbox · your plan is safe</Body>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipRow}>
          {chips.map((c) => (
            <Pill key={c.key} label={c.label} selected={chip === c.key} onPress={() => pick(c.key)} />
          ))}
        </ScrollView>
        <H1 style={styles.headline} testID="whatif-headline">
          {scenarioHeadline(result.outcomes)}
        </H1>
        <Rows outcomes={result.outcomes} rewind={rewind} />
        {chip === 'noIncome' ? (
          <>
            <View style={styles.sliderHead}>
              <Body>Months without income</Body>
              <Label weight="800">{months}</Label>
            </View>
            <Slider value={months} onChange={setMonths} min={1} max={12} accessibilityLabel="Months without income" testID="whatif-months" />
            <Body style={styles.note}>
              {result.drawFromInvestments === 0
                ? `Your safety net covers the ${months} months, so no investments are sold.`
                : `Your safety net covers ${coveredMonths} month${coveredMonths === 1 ? '' : 's'}. The other ${formatINR(result.drawFromInvestments, { compact: true, hidden })} would come out of your investments, Retirement money first.`}
            </Body>
          </>
        ) : null}
        {chip === 'replay' ? (
          <>
            <SegmentedPills options={[{ value: '2008', label: '2008' }, { value: '2020', label: '2020' }]} value={year} onChange={(v) => { setYear(v); setRewind((n) => n + 1); }} />
            <Body style={styles.note}>Markets do what they did from {year} on, starting today. Your monthly amounts stay the same.</Body>
          </>
        ) : null}
        {chip === 'retire' && retirement ? (
          <>
            <View style={styles.sliderHead}>
              <Body>Stop working at</Body>
              <Label weight="800">{retireAge}</Label>
            </View>
            <Slider value={retireAge} onChange={setRetireAge} min={Math.max(input.profile.age + 1, 40)} max={70} accessibilityLabel="Stop working at" />
          </>
        ) : null}
        {chip === 'prepay' && prepayLoan ? (
          <>
            <View style={styles.sliderHead}>
              <Body>Prepay from savings</Body>
              <Label weight="800">{formatINR(prepay, { compact: true, hidden })}</Label>
            </View>
            <Slider value={prepay} onChange={setPrepay} min={50000} max={Math.max(50000, Math.floor(prepayLoan.balance / 50000) * 50000)} step={50000} accessibilityLabel="Prepay amount" />
            <Body style={styles.note}>The money comes out of your longest goal, Retirement.</Body>
          </>
        ) : null}
        {chip === 'fix' ? <Body style={styles.note}>These monthly amounts put every goal on track.</Body> : null}
      </Screen>
      <Sheet open={sheet != null} onClose={() => setSheet(null)}>
        {sheet === 'apply' ? (
          applied ? (
            <View style={styles.done}>
              <TickCircle done />
              <Label>Applied</Label>
            </View>
          ) : apply.length ? (
            <View style={styles.sheet}>
              <H1>{apply.length === 1 ? 'Apply 1 change?' : `Apply ${apply.length} changes?`}</H1>
              {apply.map((a) => (
                <View key={a.goalId + a.field} style={styles.change}>
                  <View style={styles.fill}>
                    <Label>{a.label}</Label>
                    <Caption>{a.field}</Caption>
                  </View>
                  <Body style={styles.before}>{a.field === 'Monthly amount' ? formatINR(a.from, { hidden }) : String(a.from)}</Body>
                  <Label weight="800">{a.field === 'Monthly amount' ? formatINR(a.to, { hidden }) : String(a.to)}</Label>
                </View>
              ))}
              <Body>
                {monthlyTo !== monthlyFrom ? `Your monthly total goes from ${formatINR(monthlyFrom, { hidden })} to ${formatINR(monthlyTo, { hidden })}. ` : ''}
                {fixed.length ? `${fixed.join(' and ')} ${fixed.length === 1 ? 'moves' : 'move'} to on track.` : ''}
              </Body>
              <PrimaryButton label="Apply" onPress={doApply} testID="whatif-apply-confirm" />
              <GhostButton label="Keep exploring" onPress={() => setSheet(null)} />
            </View>
          ) : (
            <View style={styles.sheet}>
              <H1>Nothing here to apply.</H1>
              <Body>Months without income and market replays happen to a plan; they are not settings. Save the scenario to come back to it.</Body>
              <GhostButton label="Keep exploring" onPress={() => setSheet(null)} />
            </View>
          )
        ) : null}
        {sheet === 'save' ? (
          <View style={styles.sheet}>
            <Label>Name this scenario</Label>
            <TextInput value={name} onChangeText={setName} style={[textStyle('body', colors.text), styles.input]} placeholderTextColor={colors.textCaption} placeholder="Sabbatical in 2029" testID="whatif-name" />
            <PrimaryButton
              label="Save"
              disabled={!name.trim()}
              onPress={async () => {
                await saveScenario({ id: `sc-${Date.now().toString(36)}`, name: name.trim(), changes, createdAt: input.today });
                haptics.success();
                setSheet(null);
                router.push('/what-if/scenarios');
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: { gap: 4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { marginTop: 12, marginHorizontal: -24, flexGrow: 0 },
  chipRow: { gap: 8, paddingHorizontal: 24 },
  headline: { marginTop: 24 },
  rows: { marginTop: 20, gap: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, minWidth: 84 },
  before: { textDecorationLine: 'line-through', color: colors.textCaption },
  after: { minWidth: 72, alignItems: 'flex-end' },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: colors.white },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  note: { marginTop: 16 },
  sheet: { gap: 12 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  done: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  input: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.glass },
});
