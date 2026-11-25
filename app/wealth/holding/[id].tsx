/**
 * 5.6 Holding split (night). One holding can serve several goals by %. A donut shows the split;
 * each goal has a slider, and because shares always total 100%, moving one pushes the others.
 * Whatever isn't assigned counts towards Retirement. Values roll. Also: edit or remove the holding.
 */
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Slider } from '@/components/Slider';
import { LabTop } from '@/dev/LabTop';
import { planGoals } from '@/engine/plan';
import { pushShares } from '@/engine/wealth';
import { CLASS_NAME } from '@/lib/classes';
import { goalColor } from '@/lib/goalColors';
import { haptics } from '@/motion/haptics';
import { usePlanInput } from '@/plan/usePlan';
import { HoldingSheet } from '@/screens/wealth/HoldingSheet';
import { useHoldingsStore } from '@/state/stores';

const TYPE_NAME: Record<string, string> = { indexFund: 'index fund', mutualFund: 'fund', stock: 'stock', etf: 'ETF', ppf: 'PPF', epf: 'EPF', nps: 'NPS', fd: 'FD', bond: 'bond', sgb: 'SGB', cash: 'cash', property: 'property', crypto: 'crypto', other: 'other' };

function Donut({ parts, size = 120 }: { parts: { pct: number; color: string }[]; size?: number }) {
  const arcs = useMemo(() => {
    let start = -90;
    return parts.map((p) => {
      const sweep = (p.pct / 100) * 360;
      const b = Skia.PathBuilder.Make().addArc(Skia.XYWHRect(8, 8, size - 16, size - 16), start, Math.max(0.1, sweep - 2)).build();
      start += sweep;
      return { path: b, color: p.color };
    });
  }, [parts, size]);
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      {arcs.map((a, i) => (
        <Path key={i} path={a.path} style="stroke" strokeWidth={14} strokeCap="butt" color={a.color} />
      ))}
    </Canvas>
  );
}

export default function HoldingSplit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const input = usePlanInput();
  const setSplit = useHoldingsStore((s) => s.setSplit);
  const removeHolding = useHoldingsStore((s) => s.removeHolding);
  const holding = input?.holdings.find((h) => h.id === id);
  const retire = input?.goals.find((g) => g.isRetirement);
  const [shares, setShares] = useState<Record<string, number>>(() =>
    Object.fromEntries((input?.holdingGoals ?? []).filter((x) => x.holdingId === id && x.goalId !== retire?.id).map((x) => [x.goalId, x.pct])),
  );
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!input || !holding) return null;
  const explicit = Object.values(shares).reduce((a, b) => a + b, 0);
  const rest = Math.max(0, 100 - explicit);
  const goalsAvail = [...planGoals(input), ...input.goals.filter((g) => g.isSafetyNet)].filter((g) => !g.isRetirement && shares[g.id] == null);
  const parts = [
    ...Object.entries(shares).map(([gid, pct]) => ({ pct, color: goalColor(input.goals.find((g) => g.id === gid)!) })),
    ...(retire && rest > 0 ? [{ pct: rest, color: goalColor(retire) }] : []),
  ];
  return (
    <View style={styles.fill}>
      <Screen
        background="night"
        scroll
        footer={
          <PrimaryButton
            testID="split-save-holding"
            label="Save"
            onPress={async () => {
              await setSplit(holding.id, Object.entries(shares).filter(([, p]) => p > 0).map(([goalId, pct]) => ({ holdingId: holding.id, goalId, pct })));
              router.back();
            }}
          />
        }
      >
        <LabTop icon="back" />
        <Rise index={0}>
          <Caption>
            {CLASS_NAME[holding.assetClass]} · {TYPE_NAME[holding.type] ?? holding.type}
          </Caption>
          <H1>{holding.name}</H1>
          <Amount value={holding.value} compact variant="big" />
          <Body>One holding can serve more than one goal. Set how much of it belongs to each.</Body>
        </Rise>
        <View style={styles.donut}>
          <Donut parts={parts} />
        </View>
        {Object.entries(shares).map(([gid, pct]) => {
          const g = input.goals.find((x) => x.id === gid)!;
          return (
            <View key={gid} style={styles.share}>
              <View style={styles.shareTop}>
                <Body color={g ? goalColor(g) : undefined} style={styles.flex}>
                  {g?.name ?? gid}
                </Body>
                <Label>{pct}% · </Label>
                <Amount value={(holding.value * pct) / 100} compact variant="label" weight="800" animate="odometer" />
              </View>
              <Slider accessibilityLabel={`${g?.name} share`} value={pct} min={0} max={100} step={5} onChange={(v) => setShares(pushShares(shares, gid, v))} />
            </View>
          );
        })}
        {retire ? (
          <View style={styles.share}>
            <View style={styles.shareTop}>
              <Body color={goalColor(retire)} style={styles.flex}>
                {retire.name}
              </Body>
              <Label>{rest}% · </Label>
              <Amount value={(holding.value * rest) / 100} compact variant="label" weight="800" animate="odometer" />
            </View>
          </View>
        ) : null}
        <Caption style={styles.note}>Shares always add up to 100%. Unassigned money counts towards Retirement.</Caption>
        {goalsAvail.length ? <GhostButton label="+ Add another goal" onPress={() => setPicking(true)} /> : null}
        <GhostButton label="Edit this holding" onPress={() => setEditing(true)} />
        {confirmRemove ? (
          <GhostButton
            label="Remove it for good"
            onPress={async () => {
              haptics.warning();
              await removeHolding(holding.id);
              router.back();
            }}
          />
        ) : (
          <GhostButton label="Remove this holding" onPress={() => setConfirmRemove(true)} />
        )}
      </Screen>
      <Sheet open={picking} onClose={() => setPicking(false)}>
        <View>
          <Label>Which goal?</Label>
          {goalsAvail.map((g) => (
            <Row
              key={g.id}
              title={g.name}
              dot={goalColor(g)}
              onPress={() => {
                setShares(pushShares({ ...shares, [g.id]: 0 }, g.id, Math.min(20, rest || 20)));
                setPicking(false);
              }}
            />
          ))}
        </View>
      </Sheet>
      <Sheet open={editing} onClose={() => setEditing(false)}>
        {editing ? <HoldingSheet holding={holding} today={input.today} onDone={() => setEditing(false)} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  donut: { alignItems: 'center', marginVertical: 16 },
  share: { paddingVertical: 6 },
  shareTop: { flexDirection: 'row', alignItems: 'center' },
  note: { marginTop: 12 },
});
