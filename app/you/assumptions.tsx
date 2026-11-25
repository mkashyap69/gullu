/**
 * 8.2 Assumptions (night). Return presets per class and inflation; tap a value to set your own.
 * Switching presets rolls every value together. The projection disclaimer stays on screen.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RollingText } from '@/components/Amount';
import { GhostButton } from '@/components/Buttons';
import { SegmentedPills } from '@/components/Pill';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { LabTop } from '@/dev/LabTop';
import { PRESET_LABEL, applyPreset, presetOf, type Preset } from '@/engine/assumptions';
import { defaultAssumptions } from '@/engine/onboarding';
import type { Assumptions, PlannedClass } from '@/engine/types';
import { CLASS_NAME } from '@/lib/classes';
import { haptics } from '@/motion/haptics';
import { useProfileStore } from '@/state/stores';
import { colors } from '@/theme/tokens';

const ROWS: (PlannedClass | 'inflation')[] = ['indianEquity', 'globalEquity', 'debt', 'gold', 'cash', 'inflation'];
const pct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}% a year`;

export default function AssumptionsScreen() {
  const a = useProfileStore((s) => s.assumptions);
  const save = useProfileStore((s) => s.setAssumptions);
  const [edit, setEdit] = useState<(typeof ROWS)[number] | null>(null);
  if (!a) return null;
  const base: Assumptions = { ...a, ...pickRates(defaultAssumptions(a.stepUpPct)) };
  const preset = presetOf(base, a);
  const value = (k: (typeof ROWS)[number]) => (k === 'inflation' ? a.inflationPct : a.returnPct[k]);
  const nudge = async (k: (typeof ROWS)[number], d: number) => {
    haptics.selection();
    const v = Math.max(0, Math.round((value(k) + d) * 2) / 2);
    const next = k === 'inflation' ? { ...a, inflationPct: v } : { ...a, returnPct: { ...a.returnPct, [k]: v } };
    await save({ ...next, preset: presetOf(base, next) });
  };
  return (
    <View style={styles.fill}>
      <Screen background="night" scroll>
        <LabTop icon="back" />
        <H1>What I assume.</H1>
        <Body>Returns are guesses, not promises. Pick a preset or set your own.</Body>
        <View style={styles.pills}>
          <SegmentedPills<Preset | 'custom'>
            options={[
              { value: 'cautious', label: 'Cautious' },
              { value: 'default', label: 'Base' },
              { value: 'hopeful', label: 'Optimistic' },
              ...(preset === 'custom' ? [{ value: 'custom' as const, label: PRESET_LABEL.custom }] : []),
            ]}
            value={preset}
            onChange={(p) => (p === 'custom' ? undefined : save(applyPreset(base, p)))}
            testID="preset"
          />
        </View>
        {ROWS.map((k) => (
          <PressScale key={k} style={styles.row} onPress={() => setEdit(k)} accessibilityRole="button" accessibilityLabel={`${k === 'inflation' ? 'Inflation' : CLASS_NAME[k]}, ${pct(value(k))}`}>
            <Body color={colors.text}>{k === 'inflation' ? 'Inflation' : CLASS_NAME[k]}</Body>
            <RollingText text={pct(value(k))} variant="label" weight="800" />
          </PressScale>
        ))}
        <View style={styles.toggle}>
          <Toggle label="Show today's rupees" value={a.showTodayRupees} onChange={(v) => save({ ...a, showTodayRupees: v })} />
        </View>
        <Caption style={styles.disclaimer}>Projections use the returns you set. They are not guarantees or investment advice.</Caption>
      </Screen>
      <Sheet open={edit != null} onClose={() => setEdit(null)}>
        {edit ? (
          <View style={styles.sheet}>
            <Label>{edit === 'inflation' ? 'Inflation' : CLASS_NAME[edit]}</Label>
            <View style={styles.stepper}>
              <GhostButton label="− 0.5" onPress={() => nudge(edit, -0.5)} color={colors.text} />
              <RollingText text={pct(value(edit))} variant="h1" weight="800" />
              <GhostButton label="+ 0.5" onPress={() => nudge(edit, 0.5)} color={colors.text} />
            </View>
            <Caption>A yearly average over many years. Real years will be higher and lower.</Caption>
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

function pickRates(x: Assumptions): Pick<Assumptions, 'returnPct' | 'inflationPct'> {
  return { returnPct: x.returnPct, inflationPct: x.inflationPct };
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pills: { marginTop: 20, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  toggle: { marginTop: 12 },
  disclaimer: { marginTop: 16 },
  sheet: { gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
