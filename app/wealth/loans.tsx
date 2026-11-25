/**
 * 5.4 Loans (night). Prepay or invest, side by side: "for sure" is a solid bar and "likely" a fuzzy
 * band, animating together so the uncertainty is visible. Add, edit or remove loans.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Pill } from '@/components/Pill';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { GlassCard } from '@/components/Surfaces';
import { Body, Caption, H1, Label, textStyle } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { labelYM } from '@/engine/dates';
import type { Loan } from '@/engine/types';
import { emisLeft, prepayOrInvest } from '@/engine/wealth';
import { formatINR } from '@/lib/formatINR';
import { haptics } from '@/motion/haptics';
import { useAmbient, useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useHoldingsStore, useSettingsStore } from '@/state/stores';
import { duration, spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

function Bars({ sure, likely }: { sure: number; likely: number }) {
  const reduce = useReduceMotion();
  const ambient = useAmbient();
  const max = Math.max(sure, likely * 1.3, 1);
  const a = useSharedValue(reduce ? 1 : 0);
  const fuzz = useSharedValue(0);
  useEffect(() => {
    if (!reduce) a.value = withDelay(duration.base, withSpring(1, spring.gentle));
    if (ambient) fuzz.value = withRepeat(withSequence(withTiming(1, { duration: duration.celebrate }), withTiming(0, { duration: duration.celebrate })), -1, false);
  }, [reduce, ambient, a, fuzz]);
  const solid = useAnimatedStyle(() => ({ width: `${(sure / max) * 100 * a.value}%` }));
  const band = useAnimatedStyle(() => ({ width: `${((likely * (1.3 - 0.7)) / max) * 100 * a.value}%`, left: `${((likely * 0.7) / max) * 100 * a.value}%`, opacity: 0.35 + 0.2 * fuzz.value }));
  const mid = useAnimatedStyle(() => ({ left: `${(likely / max) * 100 * a.value}%` }));
  return (
    <View style={styles.bars}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.solid, solid]} />
      </View>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.band, band]} />
        <Animated.View style={[styles.mid, mid]} />
      </View>
    </View>
  );
}

function LoanSheet({ loan, today, onDone }: { loan?: Loan; today: number; onDone: () => void }) {
  const upsert = useHoldingsStore((s) => s.upsertLoan);
  const [name, setName] = useState(loan?.name ?? '');
  const [balance, setBalance] = useState(loan?.balance ?? 0);
  const [emi, setEmi] = useState(loan?.emi ?? 0);
  const [rate, setRate] = useState(loan ? String(loan.ratePct) : '');
  return (
    <View style={styles.sheet}>
      <Label>{loan ? 'Edit loan' : 'Add a loan'}</Label>
      <TextInput value={name} onChangeText={setName} placeholder="Name, like Car loan" placeholderTextColor={colors.textCaption} style={[textStyle('body', colors.text), styles.name]} />
      <AmountField label="Still to pay" value={balance} onChange={setBalance} />
      <AmountField label="EMI a month" value={emi} onChange={setEmi} />
      <View style={styles.inline}>
        <Body color={colors.text}>Interest rate, % a year</Body>
        <TextInput value={rate} onChangeText={(t) => setRate(t.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="9.5" placeholderTextColor={colors.textCaption} style={[textStyle('label', colors.text, '800'), styles.rate]} />
      </View>
      <PrimaryButton
        label="Save"
        disabled={!name.trim() || balance <= 0}
        onPress={async () => {
          const l: Loan = { id: loan?.id ?? `loan-${Date.now().toString(36)}`, name: name.trim(), balance, emi, ratePct: Number(rate) || 0, endDate: loan?.endDate ?? today + (emi > 0 ? emisLeft({ balance, emi, ratePct: Number(rate) || 0 }) : 60) };
          await upsert(l);
          onDone();
        }}
      />
    </View>
  );
}

export default function Loans() {
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const rules = useGoalsStore((s) => s.flowRules);
  const removeLoan = useHoldingsStore((s) => s.removeLoan);
  const [i, setI] = useState(0);
  const [sheet, setSheet] = useState<'add' | 'edit' | null>(null);
  if (!input) return null;
  const loan = input.loans[Math.min(i, input.loans.length - 1)];
  const r = rules.find((x) => x.type === 'costlyDebt');
  const threshold = r && r.type === 'costlyDebt' ? r.thresholdPct : 12;
  if (!loan) {
    return (
      <View style={styles.fill}>
        <Screen background="night" footer={<PrimaryButton label="Add a loan" onPress={() => setSheet('add')} />}>
          <LabTop icon="back" />
          <H1>No loans.</H1>
          <Body>Add one if you have a home, car, education or personal loan, so the plan can weigh paying it off against investing.</Body>
        </Screen>
        <Sheet open={sheet != null} onClose={() => setSheet(null)}>
          {sheet ? <LoanSheet today={input.today} onDone={() => setSheet(null)} /> : null}
        </Sheet>
      </View>
    );
  }
  const n = emisLeft(loan, input.today);
  const p = prepayOrInvest(input, loan);
  const costly = loan.ratePct > threshold;
  return (
    <View style={styles.fill}>
      <Screen background="night" scroll footer={<PrimaryButton label="Try it in What if" onPress={() => router.push({ pathname: '/what-if', params: { prepay: loan.id } })} />}>
        <LabTop icon="back" />
        {input.loans.length > 1 ? (
          <View style={styles.pills}>
            {input.loans.map((l, k) => (
              <Pill key={l.id} label={l.name} selected={k === i} onPress={() => setI(k)} />
            ))}
          </View>
        ) : null}
        <Rise index={0}>
          <Caption>
            {loan.name} · {loan.ratePct}% · EMI {formatINR(loan.emi, { hidden })}
          </Caption>
          <Amount value={loan.balance} compact variant="big" />
          <Body>
            {n} EMIs left, ending {labelYM(input.today + n)}.
          </Body>
        </Rise>
        <H1 style={styles.q}>Prepay it, or invest?</H1>
        <View style={styles.cards}>
          <GlassCard style={styles.card}>
            <Caption>Prepay ₹1 L now</Caption>
            <Label>Save</Label>
            <Amount value={p.saved} variant="h1" weight="800" style={styles.cardAmount} />
            <Caption>in interest, for sure</Caption>
          </GlassCard>
          <GlassCard style={styles.card}>
            <Caption>Invest ₹1 L instead</Caption>
            <Label>Likely</Label>
            <Amount value={p.likely} variant="h1" weight="800" style={styles.cardAmount} />
            <Caption>more, but not certain</Caption>
          </GlassCard>
        </View>
        <Bars sure={p.saved} likely={p.likely} />
        <Caption style={styles.note}>
          {costly
            ? `At ${loan.ratePct}%, your loan is above your ${threshold}% costly-debt line, so the plan prepays it first. Your call.`
            : `At ${loan.ratePct}%, your loan is below your ${threshold}% costly-debt line, so the plan doesn't prepay it. Your call.`}
        </Caption>
        <GhostButton label="Edit this loan" onPress={() => setSheet('edit')} />
        <GhostButton label="+ Add a loan" onPress={() => setSheet('add')} />
        <GhostButton
          label="It's paid off"
          onPress={async () => {
            haptics.success();
            await removeLoan(loan.id);
            setI(0);
          }}
        />
      </Screen>
      <Sheet open={sheet != null} onClose={() => setSheet(null)}>
        {sheet ? <LoanSheet loan={sheet === 'edit' ? loan : undefined} today={input.today} onDone={() => setSheet(null)} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pills: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  q: { marginTop: 28 },
  cards: { flexDirection: 'row', gap: 12, marginTop: 16 },
  card: { flex: 1, gap: 2 },
  cardAmount: { fontSize: 26, lineHeight: 32 },
  bars: { gap: 10, marginTop: 16 },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: 'hidden' },
  solid: { height: 10, borderRadius: 5, backgroundColor: colors.white },
  band: { position: 'absolute', top: 0, height: 10, borderRadius: 5, backgroundColor: colors.white },
  mid: { position: 'absolute', top: 0, width: 2, height: 10, backgroundColor: colors.white },
  note: { marginTop: 16 },
  sheet: { gap: 12 },
  name: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.glass },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  rate: { minWidth: 80, textAlign: 'right' },
});
