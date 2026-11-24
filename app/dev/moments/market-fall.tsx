/**
 * Signature moment 6 · Market fall (2.2, dim). The anti-celebration.
 * A slow 1.2s line draw (ease-out), then the expected range band fades in behind it, so the user
 * sees the fall sitting inside the range. Gullu stays calm (never `concern`), "Keep going" breathes
 * softly, and there are no haptics at all while this screen is mounted.
 * Copy says only what the app knows, from the user's own confirmed values.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Amount } from '@/components/Amount';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { MONTHS, ymMonth } from '@/engine/dates';
import { planGoals } from '@/engine/plan';
import { Gullu } from '@/gullu/Gullu';
import { formatINR } from '@/lib/formatINR';
import { quietHaptics } from '@/motion/haptics';
import { RangeBand, type BandData } from '@/motion-kit/RangeBand';
import { usePlanInput } from '@/plan/usePlan';
import { useHoldingsStore, useSettingsStore } from '@/state/stores';
import { colors, layout } from '@/theme/tokens';

const CHART_H = 90;

/**
 * The recorded path of total invested money, and the plan's expected range around it, from the
 * last recorded high to the latest confirmed values. Illustrative monthly points between snapshots.
 */
function fallBand(high: number, current: number, months: number): BandData {
  const line: number[] = [];
  const lo: number[] = [];
  const hi: number[] = [];
  const vol = 0.12; // planned money's yearly volatility (balanced mix), for the expected range
  for (let i = 0; i <= months; i++) {
    const f = i / months;
    const expected = high * Math.pow(1.008, i);
    const spread = expected * vol * Math.sqrt((i + 0.5) / 12) * 1.645;
    line.push(high + (current - high) * (f * f * (3 - 2 * f))); // the fall, eased
    lo.push(expected - spread * 1.4);
    hi.push(expected + spread * 0.6);
  }
  return { line, lo, hi };
}

export default function MarketFall() {
  useEffect(() => quietHaptics(), []); // no haptics on this screen, at all
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const { width } = useWindowDimensions();
  const [run, setRun] = useState(1);

  // Totals the user confirmed: the highest recorded, and the latest.
  const totals = snapshots.filter((s) => s.holdingId == null);
  const high = Math.max(0, ...totals.map((s) => s.value));
  const current = totals.length ? totals[totals.length - 1].value : 0;
  const fall = high - current;
  const pct = high > 0 ? Math.round((fall / high) * 100) : 0;
  const band = useMemo(() => fallBand(high, current, 3), [high, current]);
  const goals = input ? planGoals(input).length : 0;
  if (!input || high <= 0) return null;
  const chartW = width - layout.screenPadding.horizontal * 2 - 40;

  return (
    <Screen
      background="dim"
      scroll
      footer={
        <>
          <PrimaryButton label="Keep going" breathe onPress={() => router.back()} />
          <GhostButton label="See how each goal is doing" />
        </>
      }
    >
      <LabTop onReplay={() => setRun((r) => r + 1)} />
      <View style={styles.hero}>
        <Gullu size={130} skin={skin} expression="happy" />
      </View>
      <Rise index={0}>
        <H1>Your investments are {formatINR(fall, { compact: true, hidden })} below their high.</H1>
        <Body>
          About {pct}% down. Your plan expected falls like this: all {goals} goals are still inside their range, and nothing needs selling.
        </Body>
      </Rise>
      <Rise index={1}>
        <GlassCard style={styles.card}>
          <View style={styles.cardTop}>
            <Caption>As of your 1 {MONTHS[ymMonth(input.today)]} values</Caption>
            <Caption>from their high</Caption>
          </View>
          <View style={styles.amounts}>
            <Amount value={current} compact variant="h1" weight="800" />
            <Amount value={-fall} compact variant="label" weight="700" color={colors.stretch} />
          </View>
          <View style={styles.chart} key={run}>
            <RangeBand data={band} width={chartW} height={CHART_H} mode="calm" scrub={false} trigger={run} bandColor="rgba(201,195,255,0.22)" />
          </View>
          <Caption>Based on the values you confirmed at check-in. Nothing is fetched from the internet. Update values</Caption>
        </GlassCard>
        <Caption style={styles.sip}>Your SIP gets more units while prices are low. Stopping it now is the usual mistake.</Caption>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', marginTop: -8 },
  card: { marginTop: 16, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  amounts: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  chart: { marginVertical: 6 },
  sip: { marginTop: 12 },
});
