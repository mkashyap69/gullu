/**
 * 5.1 Net worth (night). Own minus owe, Hide amounts, and the way into mix, holdings, loans and the
 * timeline. The net worth counts up; Hide amounts masks every rupee figure; the sparkline draws in.
 */
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Amount } from '@/components/Amount';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { totalsByDate } from '@/engine/moments';
import { mixCheck, netWorth } from '@/engine/wealth';
import { formatINR } from '@/lib/formatINR';
import { Sparkline } from '@/motion-kit/Sparkline';
import { usePlanInput } from '@/plan/usePlan';
import { useHoldingsStore, useSettingsStore } from '@/state/stores';
import { colors, layout } from '@/theme/tokens';

export default function Wealth() {
  const input = usePlanInput();
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const update = useSettingsStore((s) => s.update);
  const { width } = useWindowDimensions();
  const trend = useMemo(() => totalsByDate(snapshots).map((t) => t.total), [snapshots]);
  if (!input) return null;
  const nw = netWorth(input);
  const mix = mixCheck(input);
  const classes = new Set(input.holdings.map((h) => h.assetClass)).size;
  const loan = input.loans[0];
  const loansTotal = input.loans.reduce((a, l) => a + l.balance, 0);
  const driftWord = mix.drift > 2 ? `Equity is ${mix.drift} points over target` : mix.drift < -2 ? `Equity is ${-mix.drift} points under target` : 'Close to target';
  return (
    <Screen background="night" scroll>
      <View style={styles.top}>
        <Rise index={0}>
          <H1>Wealth</H1>
        </Rise>
        <PressScale onPress={() => update({ hideAmounts: !hidden })} accessibilityRole="switch" accessibilityState={{ checked: hidden }} accessibilityLabel="Hide amounts" testID="wealth-hide">
          <Caption color={colors.textGhost}>{hidden ? 'Show amounts' : 'Hide amounts'}</Caption>
        </PressScale>
      </View>
      <Caption style={styles.label}>Net worth</Caption>
      <Amount value={nw.total} compact variant="big" animate="countUp" />
      <Body>
        You own {formatINR(nw.own, { compact: true, hidden })} and owe {formatINR(nw.owe, { compact: true, hidden })}.
      </Body>
      <View style={styles.spark}>{trend.length >= 2 ? <Sparkline values={trend} width={width - layout.screenPadding.horizontal * 2} height={90} /> : null}</View>
      <Rise index={1}>
        <Row
          title="Mix check"
          detail={driftWord}
          chevron
          onPress={() => router.push('/wealth/mix')}
          right={Math.abs(mix.drift) > 2 ? (
            <View style={styles.drift}>
              <View style={styles.amber} />
              <Caption color={colors.stretch}>Drift</Caption>
            </View>
          ) : undefined}
        />
        <Row title="Holdings" detail={`${input.holdings.length} holdings in ${classes} classes`} chevron onPress={() => router.push('/wealth/holdings')} />
        <Row
          title="Loans"
          detail={loan ? `${loan.name}, ${loan.ratePct}%${input.loans.length > 1 ? ` and ${input.loans.length - 1} more` : ''}` : 'No loans'}
          chevron
          onPress={() => router.push('/wealth/loans')}
          right={loansTotal ? <Label>{formatINR(loansTotal, { compact: true, hidden })}</Label> : undefined}
        />
        <Row title="Timeline" detail="How your money moved" chevron onPress={() => router.push('/wealth/timeline')} />
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { marginTop: 28 },
  spark: { height: 100, marginVertical: 20, justifyContent: 'center' },
  drift: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amber: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.stretch },
});
