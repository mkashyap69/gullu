// Motion lab: the six signature moments (04-MOTION.md), for review before the screens are built.
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GhostButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { GlassCard, Row } from '@/components/Surfaces';
import { Body, Caption, H1 } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useSettingsStore } from '@/state/stores';

const MOMENTS: { title: string; detail: string; href: Href }[] = [
  { title: '1 · Payday catch', detail: '4.2 · coin, catch, count-up, five bubbles', href: '/dev/moments/payday' },
  { title: '2 · The answer', detail: '1.7 · dial sweep, 0 → 3 of 4, rows cascade', href: '/dev/moments/answer' },
  { title: '3 · Rings to detail', detail: '2.1 → 3.2 · ring zooms into the fan chart', href: '/dev/moments/home-rings' },
  { title: '4 · Check-in to receipt', detail: '4.4 → 4.5 · ticks, hop, receipt line by line', href: '/dev/moments/check-in' },
  { title: '5 · Level up', detail: '10.2 · dim, land, spin, gold rim, particles', href: '/dev/moments/level-up' },
  { title: '6 · Market fall', detail: '2.2 · the anti-celebration: slow, calm, no haptics', href: '/dev/moments/market-fall' },
];

export default function MotionLab() {
  const s = useSettingsStore();
  return (
    <Screen background="violet" scroll>
      <H1>Motion lab</H1>
      <Body>Each moment replays from its screen. Flip the switches to check the reduced-motion version.</Body>
      <GlassCard style={styles.card}>
        {MOMENTS.map((m) => (
          <Row key={m.title} title={m.title} detail={m.detail} chevron onPress={() => router.push(m.href)} />
        ))}
      </GlassCard>
      <GlassCard style={styles.card}>
        <Toggle label="Reduce animations" detail="Forces the reduced-motion set, whatever the phone says" value={s.reduceMotion} onChange={(v) => s.update({ reduceMotion: v })} />
        <Toggle label="Haptics" value={s.haptics} onChange={(v) => s.update({ haptics: v })} />
        <Toggle label="FPS overlay" detail="UI-thread frames per second" value={s.fpsOverlay} onChange={(v) => s.update({ fpsOverlay: v })} />
        <Toggle label="Hide amounts" value={s.hideAmounts} onChange={(v) => s.update({ hideAmounts: v })} />
      </GlassCard>
      <View style={styles.foot}>
        <Caption center>Record on a release build: npx expo run:android --variant release</Caption>
        <GhostButton label="Back" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 20, paddingVertical: 4 },
  foot: { marginTop: 20, alignItems: 'center' },
});
