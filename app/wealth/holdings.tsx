/**
 * 5.3 Holdings (night). By class, any type, with the stale-value nudge. Class rows expand and
 * collapse with layout animation; the stale chip wiggles once. Tap a holding to see it and split
 * it across goals (5.6); add a holding of any kind.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { Amount } from '@/components/Amount';
import { GhostButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { HoldingSheet } from '@/screens/wealth/HoldingSheet';
import { staleDays } from '@/engine/wealth';
import { ALL_CLASSES, type AssetClass } from '@/engine/types';
import { CLASS_DOT, CLASS_NAME } from '@/lib/classes';
import { formatINR } from '@/lib/formatINR';
import { useReduceMotion } from '@/motion/prefs';
import { usePlanInput } from '@/plan/usePlan';
import { useSettingsStore } from '@/state/stores';
import { duration } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const STALE = 60;

function StaleChip({ days }: { days: number }) {
  const reduce = useReduceMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (!reduce) r.value = withDelay(duration.slow, withSequence(withTiming(-6, { duration: duration.instant }), withTiming(6, { duration: duration.instant }), withTiming(0, { duration: duration.instant })));
  }, [reduce, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={[styles.chip, a]}>
      <Caption color={colors.ink}>{days} days</Caption>
    </Animated.View>
  );
}

export default function Holdings() {
  const input = usePlanInput();
  const hidden = useSettingsStore((s) => s.hideAmounts);
  const [open, setOpen] = useState<Set<AssetClass>>(new Set());
  const [adding, setAdding] = useState(false);
  if (!input) return null;
  const total = input.holdings.reduce((a, h) => a + h.value, 0);
  const groups = ALL_CLASSES.map((c) => ({ c, hs: input.holdings.filter((h) => h.assetClass === c) })).filter((g) => g.hs.length);
  const stale = input.holdings.filter((h) => staleDays(input.today, h.valueAt) > STALE).sort((a, b) => a.valueAt - b.valueAt)[0];
  const toggle = (c: AssetClass) => {
    const n = new Set(open);
    if (n.has(c)) n.delete(c);
    else n.add(c);
    setOpen(n);
  };
  return (
    <View style={styles.fill}>
      <Screen background="night" scroll>
        <LabTop icon="back" />
        <Rise index={0}>
          <H1>
            {formatINR(total, { compact: true, hidden })} in {groups.length} classes.
          </H1>
        </Rise>
        <View style={styles.list}>
          {groups.map((g, i) => {
            const sum = g.hs.reduce((a, h) => a + h.value, 0);
            const isOpen = open.has(g.c);
            const oldest = Math.max(...g.hs.map((h) => staleDays(input.today, h.valueAt)));
            return (
              <Animated.View key={g.c} layout={LinearTransition.springify()} style={styles.group}>
                <PressScale onPress={() => toggle(g.c)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={CLASS_NAME[g.c]} testID={`holdings-${g.c}`}>
                  <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: CLASS_DOT[g.c] }]} />
                    <View style={styles.flex}>
                      <Body color={colors.text}>{g.c === 'other' ? 'Other, not planned' : CLASS_NAME[g.c]}</Body>
                      <Caption numberOfLines={isOpen ? undefined : 1}>{g.hs.map((h) => h.name).join(' · ')}</Caption>
                    </View>
                    {oldest > STALE ? <StaleChip days={oldest} /> : null}
                    <Amount value={sum} compact variant="label" weight="800" />
                  </View>
                </PressScale>
                {isOpen
                  ? g.hs.map((h) => (
                      <Animated.View key={h.id} entering={FadeIn.duration(duration.fast)}>
                        <PressScale onPress={() => router.push({ pathname: '/wealth/holding/[id]', params: { id: h.id } })} accessibilityRole="button" accessibilityLabel={h.name}>
                          <View style={[styles.row, styles.sub]}>
                            <Body color={colors.textGhost} style={styles.flex}>
                              {h.name}
                            </Body>
                            <Amount value={h.value} compact variant="body" color={colors.textGhost} />
                            <Icon name="chevron" size={16} color={colors.textCaption} />
                          </View>
                        </PressScale>
                      </Animated.View>
                    ))
                  : null}
              </Animated.View>
            );
          })}
        </View>
        {stale ? (
          <Caption style={styles.note}>
            {stale.name} value is {staleDays(input.today, stale.valueAt)} days old.{' '}
            <Caption color={colors.text} style={styles.link} onPress={() => router.push({ pathname: '/payday/values', params: { standalone: '1' } })}>
              Update it
            </Caption>
          </Caption>
        ) : null}
        <GhostButton label="+ Add a holding" onPress={() => setAdding(true)} />
        <Caption style={styles.note}>Linking your accounts automatically is coming later.</Caption>
      </Screen>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        {adding ? <HoldingSheet today={input.today} onDone={() => setAdding(false)} /> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  list: { marginTop: 16 },
  group: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  sub: { minHeight: 48, paddingLeft: 22 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { backgroundColor: colors.stretch, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  note: { marginTop: 12 },
  link: { textDecorationLine: 'underline' },
});
