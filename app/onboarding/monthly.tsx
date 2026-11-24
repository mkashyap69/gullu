/**
 * 1.6 Monthly (dusk). The amount is a draggable dial: digits roll like an odometer while dragging,
 * with a haptic tick every ₹1,000 (tap it to type instead). Toggling "My income varies" morphs the
 * payday copy. Retirees: how much they need each month, and their pension (drafted copy).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AmountField } from '@/components/AmountField';
import { PrimaryButton } from '@/components/Buttons';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { ScrubValue } from '@/components/ScrubValue';
import { Sheet } from '@/components/Sheet';
import { Slider } from '@/components/Slider';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { formatINR } from '@/lib/formatINR';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { finishOnboarding, hasPlannedHoldings, isRetired, useOnboarding } from '@/state/onboarding';
import { duration } from '@/theme/motion';


export default function Monthly() {
  const s = useOnboarding();
  const retired = isRetired(s);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(s.monthly);
  const [busy, setBusy] = useState(false);
  const ready = retired ? s.needMonthly > 0 : s.monthly > 0;

  const go = async () => {
    // Existing money to share out: suggest the split first (owner direction, 24 Nov 2026).
    if (!retired && hasPlannedHoldings(s)) {
      router.push('/onboarding/split');
      return;
    }
    setBusy(true);
    try {
      await finishOnboarding();
      router.replace('/onboarding/answer');
    } finally {
      setBusy(false);
    }
  };

  const footer = <PrimaryButton testID="monthly-next" label="Show me the plan" disabled={!ready} state={busy ? 'loading' : 'idle'} onPress={go} />;

  if (retired) {
    return (
      <Screen background="dusk" scroll footer={footer}>
        <OnboardingTop step="monthly" />
        <Rise index={0}>
          <H1>How much do you need each month?</H1>
          <Body>In today&apos;s rupees. I&apos;ll plan it to rise with prices.</Body>
        </Rise>
        <View style={styles.fields}>
          <AmountField testID="monthly-need" label="Spending a month" value={s.needMonthly} onChange={(needMonthly) => s.set({ needMonthly })} />
          <AmountField testID="monthly-pension" label="Pension and other income" value={s.pensionMonthly} onChange={(pensionMonthly) => s.set({ pensionMonthly })} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <Screen background="dusk" scroll footer={footer}>
        <OnboardingTop step="monthly" />
        <Rise index={0}>
          <H1>How much can you invest each month?</H1>
        </Rise>
        <PressScale onPress={() => (setDraft(s.monthly), setTyping(true))} accessibilityHint="Tap to type an amount" testID="monthly-type">
          <ScrubValue
            testID="monthly-amount"
            accessibilityLabel="Monthly amount"
            variant="big"
            value={s.monthly}
            onChange={(monthly) => s.set({ monthly })}
            min={500}
            max={1000000}
            step={500}
            pxPerStep={6}
            tickEvery={2}
            format={(v) => formatINR(v, { hidden: false })}
            style={styles.amount}
          />
        </PressScale>
        <View style={styles.raiseRow}>
          <Body>Raise it every year by</Body>
          <Label>{s.raisePct}%</Label>
        </View>
        <Slider testID="monthly-raise" accessibilityLabel="Yearly raise" value={s.raisePct} onChange={(raisePct) => s.set({ raisePct })} min={0} max={20} />
        <Caption>Most salaries rise each year. Rising with them gets you there sooner.</Caption>
        <View style={styles.toggle}>
          <Toggle label="My income varies" value={s.incomeVaries} onChange={(incomeVaries) => s.set({ incomeVaries, payday: incomeVaries ? -1 : s.payday === -1 ? 1 : s.payday })} />
          <Animated.View key={s.incomeVaries ? 'on' : 'off'} entering={FadeIn.duration(duration.base)} exiting={FadeOut.duration(duration.fast)}>
            <Caption>
              {s.incomeVaries ? 'Payday now follows money in. Tell me when it lands and I’ll split it.' : "Turn this on if you're paid unevenly. Payday then follows money in, not a date."}
            </Caption>
          </Animated.View>
        </View>
      </Screen>
      <Sheet open={typing} onClose={() => setTyping(false)}>
        <View style={styles.sheet}>
          <AmountField testID="monthly-typed" label="Each month" value={draft} onChange={setDraft} />
          <PrimaryButton
            testID="monthly-typed-save"
            label="Done"
            disabled={draft <= 0}
            onPress={() => {
              s.set({ monthly: draft });
              setTyping(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  amount: { marginTop: 28, marginBottom: 12 },
  raiseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  toggle: { marginTop: 28, gap: 4 },
  fields: { marginTop: 24 },
  sheet: { gap: 12 },
});

