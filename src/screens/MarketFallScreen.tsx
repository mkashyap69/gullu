/**
 * Signature moment 6 · Market fall (2.2, dim). The anti-celebration.
 * A slow 1.2s line draw (ease-out), then the expected range band fades in behind it, so the user
 * sees the fall sitting inside the range. Gullu stays calm (never `concern`), "Keep going" breathes
 * softly, and there are no haptics at all while this screen is mounted.
 * Copy says only what the app knows, from the user's own confirmed values. Shown once per high
 * (src/engine/moments.ts); the Motion lab version can replay and records nothing.
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { Amount } from '../components/Amount';
import { GhostButton, PrimaryButton } from '../components/Buttons';
import { Rise } from '../components/Rise';
import { Screen } from '../components/Screen';
import { GlassCard } from '../components/Surfaces';
import { Body, Caption, H1 } from '../components/Text';
import { LabTop } from '../dev/LabTop';
import { useHabitSkin } from '../dev/useHabitSkin';
import { MONTHS, ymMonth } from '../engine/dates';
import { expectedBadYearDrop, marketFall } from '../engine/moments';
import { PROFILE_MIX } from '../engine/core';
import { effectiveRisk, planGoals } from '../engine/plan';
import { Gullu } from '../gullu/Gullu';
import { formatINR } from '../lib/formatINR';
import { quietHaptics } from '../motion/haptics';
import { RangeBand, type BandData } from '../motion-kit/RangeBand';
import { usePlanInput } from '../plan/usePlan';
import { useHabitsStore, useHoldingsStore, useSettingsStore } from '../state/stores';
import { colors, layout } from '../theme/tokens';

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

export function MarketFallScreen({ replayable = false }: { replayable?: boolean }) {
  useEffect(() => quietHaptics(), []); // no haptics on this screen, at all
  const input = usePlanInput();
  const skin = useHabitSkin();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const snapshots = useHoldingsStore((s) => s.snapshots);
  const { width } = useWindowDimensions();
  const [run, setRun] = useState(1);

  const add = useHabitsStore((s) => s.add);
  const moment = useMemo(() => (input ? marketFall(snapshots, effectiveRisk(input.profile), new Set()) : null), [input, snapshots]);
  const high = moment?.high ?? 0;
  const current = moment?.current ?? 0;
  const fall = moment?.drop ?? 0;
  const pct = Math.round((moment?.pct ?? 0) * 100);
  const band = useMemo(() => fallBand(high, current, 3), [high, current]);
  // Shown once per high: record it as soon as the user sees it.
  useEffect(() => {
    if (!replayable && moment && input) add({ kind: 'moment', data: { key: moment.key }, at: input.today }).catch(() => undefined);
  }, [replayable, moment?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const goals = input ? planGoals(input).length : 0;
  // "Inside their range": the fall fits a bad year for this profile (src/engine/moments.ts).
  const insideRange = input ? (moment?.pct ?? 0) <= expectedBadYearDrop(PROFILE_MIX[effectiveRisk(input.profile)][0], input.assumptions.volatilityPct.indianEquity) : true;
  if (!input || !moment) return null;
  const chartW = width - layout.screenPadding.horizontal * 2 - 40;

  return (
    <Screen
      background="dim"
      scroll
      footer={
        <>
          <PrimaryButton testID="fall-keep-going" label="Keep going" breathe onPress={() => router.back()} />
          <GhostButton label="See how each goal is doing" onPress={() => (replayable ? router.back() : router.replace('/goals'))} />
        </>
      }
    >
      <LabTop onReplay={replayable ? () => setRun((r) => r + 1) : undefined} />
      <View style={styles.hero}>
        <Gullu size={130} skin={skin} expression="happy" />
      </View>
      <Rise index={0}>
        <H1>Your investments are {formatINR(fall, { compact: true, hidden })} below their high.</H1>
        <Body>
          {insideRange
            ? `About ${pct}% down. Your plan expected falls like this: all ${goals} goals are still inside their range, and nothing needs selling.`
            : `About ${pct}% down. That's a bigger fall than your plan usually expects, but nothing needs selling. Your goals have time to recover.`}
        </Body>
      </Rise>
      <Rise index={1}>
        <GlassCard style={styles.card}>
          <View style={styles.cardTop}>
            <Caption>As of your 1 {MONTHS[ymMonth(moment.asOf)]} values</Caption>
            <Caption>from their high</Caption>
          </View>
          <View style={styles.amounts}>
            <Amount value={current} compact variant="h1" weight="800" />
            <Amount value={-fall} compact variant="label" weight="700" color={colors.stretch} />
          </View>
          <View style={styles.chart} key={run}>
            <RangeBand data={band} width={chartW} height={CHART_H} mode="calm" scrub={false} trigger={run} bandColor="rgba(201,195,255,0.22)" />
          </View>
          <Caption>
            Based on the values you confirmed at check-in. Nothing is fetched from the internet.{' '}
            <Caption color={colors.text} style={styles.link} onPress={replayable ? undefined : () => router.push({ pathname: '/payday/values', params: { standalone: '1' } })}>
              Update values
            </Caption>
          </Caption>
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
  link: { textDecorationLine: 'underline' },
});
