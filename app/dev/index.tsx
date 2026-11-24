// Dev hub: Motion lab, Gullu, primitives, demo data. Reached from Welcome in dev builds.
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GlassCard, Row } from '@/components/Surfaces';
import { Body, H1, Micro } from '@/components/Text';
import { Screen } from '@/components/Screen';
import { Gullu } from '@/gullu/Gullu';
import { useHabitSkin } from '@/dev/useHabitSkin';

export default function DevHub() {
  const skin = useHabitSkin();
  return (
    <Screen background="dusk" scroll>
      <View style={styles.hero}>
        <Gullu size={140} expression="wave" skin={skin} />
      </View>
      <H1>Money Plan</H1>
      <Body>Build preview: Phases 0–2. The real screens come next, after the motion review.</Body>
      <GlassCard style={styles.card}>
        <Row title="Motion lab" detail="The six signature moments" chevron onPress={() => router.push('/dev/motion-lab')} />
        <Row title="Gullu" detail="Looks, expressions and his animation library" chevron onPress={() => router.push('/dev/gullu')} />
        <Row title="Primitives" detail="Every primitive on every gradient" chevron onPress={() => router.push('/dev/primitives')} />
        <Row title="Demo data" detail="Load Manish or Sunita, see the plan" chevron onPress={() => router.push('/dev/data')} />
      </GlassCard>
      <Micro center style={styles.note}>
        Everything stays on this phone. Nothing is fetched from the internet.
      </Micro>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 12 },
  card: { marginTop: 24, paddingVertical: 4 },
  note: { marginTop: 24 },
});
