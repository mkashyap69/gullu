// Primitives gallery (Phase 0 acceptance): every primitive on every gradient.
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount, AmountChange } from '@/components/Amount';
import { GhostButton, PrimaryButton, type ButtonState } from '@/components/Buttons';
import { Pill, SegmentedPills } from '@/components/Pill';
import { Screen } from '@/components/Screen';
import type { GradientVariant } from '@/components/ScreenBackground';
import { GlassCard, Row } from '@/components/Surfaces';
import { Big, Body, Caption, H1, Label, Micro } from '@/components/Text';
import { TabBar, type TabKey } from '@/components/TabBar';
import { Toggle } from '@/components/Toggle';
import { useSettingsStore } from '@/state/stores';
import { colors, gradients } from '@/theme/tokens';

const VARIANTS = Object.keys(gradients) as GradientVariant[];

export default function Primitives() {
  const [variant, setVariant] = useState<GradientVariant>('dusk');
  const [btn, setBtn] = useState<ButtonState>('idle');
  const [work, setWork] = useState('salaried');
  const [tab, setTab] = useState<TabKey>('home');
  const [value, setValue] = useState(55000);
  const hide = useSettingsStore((s) => s.hideAmounts);
  const update = useSettingsStore((s) => s.update);
  const press = () => {
    setBtn('loading');
    setTimeout(() => setBtn('done'), 900);
    setTimeout(() => setBtn('idle'), 1800);
  };
  return (
    <Screen background={variant} scroll>
      <Caption>Background (cross-fades; dusk and ember drift)</Caption>
      <View style={styles.wrap}>
        {VARIANTS.map((v) => (
          <Pill key={v} label={v} selected={v === variant} onPress={() => setVariant(v)} />
        ))}
      </View>
      <Big style={styles.gap}>₹55,000</Big>
      <H1>One message per screen.</H1>
      <Body>Body text is white at 68%. Two sizes per screen.</Body>
      <Label>Label · buttons</Label>
      <Caption>Caption is white at 60%.</Caption>
      <Micro>Micro · 12px</Micro>

      <Caption style={styles.gap}>Amount: count-up, odometer, compact, before → after</Caption>
      <Amount value={15584513} variant="h1" weight="800" animate="countUp" />
      <Amount value={value} variant="h1" weight="800" animate="odometer" />
      <View style={styles.wrap}>
        {[45000, 55000, 58500, 125000].map((v) => (
          <Pill key={v} label={`${v / 1000}k`} selected={v === value} onPress={() => setValue(v)} />
        ))}
      </View>
      <Body>
        <Amount value={8430000} compact variant="body" /> · <Amount value={24000000} compact variant="body" />
      </Body>
      <AmountChange from={12500} to={16000} />

      <Caption style={styles.gap}>Pills slide their selected background</Caption>
      <SegmentedPills
        value={work}
        onChange={setWork}
        options={[
          { value: 'salaried', label: 'Salaried' },
          { value: 'business', label: 'Business' },
          { value: 'freelance', label: 'Freelance' },
          { value: 'retired', label: 'Retired' },
        ]}
      />

      <GlassCard style={styles.gap}>
        <Row title="Holdings" detail="12 holdings in 6 classes" chevron onPress={() => undefined} />
        <Row title="Home" dot={colors.goal[0]} right={<Amount value={18000} variant="label" />} />
        <Toggle label="Hide amounts" value={hide} onChange={(v) => update({ hideAmounts: v })} />
      </GlassCard>

      <View style={styles.gap}>
        <PrimaryButton label="Primary: tap for loading → check" state={btn} onPress={press} />
        <GhostButton label="Ghost button" />
        <GhostButton label="Back" onPress={() => router.back()} />
      </View>
      <TabBar active={tab} onSelect={setTab} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  gap: { marginTop: 20 },
});
