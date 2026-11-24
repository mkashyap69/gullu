// Gullu: every look and expression, plus buttons for each animation in his library (04-MOTION.md).
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { GhostButton } from '@/components/Buttons';
import { Pill } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Gullu, GulluStill, type GulluHandle } from '@/gullu/Gullu';
import { EXPRESSIONS, SKINS, type Expression, type Skin } from '@/gullu/geometry';
import { duration, spring } from '@/theme/motion';
import { colors } from '@/theme/tokens';

export default function GulluSheet() {
  const g = useRef<GulluHandle>(null);
  const [expr, setExpr] = useState<Expression>('happy');
  const [skin, setSkin] = useState<Skin>('base');
  const pull = useSharedValue(0);
  const shine = useSharedValue(0);
  const actions: { label: string; run: () => void }[] = [
    { label: 'land', run: () => g.current?.land() },
    { label: 'hop', run: () => g.current?.hop() },
    { label: 'wave', run: () => g.current?.wave() },
    { label: 'celebrate', run: () => (setExpr('celebrate'), g.current?.celebrate()) },
    { label: 'spin', run: () => g.current?.spin() },
    { label: 'catchCoin', run: () => (setExpr('catch'), g.current?.catchCoin(() => setExpr('happy'))) },
    { label: 'lookAt ↖', run: () => g.current?.lookAt(-40, -40) },
    { label: 'lookAt ↘', run: () => g.current?.lookAt(40, 40) },
    { label: 'lookReset', run: () => g.current?.lookReset() },
    { label: 'concern', run: () => (setExpr('concern'), g.current?.concern()) },
    { label: 'stretchPull', run: () => (pull.value = withSequence(withTiming(1, { duration: duration.slow }), withSpring(0, spring.bouncy))) },
    { label: 'shine', run: () => ((shine.value = 0), (shine.value = withTiming(1, { duration: duration.draw }))) },
    { label: 'drawSkin', run: () => g.current?.drawSkin() },
  ];
  return (
    <Screen background="violet" scroll>
      <H1>Gullu</H1>
      <Body>Tap a look or an expression; the buttons play his animation library.</Body>
      <View style={styles.stage}>
        <Gullu ref={g} size={220} expression={expr} skin={skin} headroom={0.3} pull={pull} shine={shine} />
      </View>
      <Label>Animations</Label>
      <View style={styles.wrap}>
        {actions.map((a) => (
          <Pill key={a.label} label={a.label} onPress={a.run} />
        ))}
      </View>
      <Label style={styles.h}>Expressions</Label>
      <View style={styles.wrap}>
        {EXPRESSIONS.map((e) => (
          <Pill key={e} label={e} selected={e === expr} onPress={() => setExpr(e)} />
        ))}
      </View>
      <Label style={styles.h}>Looks</Label>
      <View style={styles.grid}>
        {SKINS.map((s) => (
          <View key={s} style={styles.cell}>
            <PressScale onPress={() => setSkin(s)} style={[styles.tile, s === skin && styles.tileOn]} accessibilityRole="button" accessibilityLabel={`Look: ${s}`}>
              {/* More than 3 Gullus on screen: tiles are still (no ambient loops); only the big one animates. */}
              <GulluStill size={64} skin={s} aura={false} />
              <Caption color={colors.text}>{s}</Caption>
            </PressScale>
          </View>
        ))}
      </View>
      <GhostButton label="Back" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', marginVertical: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  h: { marginTop: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 16 },
  cell: { width: '23%' },
  tile: { alignItems: 'center', paddingVertical: 8, borderRadius: 16, backgroundColor: colors.glass },
  tileOn: { backgroundColor: colors.glassStrong },
});
