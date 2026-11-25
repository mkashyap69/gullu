/**
 * 9.3 Notification settings (night). The 8 kinds grouped into 7 switches, lock-screen hiding and
 * quiet hours. Toggles spring; the "At most 2 a week" count updates live. Everything is scheduled on
 * the phone. If the phone hasn't allowed notifications, a row asks first.
 */
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { RollingText } from '@/components/Amount';
import { PressScale } from '@/components/Pressable';
import { Screen } from '@/components/Screen';
import { Body, H1 } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import type { Settings } from '@/data/repo';
import { LabTop } from '@/dev/LabTop';
import { haptics } from '@/motion/haptics';
import { useProfileStore, useSettingsStore } from '@/state/stores';
import { colors } from '@/theme/tokens';

const ordinal = (d: number) => `${d}${d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'}`;

export default function NotificationSettings() {
  const s = useSettingsStore();
  const profile = useProfileStore((p) => p.profile);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Notifications.getPermissionsAsync().then((p) => setAllowed(p.granted));
  }, []);
  const day = profile?.paydayDay ?? 1;
  const kinds: { key: keyof Settings; label: string; detail: string }[] = [
    { key: 'nPayday', label: 'Payday', detail: profile?.incomeVaries || day < 0 ? 'When you log money in' : day === 0 ? 'On the last day, 9 am' : `On the ${ordinal(day)}, 9 am` },
    { key: 'nCheckIn', label: 'Check-in reminder', detail: 'Next day, if not done' },
    { key: 'nValues', label: 'Value update', detail: 'Every 30 days' },
    { key: 'nMilestones', label: 'Milestones', detail: 'Goals, safety net, streaks' },
    { key: 'nGoalChanges', label: 'Goal changes', detail: 'Glide path moves, goal near' },
    { key: 'nPpf', label: 'PPF year end', detail: 'In March, if short' },
    { key: 'nYearly', label: 'Yearly risk check', detail: 'Once a year' },
  ];
  const on = kinds.filter((k) => s[k.key]).length;
  const max = Math.min(2, on);

  return (
    <Screen background="night" scroll>
      <LabTop icon="back" />
      <View style={styles.head}>
        {max > 0 ? (
          <>
            <H1>At most </H1>
            <RollingText text={String(max)} variant="h1" weight="800" />
            <H1> a week.</H1>
          </>
        ) : (
          <H1>No notifications.</H1>
        )}
      </View>
      <Body>All set on your phone, never sent from a server. Nothing about market moves, nothing to sell you.</Body>
      {allowed === false ? (
        <PressScale
          style={styles.allow}
          onPress={async () => {
            const r = await Notifications.requestPermissionsAsync();
            setAllowed(r.granted);
          }}
          accessibilityRole="button"
        >
          <Body color={colors.text}>Your phone has notifications off for Money Plan. Tap to allow them.</Body>
        </PressScale>
      ) : null}
      <View style={styles.list}>
        {kinds.map((k) => (
          <Toggle key={k.key} label={k.label} detail={k.detail} value={!!s[k.key]} onChange={(v) => s.update({ [k.key]: v } as Partial<Settings>)} />
        ))}
        <View style={styles.gap} />
        <Toggle label="Hide amounts on lock screen" detail={'"Payday: money to place"'} value={s.nHideLock || s.hideAmounts} disabled={s.hideAmounts} onChange={(v) => s.update({ nHideLock: v })} />
        <PressScale
          style={styles.row}
          onPress={() => {
            haptics.selection();
            s.update({ nQuiet: !s.nQuiet });
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: s.nQuiet }}
          accessibilityLabel="Quiet hours, 10 pm to 8 am"
        >
          <Body color={colors.text}>Quiet hours</Body>
          <Body>{s.nQuiet ? '10 pm – 8 am' : 'Off'}</Body>
        </PressScale>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  allow: { marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,200,61,0.16)' },
  list: { marginTop: 16 },
  gap: { height: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 56 },
});
