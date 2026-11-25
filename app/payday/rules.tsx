/**
 * 4.7 Flow rules (dim). Drag to reorder where money goes first; toggle commitments. Numbers
 * re-index with a rolling animation; toggles use spring thumbs. Tap a commitment to set its yearly
 * amount and what's already paid since April (onboarding assumes nothing has been).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { RollingText } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { SegmentedPills } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { ReorderList } from '@/components/ReorderList';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label, textStyle } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { LabTop } from '@/dev/LabTop';
import { fyOf, paidThisFy, safetyNet } from '@/engine/plan';
import type { FlowRule, Holding } from '@/engine/types';
import { formatINR } from '@/lib/formatINR';
import { usePlanInput } from '@/plan/usePlan';
import { useGoalsStore, useHoldingsStore } from '@/state/stores';
import { colors } from '@/theme/tokens';

type Commitment = Extract<FlowRule, { type: 'commitment' }>;
const KIND: Record<Commitment['instrument'], { type: Holding['type']; cls: Holding['assetClass']; cap: number }> = {
  PPF: { type: 'ppf', cls: 'debt', cap: 150000 },
  NPS: { type: 'nps', cls: 'debt', cap: 50000 },
  ELSS: { type: 'mutualFund', cls: 'indianEquity', cap: 150000 },
  SSY: { type: 'bond', cls: 'debt', cap: 150000 },
  RD: { type: 'fd', cls: 'debt', cap: 120000 },
};

export default function FlowRules() {
  const input = usePlanInput();
  const saved = useGoalsStore((s) => s.flowRules);
  const setFlowRules = useGoalsStore((s) => s.setFlowRules);
  const upsertHolding = useHoldingsStore((s) => s.upsertHolding);
  const [rules, setRules] = useState<FlowRule[]>(() => [...saved].sort((a, b) => a.order - b.order));
  const [edit, setEdit] = useState<Commitment | null>(null);
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState<Commitment['instrument']>('ELSS');
  const [newYearly, setNewYearly] = useState(KIND.ELSS.cap);
  const [newName, setNewName] = useState('');
  const threshold = useMemo(() => (rules.find((r) => r.type === 'costlyDebt') as Extract<FlowRule, { type: 'costlyDebt' }> | undefined)?.thresholdPct ?? 12, [rules]);
  if (!input) return null;
  const sn = safetyNet(input);

  const describe = (r: FlowRule): { title: string; detail: string } => {
    switch (r.type) {
      case 'safetyNet':
        return { title: 'Safety net', detail: `${sn?.months ?? 6} months of expenses` };
      case 'costlyDebt':
        return { title: 'Costly debt', detail: `Loans above ${r.thresholdPct}% interest` };
      case 'commitment':
        return { title: r.instrument, detail: r.enabled ? `${formatINR(r.yearlyCap, { compact: true })} a year, spread to March` : 'Off' };
      case 'goals':
        return { title: 'Goals', detail: 'Must, then should, then nice' };
    }
  };
  const update = (r: FlowRule) => setRules(rules.map((x) => (x.id === r.id ? r : x)));
  const save = async () => {
    await setFlowRules(rules.map((r, i) => ({ ...r, order: i + 1 }) as FlowRule));
    router.back();
  };

  return (
    <View style={styles.fill}>
      <Screen
        background="dim"
        scroll
        footer={
          <>
            <PrimaryButton testID="rules-save" label="Save" onPress={save} />
          </>
        }
      >
        <LabTop icon="back" />
        <Rise index={0}>
          <H1>Where your money goes first.</H1>
          <Body>Drag to change the order. Every payday follows this.</Body>
        </Rise>
        <View style={styles.list}>
          <ReorderList
            items={rules}
            keyOf={(r) => r.id}
            onReorder={setRules}
            render={(r, i) => {
              const d = describe(r);
              const isCommitment = r.type === 'commitment';
              return (
                <PressScale onPress={isCommitment ? () => setEdit(r as Commitment) : undefined} accessibilityRole={isCommitment ? 'button' : undefined} accessibilityLabel={d.title}>
                  <View style={styles.row}>
                    <View style={styles.num}>
                      <RollingText text={String(i + 1)} variant="label" color={colors.textCaption} />
                    </View>
                    <View style={styles.flex}>
                      <Body color={colors.text}>{d.title}</Body>
                      <Caption>{d.detail}</Caption>
                    </View>
                    {isCommitment || r.type === 'costlyDebt' ? (
                      <View style={styles.toggle}>
                        <Toggle label="" value={r.enabled} onChange={(v) => update({ ...r, enabled: v } as FlowRule)} />
                      </View>
                    ) : null}
                  </View>
                </PressScale>
              );
            }}
          />
        </View>
        <GhostButton label="+ Add a commitment (ELSS, SSY, RD)" onPress={() => setAdding(true)} />
        <Caption style={styles.note}>Loans above {threshold}% interest count as costly. Must-have goals keep their full amount in a short month whatever the order.</Caption>
      </Screen>
      <Sheet open={edit != null} onClose={() => setEdit(null)}>
        {edit ? (
          <View style={styles.sheet}>
            <Label>{edit.instrument}</Label>
            <AmountField label="Each year" value={edit.yearlyCap} onChange={(v) => setEdit({ ...edit, yearlyCap: v })} testID="rules-cap" />
            <AmountField label="Paid since April" value={paidThisFy(edit, input.today)} onChange={(v) => setEdit({ ...edit, paidThisYear: v, paidFy: fyOf(input.today) })} testID="rules-paid" />
            <Caption>The rest is spread evenly over the months to 31 March.</Caption>
            <PrimaryButton
              label="Done"
              onPress={() => {
                update(edit);
                setEdit(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <View style={styles.sheet}>
          <Label>Add a commitment</Label>
          <SegmentedPills<Commitment['instrument']>
            value={newKind}
            onChange={(k) => (setNewKind(k), setNewYearly(KIND[k].cap))}
            options={(['ELSS', 'SSY', 'RD', 'NPS', 'PPF'] as const).filter((k) => !rules.some((r) => r.type === 'commitment' && r.instrument === k)).map((k) => ({ value: k, label: k }))}
          />
          <TextInput value={newName} onChangeText={setNewName} placeholder={`Name, like My ${newKind}`} placeholderTextColor={colors.textCaption} style={[textStyle('body', colors.text), styles.name]} />
          <AmountField label="Each year" value={newYearly} onChange={setNewYearly} />
          <PrimaryButton
            label="Add"
            disabled={newYearly <= 0}
            onPress={async () => {
              const k = KIND[newKind];
              const existing = input.holdings.find((h) => h.type === k.type && (newKind !== 'ELSS' || h.name.toLowerCase().includes('elss')));
              const holding: Holding = existing ?? { id: `${newKind.toLowerCase()}-${Date.now().toString(36)}`, name: newName.trim() || newKind, type: k.type, assetClass: k.cls, isStock: false, planned: true, value: 0, valueAt: input.today, createdAt: input.today };
              if (!existing) await upsertHolding(holding);
              const goalsIdx = rules.findIndex((r) => r.type === 'goals');
              const rule: Commitment = { id: `r-${newKind.toLowerCase()}-${Date.now().toString(36)}`, order: 0, enabled: true, type: 'commitment', instrument: newKind, holdingId: holding.id, yearlyCap: newYearly, paidThisYear: 0, paidFy: fyOf(input.today) };
              const next = [...rules];
              next.splice(goalsIdx < 0 ? next.length : goalsIdx, 0, rule);
              setRules(next);
              setAdding(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  num: { width: 24, alignItems: 'center' },
  flex: { flex: 1 },
  toggle: { width: 60 },
  note: { marginTop: 12 },
  sheet: { gap: 12 },
  name: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.glass },
});
