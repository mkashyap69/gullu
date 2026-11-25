/**
 * The Payday tab (Income for retirees, Phase 8). When money has landed (or a check-in is under way)
 * it's the payday moment (4.2). Between paydays it shows what's planned (drafted copy): the next
 * date, the split, flow rules, and for variable income a way to log money in.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { GlassCard, Row } from '@/components/Surfaces';
import { Body, Caption, H1 } from '@/components/Text';
import { monthName } from '@/engine/habits';
import { paydayPlan } from '@/engine/payday';
import { usePaydayDue } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { IncomeTab } from '@/screens/retiree/IncomeTab';
import { PaydayCatch } from '@/screens/payday/PaydayCatch';
import { lineColor, lineLabel } from '@/screens/payday/lineMeta';
import { requiredMap } from '@/state/payday';
import { usePaydayStore, useProfileStore } from '@/state/stores';

const ordinal = (d: number) => (d === 0 ? 'the last day' : `${d}${d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th'}`);

export default function PaydayTab() {
  const retired = useProfileStore((s) => s.profile?.work === 'retired');
  const due = usePaydayDue();
  if (retired) return <IncomeTab />;
  if (due) return <PaydayCatch amount={due} />;
  return <Between />;
}

function Between() {
  const input = usePlanInput();
  const paydays = usePaydayStore((s) => s.paydays);
  const plan = useMemo(() => (input ? paydayPlan(input, input.profile.monthly, requiredMap(input)) : null), [input]);
  if (!input || !plan) return null;
  const placedNow = paydays.find((p) => p.month === input.today && p.placedAt != null);
  const varies = input.profile.incomeVaries || input.profile.paydayDay === -1;
  const next = placedNow ? input.today + 1 : input.today;
  const nextLabel = `${ordinal(input.profile.paydayDay)} ${monthName(next).slice(0, 3)}`;
  return (
    <Screen
      background="ember"
      scroll
      footer={
        varies ? (
          <PrimaryButton testID="payday-log" label="Log money in" onPress={() => router.push({ pathname: '/payday/amount', params: { log: '1' } })} />
        ) : placedNow ? (
          <PrimaryButton label={`See ${monthName(input.today)}'s receipt`} onPress={() => router.push('/payday/receipt')} />
        ) : (
          <GhostButton label="It landed early" onPress={() => router.push('/payday/amount')} />
        )
      }
    >
      <Rise index={0}>
        <H1>{varies ? 'Money in?' : placedNow ? `${monthName(input.today)} placed.` : `Next payday: ${nextLabel}.`}</H1>
        <Body>
          {varies
            ? "When money lands, tell me how much and I'll give every rupee a job."
            : placedNow
              ? `Next payday is the ${nextLabel}. Here's where it will go.`
              : 'Here’s where it will go when it lands.'}
        </Body>
      </Rise>
      <Rise index={1}>
        <GlassCard style={styles.card}>
          {plan.lines.map((l) => (
            <Row key={l.id} title={lineLabel(l)} dot={lineColor(l, input)} right={<Amount value={l.amount} variant="label" weight="800" />} />
          ))}
          <View style={styles.total}>
            <Caption>Each month</Caption>
            <Amount value={plan.usual} variant="label" weight="800" />
          </View>
        </GlassCard>
      </Rise>
      <Rise index={2}>
        <GlassCard style={styles.card}>
          <Row title="Where your money goes first" detail="Flow rules" chevron onPress={() => router.push('/payday/rules')} />
        </GlassCard>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, paddingVertical: 4 },
  total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
});
