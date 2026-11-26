/**
 * 10.3 Gullu's collection (violet). Level and festival looks; locked ones are silhouettes. Tiles
 * stagger in. Picking a look makes Gullu jump in the header and wear it everywhere. A locked tile
 * shakes gently and says how it unlocks. Looks can't be bought.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1 } from '@/components/Text';
import { LabTop } from '@/dev/LabTop';
import { useHabitSkin } from '@/dev/useHabitSkin';
import { ym } from '@/engine/dates';
import { FESTIVALS, LEVELS } from '@/engine/habits';
import { GulluStill } from '@/gullu/Gullu';
import type { Skin } from '@/gullu/geometry';
import { haptics } from '@/motion/haptics';
import { softShake } from '@/motion/shake';
import { useReduceMotion } from '@/motion/prefs';
import { useLevel } from '@/plan/selectors';
import { usePlanInput } from '@/plan/usePlan';
import { useHabitsStore } from '@/state/stores';
import { duration, spring, stagger } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

type Tile = { key: string; skin: Skin; label: string; locked: boolean; hint: string };

function TileView({ t, i, wearing, onPick }: { t: Tile; i: number; wearing: boolean; onPick: () => void }) {
  const reduce = useReduceMotion();
  const x = useSharedValue(0);
  const [tip, setTip] = useState(false);
  const shake = () => {
    haptics.selection();
    setTip(true);
    if (!reduce) x.value = softShake(4);
    setTimeout(() => setTip(false), duration.celebrate);
  };
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Animated.View style={styles.cell} entering={reduce ? undefined : FadeIn.delay(i * stagger.cards).duration(duration.base)}>
      <PressScale onPress={t.locked ? shake : onPick} accessibilityRole="button" accessibilityLabel={t.locked ? `${t.label}, locked. ${t.hint}` : `${t.label}${wearing ? ', wearing' : ''}`} testID={`look-${t.key}`}>
        <Animated.View style={[styles.tile, wearing && styles.wearing, a]}>
          <View style={t.locked ? styles.silhouette : undefined}>
            <GulluStill size={72} skin={t.skin} aura={false} />
          </View>
          <Caption color={t.locked ? colors.textCaption : colors.text} center numberOfLines={1}>
            {t.label}
          </Caption>
        </Animated.View>
      </PressScale>
      {tip ? (
        <View style={styles.tip} pointerEvents="none">
          <Caption color={colors.ink} center>
            {t.hint}
          </Caption>
        </View>
      ) : null}
    </Animated.View>
  );
}

export default function Collection() {
  const input = usePlanInput();
  const level = useLevel();
  const events = useHabitsStore((s) => s.events);
  const add = useHabitsStore((s) => s.add);
  const wearing = useHabitSkin();
  const reduce = useReduceMotion();
  const jump = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    jump.value = withSequence(withTiming(-28, { duration: duration.fast }), withSpring(0, spring.bouncy));
  }, [wearing, reduce, jump]);
  const header = useAnimatedStyle(() => ({ transform: [{ translateY: jump.value }] }));
  if (!input) return null;

  const owned = new Map(events.flatMap((e) => (e.kind === 'skin' ? [[e.data.label, e.data.skin] as const] : [])));
  const tiles: Tile[] = LEVELS.map((l) => ({
    key: l.skin,
    skin: l.skin as Skin,
    label: l.n <= level ? l.name : `Level ${l.n}`,
    locked: l.n > level,
    hint: `Unlocks at Level ${l.n}`,
  }));
  for (const [label, skin] of owned) if (skin === 'diwali' || skin === 'holi') tiles.push({ key: label, skin: skin as Skin, label, locked: false, hint: '' });
  const next = FESTIVALS.find((f) => ym(f.year, f.month) >= input.today && !owned.has(`${f.id === 'diwali' ? 'Diwali' : 'Holi'} ${f.year}`));
  if (next) {
    const label = `${next.id === 'diwali' ? 'Diwali' : 'Holi'} ${next.year}`;
    tiles.push({ key: label, skin: next.id, label, locked: true, hint: `Place a payday in ${label.split(' ')[0]} month` });
  }

  return (
    <Screen background="violet" scroll footer={<Caption center>Looks can&apos;t be bought. They come only from progress and festivals.</Caption>}>
      <LabTop icon="back" />
      <View style={styles.head}>
        <Animated.View style={header}>
          <GulluStill size={110} skin={wearing} />
        </Animated.View>
        <View style={styles.fill}>
          <H1>Gullu&apos;s collection</H1>
        </View>
      </View>
      <Body>Each level and festival paints Gullu a new way. Pick the one he wears.</Body>
      <View style={styles.grid}>
        {tiles.map((t, i) => (
          <TileView
            key={t.key}
            t={t}
            i={i}
            wearing={!t.locked && t.skin === wearing}
            onPick={async () => {
              haptics.selection();
              await add({ kind: 'wear', data: { skin: t.skin, label: t.label }, at: input.today });
            }}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  cell: { width: '30.5%' },
  tile: { backgroundColor: colors.glass, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  wearing: { borderColor: colors.white, backgroundColor: colors.glassStrong },
  silhouette: { opacity: 0.18 },
  tip: { position: 'absolute', top: -8, left: -8, right: -8, backgroundColor: colors.white, borderRadius: radius.sm, padding: 6, zIndex: 2 },
});
