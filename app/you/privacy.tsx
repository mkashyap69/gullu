/**
 * 8.3 Privacy (night). App lock, Hide amounts by default, encryption (always on), export, delete.
 * The lock's shackle closes when App lock turns on. "Delete everything" is hold-to-confirm (2s).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { GhostButton, PrimaryButton } from '@/components/Buttons';
import { HoldButton } from '@/components/HoldButton';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Row } from '@/components/Surfaces';
import { Body, Caption, H1, Label } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { LabTop } from '@/dev/LabTop';
import { destroyDb, openDb } from '@/data/db';
import { exportData } from '@/data/exportData';
import { clearAll } from '@/data/repo';
import { useReduceMotion } from '@/motion/prefs';
import { authenticate, canLock } from '@/security/lock';
import { getDb, setDb } from '@/state/dbHolder';
import { applyAppData, useSettingsStore } from '@/state/stores';
import { spring } from '@/theme/motion';
import { colors, radius } from '@/theme/tokens';

function LockIcon({ closed }: { closed: boolean }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(closed ? 0 : -6);
  useEffect(() => {
    y.value = reduce ? (closed ? 0 : -6) : withSpring(closed ? 0 : -6, spring.bouncy);
  }, [closed, reduce, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.lockTile} accessibilityLabel={closed ? 'Locked' : 'Unlocked'}>
      <Animated.View style={[styles.shackle, a]} />
      <View style={styles.lockBody} />
    </View>
  );
}

export default function Privacy() {
  const s = useSettingsStore();
  const [sheet, setSheet] = useState<'export' | 'noLock' | null>(null);
  const [exportNote, setExportNote] = useState('');

  const setLock = async (on: boolean) => {
    if (!on) return s.update({ appLock: false });
    if (!(await canLock())) return setSheet('noLock');
    if (await authenticate('Turn on App lock')) await s.update({ appLock: true });
  };
  const wipe = async () => {
    await clearAll(getDb());
    await destroyDb();
    setDb(await openDb());
    applyAppData(null);
    router.replace('/onboarding/welcome');
  };
  const doExport = async (kind: 'json' | 'csv') => {
    const ok = await exportData(kind);
    if (ok) setSheet(null);
    else setExportNote('Sharing isn’t available here. Try on your phone.');
  };

  return (
    <View style={styles.fill}>
      <Screen background="night" footer={<HoldButton label="Delete everything" onConfirm={wipe} testID="delete-all" />}>
        <LabTop icon="back" />
        <LockIcon closed={s.appLock} />
        <H1 style={styles.title}>Your money stays on your phone.</H1>
        <Body>No account, no upload. Usage stats never include amounts.</Body>
        <View style={styles.list}>
          <Toggle label="App lock" detail="Face ID or PIN" value={s.appLock} onChange={setLock} testID="toggle-lock" />
          <Toggle label="Hide amounts by default" detail="Tap ₹ to show" value={s.hideAmounts} onChange={(v) => s.update({ hideAmounts: v })} />
          <Toggle label="Encrypted on this phone" detail="Nothing leaves it" value disabled onChange={() => undefined} />
          <Row title="Export my data" detail="JSON or CSV" chevron onPress={() => { setExportNote(''); setSheet('export'); }} />
        </View>
        <Caption style={styles.hint}>Hold for two seconds to delete everything. This can&apos;t be undone.</Caption>
      </Screen>
      <Sheet open={sheet != null} onClose={() => setSheet(null)}>
        {sheet === 'export' ? (
          <View style={styles.sheet}>
            <Label>Export my data</Label>
            <Body>The file goes to your phone&apos;s share sheet. Where it goes from there is up to you. Amounts are included.</Body>
            <PrimaryButton label="Everything, as JSON" onPress={() => doExport('json')} />
            <GhostButton label="Holdings and goals, as CSV" color={colors.text} onPress={() => doExport('csv')} />
            {exportNote ? <Caption>{exportNote}</Caption> : null}
          </View>
        ) : null}
        {sheet === 'noLock' ? (
          <View style={styles.sheet}>
            <Label>Set a screen lock first.</Label>
            <Body>App lock uses your phone&apos;s Face ID, fingerprint or PIN. Turn one on in your phone&apos;s settings, then come back.</Body>
            <GhostButton label="OK" onPress={() => setSheet(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lockTile: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.glassStrong, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  shackle: { width: 14, height: 12, borderWidth: 2.2, borderBottomWidth: 0, borderColor: colors.white, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginBottom: -1 },
  lockBody: { width: 20, height: 14, borderRadius: 3, borderWidth: 2.2, borderColor: colors.white },
  title: { marginTop: 20 },
  list: { marginTop: 20 },
  hint: { marginTop: 16 },
  sheet: { gap: 12 },
});
