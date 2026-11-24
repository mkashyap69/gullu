/**
 * You tab (8.x) is built in Phase 7. Until then, the settings motion and privacy depend on, plus
 * dev tools in dev builds.
 */
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { GhostButton } from '@/components/Buttons';
import { Screen } from '@/components/Screen';
import { GlassCard } from '@/components/Surfaces';
import { Body, H1 } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useSettingsStore } from '@/state/stores';

export default function YouTab() {
  const s = useSettingsStore();
  return (
    <Screen background="night" scroll>
      <H1>You</H1>
      <Body>Profile, assumptions and privacy are Phase 7. These settings work now.</Body>
      <GlassCard style={styles.card}>
        <Toggle label="Hide amounts" value={s.hideAmounts} onChange={(v) => s.update({ hideAmounts: v })} />
        <Toggle label="Reduce animations" value={s.reduceMotion} onChange={(v) => s.update({ reduceMotion: v })} />
        <Toggle label="Haptics" value={s.haptics} onChange={(v) => s.update({ haptics: v })} />
      </GlassCard>
      {__DEV__ ? <GhostButton label="Dev tools" onPress={() => router.push('/dev')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ card: { marginTop: 20, marginBottom: 12, paddingVertical: 4 } });
