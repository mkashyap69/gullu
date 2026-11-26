/**
 * 3.3 Edit goal (violet). Add or edit a goal: template, amount in today's rupees, date, priority.
 * Template chips scroll with snap. Changing the date animates the equity-cap note when the horizon
 * crosses a cap band. Amount digits roll. Params: `id` to edit, `rollFrom` to roll a reached goal's
 * money into a new one (3.5). Retirement and the safety net get their own fields (drafted copy).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { Pill, SegmentedPills } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { ScrubValue } from '@/components/ScrubValue';
import { Slider } from '@/components/Slider';
import { Body, Caption, Label, textStyle } from '@/components/Text';
import { equityCap, PROFILE_MIX } from '@/engine/core';
import { MONTHS, ymMonth, ymYear } from '@/engine/dates';
import { TEMPLATES, type TemplateId } from '@/engine/onboarding';
import { currentAge, effectiveRisk } from '@/engine/plan';
import type { Goal, Priority } from '@/engine/types';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useHoldingsStore } from '@/state/stores';
import { duration, spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const CHIPS: { id: TemplateId; label: string; goalTemplate: Goal['template'] }[] = [
  { id: 'travel', label: 'Travel', goalTemplate: 'travel' },
  { id: 'home', label: 'Home', goalTemplate: 'home' },
  { id: 'car', label: 'Car', goalTemplate: 'custom' },
  { id: 'education', label: 'Education', goalTemplate: 'education' },
  { id: 'wedding', label: 'Wedding', goalTemplate: 'custom' },
  { id: 'custom', label: 'Custom', goalTemplate: 'custom' },
];
const PROFILE_NAME = { safetyFirst: 'Safety-first', cautious: 'Cautious', balanced: 'Balanced', growth: 'Growth', aggressive: 'Aggressive' } as const;
const MAX_MONTHS = 40 * 12;

function capNote(years: number, profileEquity: number, profileName: string): string {
  const cap = Math.round(equityCap(years, profileEquity) * 100);
  if (years < 3) return `Under 3 years away, so at most ${cap}% goes into equity.`; // verbatim (3.3)
  if (years < 5) return `3 to 5 years away, so at most ${cap}% goes into equity.`;
  if (years < 7) return `5 to 7 years away, so at most ${cap}% goes into equity.`;
  return `7 or more years away, so it follows your ${profileName} mix.`;
}
const band = (years: number) => (years < 3 ? 0 : years < 5 ? 1 : years < 7 ? 2 : 3);

export default function EditGoal() {
  const { id, rollFrom } = useLocalSearchParams<{ id?: string; rollFrom?: string }>();
  const reduce = useReduceMotion();
  const input = usePlanInput();
  const upsertGoal = useGoalsStore((s) => s.upsertGoal);
  const removeGoal = useGoalsStore((s) => s.removeGoal);
  const holdings = useHoldingsStore();
  const existing = input?.goals.find((g) => g.id === id);
  const rolled = input?.goals.find((g) => g.id === rollFrom);
  const today = input?.today ?? 0;
  const ctx = useMemo(
    () => ({ today, age: input?.profile.age ?? 30, work: input?.profile.work ?? 'salaried', monthlyExpenses: input?.profile.monthlyExpenses ?? 0, retireAge: 58 }) as const,
    [today, input],
  );

  const initialChip: TemplateId = existing
    ? existing.template === 'custom'
      ? 'custom'
      : ((CHIPS.find((c) => c.goalTemplate === existing.template)?.id ?? 'custom') as TemplateId)
    : 'travel';
  const [chip, setChip] = useState<TemplateId>(initialChip);
  const [name, setName] = useState(existing?.name ?? (rolled ? `After ${rolled.name}` : TEMPLATES.travel.name));
  const [target, setTarget] = useState(existing?.targetToday ?? TEMPLATES.travel.target(ctx));
  const [months, setMonths] = useState(existing ? Math.max(3, existing.date - today) : TEMPLATES.travel.inMonths(ctx));
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? TEMPLATES.travel.priority);
  const [retireAge, setRetireAge] = useState(existing?.retirement?.retireAge ?? 58);
  const [spend, setSpend] = useState(existing?.retirement?.targetMonthly ?? input?.profile.monthlyExpenses ?? 0);
  const [safetyMonths, setSafetyMonths] = useState(existing?.safetyMonths ?? 6);
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!input) return null;

  const isRetirement = !!existing?.isRetirement;
  const isSafety = !!existing?.isSafetyNet;
  const risk = effectiveRisk(input.profile);
  const years = months / 12;
  const date = today + months;
  const t = TEMPLATES[chip];
  const inflation = existing?.inflationPct ?? t.inflationPct;
  const nominal = target * Math.pow(1 + inflation / 100, years);
  const age = currentAge(input.profile, today);

  const pickChip = (c: TemplateId) => {
    setChip(c);
    if (existing) return;
    const tt = TEMPLATES[c];
    setName(c === 'custom' ? 'My goal' : tt.name);
    setTarget(tt.target(ctx));
    setMonths(tt.inMonths(ctx));
    setPriority(tt.priority);
  };

  const save = async () => {
    let goal: Goal;
    if (existing) {
      goal = isRetirement
        ? { ...existing, retirement: { ...existing.retirement!, retireAge, targetMonthly: spend }, date: input.profile.ageAt + (retireAge - input.profile.age) * 12 }
        : isSafety
          ? { ...existing, safetyMonths, targetToday: input.profile.monthlyExpenses * safetyMonths }
          : { ...existing, name: name.trim() || existing.name, targetToday: target, date, priority };
    } else {
      goal = {
        id: `goal-${Date.now().toString(36)}`,
        name: name.trim() || t.name,
        template: CHIPS.find((c) => c.id === chip)!.goalTemplate,
        targetToday: target,
        inflationPct: t.inflationPct,
        date,
        priority,
        monthly: 0,
        isSafetyNet: false,
        isRetirement: false,
        status: 'active',
        createdAt: today,
      };
    }
    await upsertGoal(goal);
    if (rolled) {
      // Roll the reached goal's money into this one: its holding shares move over.
      for (const hg of input.holdingGoals.filter((x) => x.goalId === rolled.id)) {
        const others = input.holdingGoals.filter((x) => x.holdingId === hg.holdingId && x.goalId !== rolled.id);
        await holdings.setSplit(hg.holdingId, [...others, { ...hg, goalId: goal.id }]);
      }
      await upsertGoal({ ...rolled, status: 'reached', monthly: 0 });
    }
    haptics.light();
    if (existing) router.back();
    else router.replace({ pathname: '/goal/[id]', params: { id: goal.id } });
  };

  const top = (
    <View style={styles.top}>
      <PressScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
        <Icon name="back" size={26} />
      </PressScale>
      <PressScale onPress={save} accessibilityRole="button" accessibilityLabel="Save" testID="edit-save-top">
        <Label>Save</Label>
      </PressScale>
    </View>
  );

  return (
    <Screen background="violet" scroll footer={<PrimaryButton testID="edit-save" label="Save goal" onPress={save} />}>
      {top}
      {!isRetirement && !isSafety ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={96} decelerationRate="fast" contentContainerStyle={styles.chips}>
          {CHIPS.map((c) => (
            <Pill key={c.id} label={c.label} selected={c.id === chip} onPress={() => (haptics.selection(), pickChip(c.id))} />
          ))}
        </ScrollView>
      ) : null}
      <TextInput
        value={isRetirement ? 'Retirement' : isSafety ? 'Safety net' : name}
        onChangeText={setName}
        editable={!isRetirement && !isSafety}
        style={[textStyle('h1'), styles.name]}
        accessibilityLabel="Goal name"
        testID="edit-name"
        maxFontSizeMultiplier={1.3}
      />
      {isRetirement ? (
        <>
          <View style={styles.row}>
            <Body color={colors.text}>Stop working at</Body>
            <ScrubValue typeable accessibilityLabel="Retirement age" value={retireAge} onChange={setRetireAge} min={Math.max(age + 1, 40)} max={75} format={String} testID="edit-retire-age" />
          </View>
          <AmountField label="Spending a month, in today's rupees" value={spend} onChange={setSpend} testID="edit-spend" />
          <Caption>I&apos;ll plan for it to last until {existing?.retirement?.untilAge ?? 85}.</Caption>
        </>
      ) : isSafety ? (
        <>
          <View style={styles.row}>
            <Body color={colors.text}>Months of spending</Body>
            <ScrubValue typeable accessibilityLabel="Months of spending" value={safetyMonths} onChange={setSafetyMonths} min={3} max={12} format={String} />
          </View>
          <Caption>That&apos;s {formatINR(input.profile.monthlyExpenses * safetyMonths)} in cash or liquid funds, ready any time.</Caption>
        </>
      ) : (
        <>
          <ScrubValue
            typeable
            variant="big"
            accessibilityLabel="Amount in today's rupees"
            value={target}
            onChange={setTarget}
            min={10000}
            max={100000000}
            step={10000}
            pxPerStep={5}
            tickEvery={10}
            format={(v) => formatINR(v)}
            testID="edit-amount"
          />
          <Caption>
            In today&apos;s rupees. About {formatINR(nominal, { compact: true })} by then, at {inflation}% inflation.
          </Caption>
          <View style={[styles.row, styles.when]}>
            <Body color={colors.text}>When</Body>
            <Label>
              {MONTHS[ymMonth(date)]} {ymYear(date)}
            </Label>
          </View>
          <Slider testID="edit-when" accessibilityLabel="When" value={months} onChange={setMonths} min={3} max={MAX_MONTHS} />
          <Caption style={styles.label}>How much does it matter?</Caption>
          <SegmentedPills<Priority>
            testID="edit-priority"
            value={priority}
            onChange={setPriority}
            options={[
              { value: 'must', label: 'Must' },
              { value: 'should', label: 'Should' },
              { value: 'nice', label: 'Nice to have' },
            ]}
          />
          <View style={styles.note}>
            <Animated.View key={band(years)} entering={reduce ? FadeIn.duration(duration.fast) : ZoomIn.springify().damping(spring.snappy.damping).stiffness(spring.snappy.stiffness)} exiting={FadeOut.duration(duration.fast)}>
              <Caption>{capNote(years, PROFILE_MIX[risk][0], PROFILE_NAME[risk])}</Caption>
            </Animated.View>
          </View>
          {existing ? (
            confirmRemove ? (
              <Animated.View entering={FadeIn.duration(duration.fast)}>
                <GhostButton
                  label="Remove it for good"
                  color={colors.short}
                  onPress={async () => {
                    haptics.warning();
                    await removeGoal(existing.id);
                    router.dismissTo('/goals');
                  }}
                />
              </Animated.View>
            ) : (
              <GhostButton label="Remove this goal" onPress={() => setConfirmRemove(true)} />
            )
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 12 },
  chips: { gap: 8, paddingRight: 24 },
  name: { marginTop: 24, padding: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56, marginTop: 8 },
  when: { marginTop: 20 },
  label: { marginTop: 24, marginBottom: 10 },
  note: { marginTop: 18, minHeight: 44 },
});
