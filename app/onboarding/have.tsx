/**
 * 1.5 What you have (dusk). Any asset type, plus loans. Each class row has a mini bar that grows
 * to its value on enter. Adding a holding drops a coin into Gullu. A loan row shows its amount in
 * negative, sliding in from the right. Can skip. Sheet field labels are drafts (docs/progress.md).
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { SlideInRight, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { SegmentedPills } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label, textStyle } from '@/components/Text';
import type { HoldingEntry } from '@/engine/onboarding';
import type { Holding, Loan } from '@/engine/types';
import { Gullu, type GulluHandle } from '@/gullu/Gullu';
import { useReduceMotion } from '@/motion/prefs';
import { OnboardingTop } from '@/screens/onboarding/OnboardingTop';
import { isRetired, useOnboarding } from '@/state/onboarding';
import { spring, stagger } from '@/theme/motion';
import { colors } from '@/theme/tokens';

type Field = { id: string; label: string; name: string; type: Holding['type']; assetClass: Holding['assetClass']; isStock?: boolean; auto?: boolean };
type Group = { id: string; label: string; dot: string; fields: Field[] };

export const GROUPS: Group[] = [
  {
    id: 'mf',
    label: 'Mutual funds',
    dot: colors.indianEquity,
    fields: [
      { id: 'mf-in', label: 'Indian equity funds', name: 'Equity funds', type: 'mutualFund', assetClass: 'indianEquity' },
      { id: 'mf-gl', label: 'International funds', name: 'International funds', type: 'mutualFund', assetClass: 'globalEquity' },
    ],
  },
  {
    id: 'stocks',
    label: 'Stocks, India and US',
    dot: colors.globalEquity,
    fields: [
      { id: 'st-in', label: 'Indian stocks', name: 'Indian stocks', type: 'stock', assetClass: 'indianEquity', isStock: true },
      { id: 'st-us', label: 'US stocks', name: 'US stocks', type: 'stock', assetClass: 'globalEquity', isStock: true },
    ],
  },
  {
    id: 'ppf',
    label: 'PPF and EPF',
    dot: colors.debt,
    fields: [
      { id: 'ppf', label: 'PPF', name: 'PPF', type: 'ppf', assetClass: 'debt' },
      { id: 'epf', label: 'EPF', name: 'EPF', type: 'epf', assetClass: 'debt' },
      { id: 'epf-auto', label: 'Goes into EPF each month', name: 'EPF', type: 'epf', assetClass: 'debt', auto: true },
    ],
  },
  { id: 'gold', label: 'Gold and SGBs', dot: colors.gold, fields: [{ id: 'gold', label: 'Gold, gold ETFs and SGBs', name: 'Gold and SGBs', type: 'etf', assetClass: 'gold' }] },
  {
    id: 'cash',
    label: 'Cash and debt funds',
    dot: colors.cash,
    fields: [
      { id: 'cash', label: 'Savings and liquid funds', name: 'Liquid fund', type: 'cash', assetClass: 'cash' },
      { id: 'debt', label: 'Debt funds and FDs', name: 'Debt funds and FDs', type: 'mutualFund', assetClass: 'debt' },
    ],
  },
];

const OTHER_KINDS = [
  { value: 'nps', label: 'NPS', type: 'nps' as const, assetClass: 'debt' as const },
  { value: 'property', label: 'Property', type: 'property' as const, assetClass: 'other' as const },
  { value: 'crypto', label: 'Crypto', type: 'crypto' as const, assetClass: 'other' as const },
  { value: 'other', label: 'Other', type: 'other' as const, assetClass: 'other' as const },
  { value: 'loan', label: 'A loan', type: 'other' as const, assetClass: 'other' as const },
];

function MiniBar({ value, max, index, color }: { value: number; max: number; index: number; color: string }) {
  const reduce = useReduceMotion();
  const f = max > 0 ? value / max : 0;
  const w = useSharedValue(reduce ? f : 0);
  useEffect(() => {
    w.value = reduce ? f : withDelay(index * stagger.list, withSpring(f, spring.gentle));
  }, [f, index, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, a]} />
    </View>
  );
}

function GroupSheet({ group, onDone }: { group: Group; onDone: (values: Record<string, number>) => void }) {
  const holdings = useOnboarding((s) => s.holdings);
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries(group.fields.map((f) => [f.id, f.auto ? (holdings.find((h) => h.id === 'epf')?.autoMonthly ?? 0) : (holdings.find((h) => h.id === f.id)?.value ?? 0)])),
  );
  return (
    <View style={styles.sheet}>
      <Label>{group.label}</Label>
      {group.fields.map((f) => (
        <AmountField key={f.id} testID={`have-${f.id}`} label={f.label} value={vals[f.id] ?? 0} onChange={(v) => setVals({ ...vals, [f.id]: v })} />
      ))}
      <Caption>Today&apos;s value is fine. You can split it by fund later.</Caption>
      <PrimaryButton testID="have-save" label="Save" onPress={() => onDone(vals)} />
    </View>
  );
}

function OtherSheet({ onAsset, onLoan }: { onAsset: (h: HoldingEntry) => void; onLoan: (l: Loan) => void }) {
  const [kind, setKind] = useState('nps');
  const [name, setName] = useState('');
  const [value, setValue] = useState(0);
  const [rate, setRate] = useState('');
  const [emi, setEmi] = useState(0);
  const k = OTHER_KINDS.find((x) => x.value === kind)!;
  const isLoan = kind === 'loan';
  const today = useOnboarding((s) => s.today);
  return (
    <View style={styles.sheet}>
      <Label>Add something else</Label>
      <SegmentedPills testID="other-kind" value={kind} onChange={setKind} options={OTHER_KINDS.map((x) => ({ value: x.value, label: x.label }))} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={isLoan ? 'Name, like Car loan' : 'Name'}
        placeholderTextColor={colors.textCaption}
        style={[textStyle('body', colors.text), styles.name]}
        accessibilityLabel="Name"
        testID="other-name"
      />
      <AmountField testID="other-value" label={isLoan ? 'Still to pay' : 'Value today'} value={value} onChange={setValue} />
      {isLoan ? (
        <>
          <AmountField testID="other-emi" label="EMI a month" value={emi} onChange={setEmi} />
          <View style={styles.inline}>
            <Body color={colors.text}>Interest rate, % a year</Body>
            <TextInput
              value={rate}
              onChangeText={(t) => setRate(t.replace(/[^\d.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="9.5"
              placeholderTextColor={colors.textCaption}
              style={[textStyle('label', colors.text, '800'), styles.rate]}
              accessibilityLabel="Interest rate"
              testID="other-rate"
            />
          </View>
        </>
      ) : null}
      <PrimaryButton
        testID="other-save"
        label="Add"
        disabled={value <= 0}
        onPress={() => {
          if (isLoan) {
            const months = emi > 0 ? Math.ceil(value / emi) : 60;
            onLoan({ id: `loan-${Date.now()}`, name: name.trim() || 'Loan', ratePct: Number(rate) || 0, emi, balance: value, endDate: today + months });
          } else {
            onAsset({ id: `${kind}-${Date.now()}`, name: name.trim() || k.label, type: k.type, assetClass: k.assetClass, value });
          }
        }}
      />
    </View>
  );
}

export default function WhatYouHave() {
  const s = useOnboarding();
  const gullu = useRef<GulluHandle>(null);
  const [open, setOpen] = useState<string | null>(null);
  const totalOf = (g: Group) => g.fields.filter((f) => !f.auto).reduce((a, f) => a + (s.holdings.find((h) => h.id === f.id)?.value ?? 0), 0);
  const extras = s.holdings.filter((h) => !GROUPS.some((g) => g.fields.some((f) => f.id === h.id)));
  const max = Math.max(1, ...GROUPS.map(totalOf), ...extras.map((h) => h.value), ...s.loans.map((l) => l.balance));
  const total = s.holdings.reduce((a, h) => a + h.value, 0);
  const next = () => router.push('/onboarding/monthly');
  const web = Platform.OS === 'web';

  const saveGroup = (g: Group, vals: Record<string, number>) => {
    const before = total;
    let hs = s.holdings.filter((h) => !g.fields.some((f) => f.id === h.id));
    for (const f of g.fields) {
      if (f.auto) continue;
      const v = vals[f.id] ?? 0;
      if (v > 0) {
        const auto = f.id === 'epf' ? vals['epf-auto'] : undefined;
        hs = [...hs, { id: f.id, name: f.name, type: f.type, assetClass: f.assetClass, isStock: f.isStock, value: v, ...(auto ? { autoMonthly: auto } : {}) }];
      }
    }
    s.set({ holdings: hs });
    setOpen(null);
    if (hs.reduce((a, h) => a + h.value, 0) > before) gullu.current?.catchCoin();
  };

  return (
    <View style={styles.fill}>
      <Screen
        background="dusk"
        scroll
        footer={
          <>
            <PrimaryButton testID="have-next" label="Next" onPress={next} />
            <GhostButton label="Skip, I'll add later" onPress={next} />
          </>
        }
      >
        <OnboardingTop step="have" />
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Rise index={0}>
              <H1>What do you already have?</H1>
            </Rise>
          </View>
          <Gullu ref={gullu} size={64} aura={false} headroom={0.6} expression="happy" />
        </View>
        <Rise index={1}>
          <Body>Any kind counts: funds, stocks, FDs, PPF, NPS, gold, property, crypto. Loans too.</Body>
        </Rise>
        <View style={styles.list}>
          {GROUPS.map((g, i) => {
            const v = totalOf(g);
            return (
              <PressScale key={g.id} onPress={() => setOpen(g.id)} accessibilityRole="button" accessibilityLabel={g.label} testID={`have-row-${g.id}`}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: g.dot }]} />
                  <View style={styles.flex}>
                    <Body color={colors.text}>{g.label}</Body>
                    <MiniBar value={v} max={max} index={i} color={g.dot} />
                  </View>
                  {v > 0 ? <Amount value={v} compact variant="label" weight="800" /> : <Caption>Add</Caption>}
                  <Icon name="chevron" size={18} color={colors.textCaption} />
                </View>
              </PressScale>
            );
          })}
          {extras.map((h, i) => (
            <View key={h.id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.other }]} />
              <View style={styles.flex}>
                <Body color={colors.text}>{h.name}</Body>
                <MiniBar value={h.value} max={max} index={GROUPS.length + i} color={colors.other} />
              </View>
              <Amount value={h.value} compact variant="label" weight="800" />
            </View>
          ))}
          {s.loans.map((l) => (
            <Animated.View key={l.id} entering={web ? undefined : SlideInRight.springify()} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: colors.goal[5] }]} />
              <Body color={colors.text} style={styles.flex}>
                {l.name}
              </Body>
              <Amount value={-l.balance} compact variant="label" weight="800" />
            </Animated.View>
          ))}
        </View>
        <GhostButton label="+ Add something else" onPress={() => setOpen('other')} />
        {isRetired(s) ? <Caption>I&apos;ll split this into three buckets for your income.</Caption> : null}
      </Screen>
      <Sheet open={open != null} onClose={() => setOpen(null)}>
        {open === 'other' ? (
          <OtherSheet
            onAsset={(h) => {
              s.set({ holdings: [...s.holdings, h] });
              setOpen(null);
              gullu.current?.catchCoin();
            }}
            onLoan={(l) => {
              s.set({ loans: [...s.loans, l] });
              setOpen(null);
            }}
          />
        ) : open ? (
          <GroupSheet key={open} group={GROUPS.find((g) => g.id === open)!} onDone={(v) => saveGroup(GROUPS.find((g) => g.id === open)!, v)} />
        ) : null}
      </Sheet>
    </View>
  );
}


const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  barTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6, overflow: 'hidden' },
  bar: { height: 3, borderRadius: 2 },
  sheet: { gap: 10 },
  name: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  rate: { minWidth: 80, textAlign: 'right' },
});
