/**
 * 4.4b Quick value check (night) — not designed; built to 08-BUILD-PLAN: one row per asset class,
 * pre-filled with the projected value, "Looks right" (primary), tap a row to edit. About 20 seconds.
 * Feeds market-fall detection and the stale nudges. Copy beyond the title is drafted.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Amount } from '@/components/Amount';
import { AmountField } from '@/components/AmountField';
import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/Pressable';
import { Rise } from '@/components/Rise';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, H1, Label } from '@/components/Text';
import { ALL_CLASSES, type AssetClass } from '@/engine/types';
import { CLASS_DOT, CLASS_NAME } from '@/lib/classes';
import { usePlanInput } from '@/plan/usePlan';
import { confirmValues, unlockLevels } from '@/state/payday';
import { colors } from '@/theme/tokens';


export default function ValueCheck() {
  const { levels, festival, standalone } = useLocalSearchParams<{ levels?: string; festival?: string; standalone?: string }>();
  const input = usePlanInput();
  const [edits, setEdits] = useState<Partial<Record<AssetClass, number>>>({});
  const [open, setOpen] = useState<AssetClass | null>(null);
  const [draft, setDraft] = useState(0);
  const [busy, setBusy] = useState(false);

  // Projected value per class: each holding grown at its class's expected return since it was last updated.
  const projected = useMemo(() => {
    const out: Partial<Record<AssetClass, number>> = {};
    if (!input) return out;
    for (const h of input.holdings) {
      const years = Math.max(0, (input.today - h.valueAt) / 12);
      const v = h.value * Math.pow(1 + input.assumptions.returnPct[h.assetClass] / 100, years);
      out[h.assetClass] = (out[h.assetClass] ?? 0) + v;
    }
    return out;
  }, [input]);
  if (!input) return null;
  const classes = ALL_CLASSES.filter((c) => (projected[c] ?? 0) > 0);
  const value = (c: AssetClass) => Math.round(edits[c] ?? projected[c] ?? 0);

  const finish = async (save: boolean) => {
    setBusy(true);
    try {
      if (save) await confirmValues(input.today, Object.fromEntries(classes.map((c) => [c, value(c)])));
      const more = save ? await unlockLevels() : [];
      const all = [...(levels ? levels.split(',').filter(Boolean) : []), ...more.map((l) => String(l.n))];
      // Opened on its own (market fall, stale nudge): back to where it came from, or to a new level.
      if (standalone) {
        if (all.length) router.replace({ pathname: '/level-up', params: { n: all[all.length - 1] } });
        else router.back();
        return;
      }
      router.replace({ pathname: '/payday/receipt', params: { levels: all.join(','), festival: festival ?? '' } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.fill}>
      <Screen
        background="night"
        scroll
        footer={
          <>
            <PrimaryButton testID="values-ok" label="Looks right" state={busy ? 'loading' : 'idle'} onPress={() => finish(true)} />
            <GhostButton label="Skip this month" onPress={() => finish(false)} />
          </>
        }
      >
        <Rise index={0}>
          <H1>Quick value check.</H1>
          <Body>I&apos;ve filled in where your money should be by now. Change any that look off, from your apps.</Body>
        </Rise>
        <View style={styles.list}>
          {classes.map((c, i) => (
            <Rise key={c} index={i + 1}>
              <PressScale onPress={() => (setDraft(value(c)), setOpen(c))} accessibilityRole="button" accessibilityLabel={`${CLASS_NAME[c]}, change value`} testID={`values-${c}`}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: CLASS_DOT[c] }]} />
                  <Body color={colors.text} style={styles.flex}>
                    {CLASS_NAME[c]}
                  </Body>
                  <Amount value={value(c)} compact variant="label" weight="800" animate="odometer" color={edits[c] != null ? colors.stretch : colors.text} />
                  <Icon name="chevron" size={18} color={colors.textCaption} />
                </View>
              </PressScale>
            </Rise>
          ))}
        </View>
        <Caption style={styles.note}>Values stay on this phone. Nothing is fetched from the internet.</Caption>
      </Screen>
      <Sheet open={open != null} onClose={() => setOpen(null)}>
        {open ? (
          <View style={styles.sheet}>
            <Label>{CLASS_NAME[open]}</Label>
            <AmountField testID="values-edit" label="Value today" value={draft} onChange={setDraft} />
            <PrimaryButton
              label="Save"
              onPress={() => {
                setEdits({ ...edits, [open]: draft });
                setOpen(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  list: { marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  note: { marginTop: 16 },
  sheet: { gap: 12 },
});
