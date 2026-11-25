/**
 * The lock cover. Mounted once over the navigator. With App lock on it covers the app at launch,
 * when the app is in the switcher (so amounts never show in the snapshot), and after 60s away.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Buttons';
import { Body, H1 } from '@/components/Text';
import { GulluStill } from '@/gullu/Gullu';
import { useSettingsStore } from '@/state/stores';

import { RELOCK_AFTER_MS, authenticate, useLockStore } from './lock';

export function AppLock() {
  const on = useSettingsStore((s) => s.appLock);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const locked = useLockStore((s) => s.locked);
  const setLocked = useLockStore((s) => s.set);
  const away = useRef<number | null>(null);
  // Covers the app in the app switcher, so no amounts show in its snapshot.
  const [cover, setCover] = useState(false);

  const unlock = async () => {
    if (await authenticate()) setLocked(false);
  };

  // Lock at launch.
  useEffect(() => {
    if (hydrated && on) {
      setLocked(true);
      unlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (!on) return;
      setCover(s !== 'active');
      if (s === 'background') away.current = Date.now();
      if (s === 'active' && away.current != null) {
        const gone = Date.now() - away.current;
        away.current = null;
        if (gone > RELOCK_AFTER_MS) {
          setLocked(true);
          unlock();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  if (!on || !(locked || cover)) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} accessibilityViewIsModal>
      <GulluStill size={120} expression="sleepy" />
      <H1 center>Money Plan is locked.</H1>
      <Body center>Your plan stays private until you unlock it.</Body>
      <View style={styles.btn}>
        <PrimaryButton label="Unlock" onPress={unlock} testID="unlock" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#07060D', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, zIndex: 100 },
  btn: { alignSelf: 'stretch', marginTop: 24 },
});
